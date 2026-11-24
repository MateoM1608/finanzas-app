import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { dividirEnCuotas, fechasDeCuotas } from '../../utils/cuotas.js';
import { obtenerSplitVigenteGastosVariables, calcularReparto } from '../../utils/reparto.js';

/**
 * Compras a cuotas del hogar: crean de una vez todas sus cuotas como
 * GastoVariablePareja (compraId + numeroCuota). Automáticas (tarjeta): cada
 * cuota nace `pagado` y entra al saldo/cuadre sola cuando llega su fecha
 * (el saldo y los cuadres solo toman fecha ≤ hoy; antes, se puede
 * adelantar). Manuales (crédito de almacén): nacen `por_pagar` y alguien las
 * marca pagadas. El reparto de todas las cuotas usa el split vigente el día
 * de la compra (lo que se acordó al comprar), o uno personalizado.
 */

function requireHogarId(usuarioActual) {
  if (!usuarioActual.hogarId) {
    throw new HttpError(409, 'No perteneces a ningún hogar todavía');
  }
  return usuarioActual.hogarId;
}

function requirePermisoEdicion(usuarioActual) {
  if (!usuarioActual.esAdmin && !usuarioActual.puedeEditarGastos) {
    throw new HttpError(403, 'No tienes permiso para editar los gastos del hogar');
  }
}

const INCLUDE_COMPRA = {
  pagador: { select: { id: true, nombre: true } },
  metodoPago: true,
  cuotas: {
    select: { id: true, numeroCuota: true, valorTotal: true, fecha: true, estado: true },
    orderBy: { numeroCuota: 'asc' },
  },
};

/** El método de pago es dato personal del pagador: el resto del hogar no lo ve. */
function ocultarMetodoAjeno(compra, usuarioActual) {
  if (compra.pagoUsuarioId === usuarioActual.id) return compra;
  return { ...compra, metodoPago: null, metodoPagoId: null };
}

export async function listarCompras(usuarioActual) {
  const hogarId = requireHogarId(usuarioActual);
  const compras = await prisma.compraCuotasHogar.findMany({
    where: { hogarId },
    include: INCLUDE_COMPRA,
    orderBy: { fechaCompra: 'desc' },
  });
  return compras.map((c) => ocultarMetodoAjeno(c, usuarioActual));
}

/** Porcentajes del reparto: personalizado (montos sobre el total) o split vigente en la fecha de compra. */
async function resolverPorcentajes(hogarId, data) {
  if (data.repartos?.length) {
    const suma = data.repartos.reduce((acc, r) => acc + r.monto, 0);
    if (suma !== data.montoTotal) {
      throw new HttpError(400, `Los montos del reparto deben sumar el valor total (${data.montoTotal})`);
    }
    const miembros = await prisma.usuario.count({
      where: { hogarId, id: { in: data.repartos.map((r) => r.usuarioId) } },
    });
    if (miembros !== data.repartos.length) {
      throw new HttpError(400, 'Uno de los miembros del reparto no pertenece a tu hogar');
    }
    return data.repartos.map((r) => ({ usuarioId: r.usuarioId, porcentaje: (r.monto / data.montoTotal) * 100 }));
  }
  const split = await obtenerSplitVigenteGastosVariables(hogarId, prisma, data.fechaCompra);
  if (!split.length) {
    throw new HttpError(409, 'Configura primero el porcentaje de reparto del hogar en Configuración');
  }
  return split;
}

export async function crearCompra(usuarioActual, data) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);

  const pagador = await prisma.usuario.count({ where: { id: data.pagoUsuarioId, hogarId } });
  if (!pagador) {
    throw new HttpError(400, 'Quien paga debe ser un miembro de tu hogar');
  }
  if (data.metodoPagoId) {
    // Solo el propio pagador puede asociar uno de SUS métodos de pago.
    const metodo = await prisma.metodoPagoPersonal.findUnique({ where: { id: data.metodoPagoId } });
    if (!metodo || metodo.usuarioId !== usuarioActual.id || data.pagoUsuarioId !== usuarioActual.id) {
      throw new HttpError(400, 'Solo puedes asociar uno de tus métodos de pago a una compra que pagas tú');
    }
  }

  const porcentajes = await resolverPorcentajes(hogarId, data);
  const montos = dividirEnCuotas(data.montoTotal, data.numeroCuotas);
  const fechas = fechasDeCuotas(data.fechaPrimeraCuota, data.numeroCuotas);
  const estadoInicial = data.modoCobro === 'automatico' ? 'pagado' : 'por_pagar';

  const compra = await prisma.$transaction(async (tx) => {
    const nueva = await tx.compraCuotasHogar.create({
      data: {
        hogarId,
        item: data.item,
        montoTotal: data.montoTotal,
        numeroCuotas: data.numeroCuotas,
        fechaCompra: data.fechaCompra,
        fechaPrimeraCuota: fechas[0],
        modoCobro: data.modoCobro,
        pagoUsuarioId: data.pagoUsuarioId,
        metodoPagoId: data.metodoPagoId ?? null,
      },
    });
    for (let i = 0; i < fechas.length; i += 1) {
      const cuota = await tx.gastoVariablePareja.create({
        data: {
          hogarId,
          item: data.item,
          valorTotal: montos[i],
          pagoUsuarioId: data.pagoUsuarioId,
          fecha: fechas[i],
          estado: estadoInicial,
          compraId: nueva.id,
          numeroCuota: i + 1,
        },
      });
      await tx.gastoVariableParejaReparto.createMany({
        data: calcularReparto(montos[i], porcentajes).map((r) => ({ gastoId: cuota.id, ...r })),
      });
    }
    return tx.compraCuotasHogar.findUnique({ where: { id: nueva.id }, include: INCLUDE_COMPRA });
  });
  return ocultarMetodoAjeno(compra, usuarioActual);
}

/** Elimina la compra con todas sus cuotas, mientras ninguna esté en un cuadre. */
export async function eliminarCompra(usuarioActual, compraId) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);
  const compra = await prisma.compraCuotasHogar.findUnique({ where: { id: compraId } });
  if (!compra || compra.hogarId !== hogarId) {
    throw new HttpError(404, 'Compra no encontrada');
  }
  const enCuadre = await prisma.gastoVariablePareja.count({
    where: { compraId, estado: { in: ['en_cuadre', 'cuadrado'] } },
  });
  if (enCuadre) {
    throw new HttpError(409, 'Esta compra ya tiene cuotas en un cuadre — no se puede eliminar');
  }
  await prisma.$transaction([
    prisma.gastoVariableParejaReparto.deleteMany({ where: { gasto: { compraId } } }),
    prisma.gastoVariablePareja.deleteMany({ where: { compraId } }),
    prisma.compraCuotasHogar.delete({ where: { id: compraId } }),
  ]);
}
