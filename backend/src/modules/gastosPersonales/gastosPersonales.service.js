import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { asegurarGastosFijos } from '../../utils/instanciasFijasPersonales.js';
import { evaluarPeriodoSiCorresponde } from '../../utils/evaluacionAhorro.js';

const INCLUDE_GASTO = {
  metodoPago: true,
  categoria: true,
};

/**
 * Dispara la evaluación de Ahorros del período que contiene la fecha de este
 * gasto, cuando queda pagado y es obligatorio — ver
 * Modulo_Panel_Personal_Ajustes.md sección 6.4. Es idempotente (no hace nada
 * si ese período ya fue evaluado), así que no importa si se llama de más.
 */
async function evaluarSiObligatorioPagado(gasto) {
  if (gasto.esObligatorio && gasto.estado === 'pagado') {
    await evaluarPeriodoSiCorresponde(gasto.usuarioId, gasto.fecha);
  }
}

export async function listarGastosPersonales(usuarioId) {
  await asegurarGastosFijos(usuarioId);
  return prisma.gastoPersonal.findMany({
    where: { usuarioId },
    include: INCLUDE_GASTO,
    orderBy: { fecha: 'desc' },
  });
}

export async function crearGastoPersonal(usuarioId, data) {
  const gasto = await prisma.gastoPersonal.create({
    data: { ...data, usuarioId },
    include: INCLUDE_GASTO,
  });
  await evaluarSiObligatorioPagado(gasto);
  return gasto;
}

export async function actualizarGastoPersonal(usuarioId, gastoId, data) {
  const gasto = await prisma.gastoPersonal.findUnique({ where: { id: gastoId } });
  if (!gasto || gasto.usuarioId !== usuarioId) {
    throw new HttpError(404, 'Gasto no encontrado');
  }

  const actualizado = await prisma.gastoPersonal.update({
    where: { id: gastoId },
    data,
    include: INCLUDE_GASTO,
  });
  await evaluarSiObligatorioPagado(actualizado);
  return actualizado;
}

export async function eliminarGastoPersonal(usuarioId, gastoId) {
  const gasto = await prisma.gastoPersonal.findUnique({ where: { id: gastoId } });
  if (!gasto || gasto.usuarioId !== usuarioId) {
    throw new HttpError(404, 'Gasto no encontrado');
  }
  if (gasto.origenConfigId) {
    throw new HttpError(
      409,
      'Este gasto viene de un concepto fijo — desactiva el concepto en vez de eliminar esta ocurrencia (si no, volvería a generarse)',
    );
  }
  if (gasto.origenCorteId) {
    throw new HttpError(409, 'Este gasto viene de un corte del hogar ya cerrado — no se puede eliminar');
  }

  await prisma.gastoPersonal.delete({ where: { id: gastoId } });
}
