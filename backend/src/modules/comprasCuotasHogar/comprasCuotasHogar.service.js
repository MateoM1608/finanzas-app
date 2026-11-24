import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { calcularCuotas, fechasDeCuotas } from '../../utils/cuotas.js';
import { obtenerSplitVigenteGastosVariables, calcularReparto } from '../../utils/reparto.js';
import { sincronizarPagoGasto } from '../../utils/movimientosHogar.js';

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

  const compra = await prisma.$transaction(async (tx) => {
    const nueva = await tx.compraCuotasHogar.create({
      data: {
        hogarId,
        item: data.item,
        montoTotal: data.montoTotal,
        numeroCuotas: data.numeroCuotas,
        fechaCompra: data.fechaCompra,
        fechaPrimeraCuota: data.fechaPrimeraCuota,
        modoCobro: data.modoCobro,
        tasaMensual: data.tasaMensual ?? 0,
        sistemaInteres: data.sistemaInteres ?? 'capital_fijo',
        pagoUsuarioId: data.pagoUsuarioId,
        metodoPagoId: data.metodoPagoId ?? null,
      },
    });
    const primera = await generarCuotas(tx, nueva.id, hogarId, data, porcentajes);
    await tx.compraCuotasHogar.update({ where: { id: nueva.id }, data: { fechaPrimeraCuota: primera } });
    return tx.compraCuotasHogar.findUnique({ where: { id: nueva.id }, include: INCLUDE_COMPRA });
  });
  return ocultarMetodoAjeno(compra, usuarioActual);
}

/** Crea las N cuotas (GastoVariablePareja + reparto) de una compra con los datos dados. */
async function generarCuotas(tx, compraId, hogarId, datos, porcentajes) {
  const cuotas = calcularCuotas(datos.montoTotal, datos.numeroCuotas, datos.tasaMensual, datos.sistemaInteres);
  const fechas = fechasDeCuotas(datos.fechaPrimeraCuota, datos.numeroCuotas);
  const estadoInicial = datos.modoCobro === 'automatico' ? 'pagado' : 'por_pagar';
  for (let i = 0; i < fechas.length; i += 1) {
    const cuota = await tx.gastoVariablePareja.create({
      data: {
        hogarId,
        item: datos.item,
        valorTotal: cuotas[i].monto,
        capital: cuotas[i].capital,
        interes: cuotas[i].interes,
        pagoUsuarioId: datos.pagoUsuarioId,
        fecha: fechas[i],
        estado: estadoInicial,
        compraId,
        numeroCuota: i + 1,
      },
    });
    await tx.gastoVariableParejaReparto.createMany({
      // El interés también se reparte: el reparto va sobre el valor total de la cuota.
      data: calcularReparto(cuotas[i].monto, porcentajes).map((r) => ({ gastoId: cuota.id, ...r })),
    });
    await sincronizarPagoGasto(tx, cuota.id);
  }
  return fechas[0];
}

/** Porcentajes del reparto que ya tiene la compra (de su primera cuota), para conservarlos al recalcular. */
async function porcentajesActuales(compraId) {
  const primera = await prisma.gastoVariablePareja.findFirst({
    where: { compraId },
    orderBy: { numeroCuota: 'asc' },
    include: { repartos: true },
  });
  if (!primera?.repartos.length) return null;
  return primera.repartos.map((r) => ({ usuarioId: r.usuarioId, porcentaje: (r.monto / primera.valorTotal) * 100 }));
}

const CAMPOS_ESTRUCTURALES = ['montoTotal', 'numeroCuotas', 'fechaPrimeraCuota', 'modoCobro', 'pagoUsuarioId', 'tasaMensual', 'sistemaInteres'];

/**
 * Edita una compra del hogar. El nombre (y el método de pago, solo su
 * pagador) se cambian siempre. Monto, número de cuotas, primera cuota, modo
 * de cobro, quién paga o el reparto recalculan TODAS las cuotas; no se
 * permite si alguna cuota ya está en un cuadre (ya se liquidó) o si alguna
 * cuota manual ya se marcó pagada. El reparto se conserva salvo que se
 * mande uno nuevo.
 */
