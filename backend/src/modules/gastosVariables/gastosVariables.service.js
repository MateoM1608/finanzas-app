import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { obtenerSplitVigente, calcularReparto } from '../../utils/reparto.js';

const INCLUDE_GASTO = {
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

async function resolverRepartos(hogarId, valorTotal, repartosInput) {
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

  const split = await obtenerSplitVigente(hogarId);
  if (!split.length) {
    throw new HttpError(
      409,
      'Configura primero el split de porcentaje del hogar (Settings), o especifica el reparto manualmente',
    );
  }
  return calcularReparto(valorTotal, split);
}

export function listarGastosVariables(usuarioActual) {
  const hogarId = requireHogarId(usuarioActual);
  return prisma.gastoVariablePareja.findMany({
    where: { hogarId },
    include: INCLUDE_GASTO,
    orderBy: { fechaLimite: 'asc' },
  });
}

export async function crearGastoVariable(usuarioActual, data) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);
  await validarMiembroDelHogar(hogarId, data.pagoUsuarioId);
  const repartos = await resolverRepartos(hogarId, data.valorTotal, data.repartos);

  return prisma.$transaction(async (tx) => {
    const gasto = await tx.gastoVariablePareja.create({
      data: {
        hogarId,
        item: data.item,
        valorTotal: data.valorTotal,
        pagoUsuarioId: data.pagoUsuarioId,
        fechaLimite: data.fechaLimite,
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
  if (gasto.estado === 'liquidado') {
    throw new HttpError(409, 'Este gasto ya fue liquidado en un corte y no se puede editar');
  }
  if (data.pagoUsuarioId) {
    await validarMiembroDelHogar(hogarId, data.pagoUsuarioId);
  }

  const valorTotalFinal = data.valorTotal ?? gasto.valorTotal;
  const debeRecalcularReparto = data.valorTotal !== undefined || data.repartos !== undefined;
  const nuevosRepartos = debeRecalcularReparto
    ? await resolverRepartos(hogarId, valorTotalFinal, data.repartos)
    : null;

  return prisma.$transaction(async (tx) => {
    await tx.gastoVariablePareja.update({
      where: { id: gastoId },
      data: {
        item: data.item ?? undefined,
        valorTotal: data.valorTotal ?? undefined,
        pagoUsuarioId: data.pagoUsuarioId ?? undefined,
        fechaLimite: data.fechaLimite ?? undefined,
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
  if (gasto.estado !== 'pendiente') {
    throw new HttpError(409, 'Solo se pueden eliminar gastos que sigan pendientes');
  }

  await prisma.$transaction([
    prisma.gastoVariableParejaReparto.deleteMany({ where: { gastoId } }),
    prisma.gastoVariablePareja.delete({ where: { id: gastoId } }),
  ]);
}
