import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';

export function listarGastosPersonales(usuarioId) {
  return prisma.gastoPersonal.findMany({
    where: { usuarioId },
    orderBy: { fecha: 'desc' },
  });
}

export function crearGastoPersonal(usuarioId, data) {
  return prisma.gastoPersonal.create({
    data: { ...data, usuarioId },
  });
}

export async function eliminarGastoPersonal(usuarioId, gastoId) {
  const gasto = await prisma.gastoPersonal.findUnique({ where: { id: gastoId } });
  if (!gasto || gasto.usuarioId !== usuarioId) {
    throw new HttpError(404, 'Gasto no encontrado');
  }
  await prisma.gastoPersonal.delete({ where: { id: gastoId } });
}