export async function actualizarCompra(usuarioActual, compraId, data) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);
  const actual = await prisma.compraCuotasHogar.findUnique({ where: { id: compraId } });
  if (!actual || actual.hogarId !== hogarId) {
    throw new HttpError(404, 'Compra no encontrada');
  }

  const datos = {
    item: data.item ?? actual.item,
    montoTotal: data.montoTotal ?? actual.montoTotal,
    numeroCuotas: data.numeroCuotas ?? actual.numeroCuotas,
    fechaCompra: data.fechaCompra ?? actual.fechaCompra,
    fechaPrimeraCuota: data.fechaPrimeraCuota ?? actual.fechaPrimeraCuota,
    modoCobro: data.modoCobro ?? actual.modoCobro,
    pagoUsuarioId: data.pagoUsuarioId ?? actual.pagoUsuarioId,
    tasaMensual: data.tasaMensual ?? actual.tasaMensual,
    sistemaInteres: data.sistemaInteres ?? actual.sistemaInteres,
  };
  if (datos.pagoUsuarioId !== actual.pagoUsuarioId) {
    const pagador = await prisma.usuario.count({ where: { id: datos.pagoUsuarioId, hogarId } });
    if (!pagador) {
      throw new HttpError(400, 'Quien paga debe ser un miembro de tu hogar');
    }
  }

  // Método de pago: privado del pagador. Solo él lo cambia; si cambia quien
  // paga, el método anterior (de otra persona) se quita.
  let metodoPagoId = actual.metodoPagoId;
  if (datos.pagoUsuarioId !== actual.pagoUsuarioId) metodoPagoId = null;
  if (data.metodoPagoId !== undefined) {
    if (datos.pagoUsuarioId !== usuarioActual.id) {
      throw new HttpError(400, 'Solo quien paga la compra puede asociarle su método de pago');
    }
    if (data.metodoPagoId) {
      const metodo = await prisma.metodoPagoPersonal.findUnique({ where: { id: data.metodoPagoId } });
      if (!metodo || metodo.usuarioId !== usuarioActual.id) {
        throw new HttpError(400, 'Método de pago no encontrado');
      }
    }
    metodoPagoId = data.metodoPagoId;
  }

  const cambiaEstructura =
    data.repartos !== undefined ||
    CAMPOS_ESTRUCTURALES.some((campo) =>
      campo === 'fechaPrimeraCuota'
        ? new Date(datos[campo]).getTime() !== new Date(actual[campo]).getTime()
        : datos[campo] !== actual[campo],
    );

  let porcentajes = null;
  if (cambiaEstructura) {
    const bloqueadas = await prisma.gastoVariablePareja.count({
      where: {
        compraId,
        OR: [
          { estado: { in: ['en_cuadre', 'cuadrado'] } },
          ...(actual.modoCobro === 'manual' ? [{ estado: 'pagado' }] : []),
        ],
      },
    });
    if (bloqueadas) {
      throw new HttpError(
        409,
        'Esta compra ya tiene cuotas cuadradas o marcadas como pagadas: solo puedes cambiar el nombre o el método de pago',
      );
    }
    porcentajes = data.repartos?.length
      ? await resolverPorcentajes(hogarId, { ...datos, repartos: data.repartos })
      : ((await porcentajesActuales(compraId)) ?? (await resolverPorcentajes(hogarId, datos)));
  }

  const compra = await prisma.$transaction(async (tx) => {
    if (cambiaEstructura) {
      await tx.gastoVariableParejaReparto.deleteMany({ where: { gasto: { compraId } } });
      await tx.gastoVariablePareja.deleteMany({ where: { compraId } });
      datos.fechaPrimeraCuota = await generarCuotas(tx, compraId, hogarId, datos, porcentajes);
    } else if (datos.item !== actual.item) {
      await tx.gastoVariablePareja.updateMany({ where: { compraId }, data: { item: datos.item } });
    }
    await tx.compraCuotasHogar.update({ where: { id: compraId }, data: { ...datos, metodoPagoId } });
    // Con el método y el nombre ya guardados en la compra, los movimientos de
    // caja de sus cuotas quedan al día.
    const cuotas = await tx.gastoVariablePareja.findMany({ where: { compraId }, select: { id: true } });
    for (const c of cuotas) await sincronizarPagoGasto(tx, c.id);
    return tx.compraCuotasHogar.findUnique({ where: { id: compraId }, include: INCLUDE_COMPRA });
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
