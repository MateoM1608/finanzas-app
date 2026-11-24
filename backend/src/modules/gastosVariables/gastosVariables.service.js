import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { obtenerSplitVigenteGastosVariables, calcularReparto } from '../../utils/reparto.js';
import { hoyUTC } from '../../utils/fechas.js';

const INCLUDE_GASTO = {
  compra: { select: { id: true, numeroCuotas: true, modoCobro: true } },
  pagador: { select: { id: true, nombre: true } },
  repartos: { include: { usuario: { select: { id: true, nombre: true } } } },
};

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

async function validarMiembroDelHogar(hogarId, usuarioId) {
  const pertenece = await prisma.usuario.count({ where: { id: usuarioId, hogarId } });
  if (!pertenece) {
    throw new HttpError(400, 'Ese usuario no pertenece a tu hogar');
  }
}

async function requireGastoDelHogar(hogarId, gastoId) {
  const gasto = await prisma.gastoVariablePareja.findUnique({ where: { id: gastoId } });
  if (!gasto || gasto.hogarId !== hogarId) {
    throw new HttpError(404, 'Gasto no encontrado');
  }
  return gasto;
}

async function resolverRepartos(hogarId, valorTotal, repartosInput, fecha) {
  if (repartosInput && repartosInput.length) {
    const suma = repartosInput.reduce((acc, r) => acc + r.monto, 0);
    if (suma !== valorTotal) {
      throw new HttpError(400, `Los montos del reparto deben sumar el valor total (${valorTotal})`);
    }
    for (const r of repartosInput) {
      await validarMiembroDelHogar(hogarId, r.usuarioId);
    }
    return repartosInput;
  }

  // Split vigente en la fecha del gasto, no el de hoy.
  const split = await obtenerSplitVigenteGastosVariables(hogarId, prisma, fecha);
  if (!split.length) {
    throw new HttpError(
      409,
      'Configura primero un split de porcentaje (general o de gastos variables) en Configuración, o especifica el reparto manualmente',
    );
  }
  return calcularReparto(valorTotal, split);
}

export function listarGastosVariables(usuarioActual) {
  const hogarId = requireHogarId(usuarioActual);
  return prisma.gastoVariablePareja.findMany({
    where: { hogarId },
    include: INCLUDE_GASTO,
    orderBy: [{ fecha: 'desc' }, { creadoEn: 'desc' }],
  });
}

export async function crearGastoVariable(usuarioActual, data) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);
  await validarMiembroDelHogar(hogarId, data.pagoUsuarioId);
  const repartos = await resolverRepartos(hogarId, data.valorTotal, data.repartos, data.fecha);

  return prisma.$transaction(async (tx) => {
    const gasto = await tx.gastoVariablePareja.create({
      data: {
        hogarId,
        item: data.item,
        valorTotal: data.valorTotal,
        pagoUsuarioId: data.pagoUsuarioId,
        fecha: data.fecha,
      },
    });

    await tx.gastoVariableParejaReparto.createMany({
      data: repartos.map((r) => ({ gastoId: gasto.id, usuarioId: r.usuarioId, monto: r.monto })),
    });

    return tx.gastoVariablePareja.findUnique({ where: { id: gasto.id }, include: INCLUDE_GASTO });
  });
}

export async function actualizarGastoVariable(usuarioActual, gastoId, data) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);
  const gasto = await requireGastoDelHogar(hogarId, gastoId);
  if (gasto.compraId) {
    throw new HttpError(409, 'Es una cuota de una compra a cuotas — elimina la compra y vuelve a crearla para cambiarla');
  }
  if (gasto.estado === 'cuadrado') {
    throw new HttpError(409, 'Este gasto ya se cuadró y no se puede editar');
  }
  if (gasto.estado === 'en_cuadre') {
    throw new HttpError(
      409,
      'Este gasto está en el cuadre en curso — desmárcalo del cuadre para poder editarlo',
    );
  }
  if (data.pagoUsuarioId) {
    await validarMiembroDelHogar(hogarId, data.pagoUsuarioId);
  }

  const valorTotalFinal = data.valorTotal ?? gasto.valorTotal;
  const fechaFinal = data.fecha ?? gasto.fecha;
  const debeRecalcularReparto =
    data.valorTotal !== undefined || data.repartos !== undefined || data.fecha !== undefined;
  const nuevosRepartos = debeRecalcularReparto
    ? await resolverRepartos(hogarId, valorTotalFinal, data.repartos, fechaFinal)
    : null;

  return prisma.$transaction(async (tx) => {
    await tx.gastoVariablePareja.update({
      where: { id: gastoId },
      data: {
        item: data.item ?? undefined,
        valorTotal: data.valorTotal ?? undefined,
        pagoUsuarioId: data.pagoUsuarioId ?? undefined,
        fecha: data.fecha ?? undefined,
      },
    });

    if (nuevosRepartos) {
      await tx.gastoVariableParejaReparto.deleteMany({ where: { gastoId } });
      await tx.gastoVariableParejaReparto.createMany({
        data: nuevosRepartos.map((r) => ({ gastoId, usuarioId: r.usuarioId, monto: r.monto })),
      });
    }

    return tx.gastoVariablePareja.findUnique({ where: { id: gastoId }, include: INCLUDE_GASTO });
  });
}

export async function eliminarGastoVariable(usuarioActual, gastoId) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);
  const gasto = await requireGastoDelHogar(hogarId, gastoId);
  if (gasto.compraId) {
    throw new HttpError(409, 'Es una cuota de una compra a cuotas — elimina la compra completa');
  }
  if (gasto.estado !== 'pagado') {
    throw new HttpError(409, 'Solo se pueden eliminar gastos que todavía no estén en un cuadre');
  }

  await prisma.$transaction([
    prisma.gastoVariableParejaReparto.deleteMany({ where: { gastoId } }),
    prisma.gastoVariablePareja.delete({ where: { id: gastoId } }),
  ]);
}

/**
 * Marca como pagada una cuota de cobro manual (crédito de almacén) de una
 * compra a cuotas del hogar. Desde ahí entra al saldo y a los cuadres.
 */
export async function pagarCuotaVariable(usuarioActual, gastoId, data) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);
  const gasto = await requireGastoDelHogar(hogarId, gastoId);
  if (gasto.estado !== 'por_pagar') {
    throw new HttpError(409, 'Esta cuota ya está marcada como pagada');
  }
  if (data.pagoUsuarioId) {
    await validarMiembroDelHogar(hogarId, data.pagoUsuarioId);
  }
  return prisma.gastoVariablePareja.update({
    where: { id: gastoId },
    data: {
      estado: 'pagado',
      pagoUsuarioId: data.pagoUsuarioId ?? undefined,
      fechaPago: data.fechaPago ?? hoyUTC(),
    },
    include: INCLUDE_GASTO,
  });
}

export async function deshacerPagoCuotaVariable(usuarioActual, gastoId) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);
  const gasto = await prisma.gastoVariablePareja.findUnique({ where: { id: gastoId }, include: { compra: true } });
  if (!gasto || gasto.hogarId !== hogarId) {
    throw new HttpError(404, 'Gasto no encontrado');
  }
  if (gasto.compra?.modoCobro !== 'manual') {
    throw new HttpError(409, 'Solo se puede deshacer el pago de una cuota de cobro manual');
  }
  if (gasto.estado !== 'pagado') {
    throw new HttpError(409, 'Esta cuota no está pagada o ya está en un cuadre');
  }
  return prisma.gastoVariablePareja.update({
    where: { id: gastoId },
    data: { estado: 'por_pagar', fechaPago: null },
    include: INCLUDE_GASTO,
  });
}
