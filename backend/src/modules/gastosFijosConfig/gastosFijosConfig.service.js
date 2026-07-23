import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';

async function requireConfigDelUsuario(usuarioId, id) {
  const config = await prisma.gastoFijoConfig.findUnique({ where: { id } });
  if (!config || config.usuarioId !== usuarioId) {
    throw new HttpError(404, 'Gasto fijo no encontrado');
  }
  return config;
}

export function listarGastosFijos(usuarioActual) {
  return prisma.gastoFijoConfig.findMany({
    where: { usuarioId: usuarioActual.id },
    orderBy: { creadoEn: 'asc' },
  });
}

export function crearGastoFijo(usuarioActual, data) {
  return prisma.gastoFijoConfig.create({
    data: { ...data, usuarioId: usuarioActual.id },
  });
}

export async function actualizarGastoFijo(usuarioActual, id, data) {
  await requireConfigDelUsuario(usuarioActual.id, id);
  return prisma.gastoFijoConfig.update({ where: { id }, data });
}

export async function eliminarGastoFijo(usuarioActual, id) {
  await requireConfigDelUsuario(usuarioActual.id, id);

  const tieneInstancias = await prisma.gastoPersonal.count({ where: { origenConfigId: id } });
  if (tieneInstancias) {
    throw new HttpError(
      409,
      'Este gasto fijo ya generó ocurrencias — desactívalo en vez de eliminarlo, para no perder ese historial',
    );
  }

  await prisma.gastoFijoConfig.delete({ where: { id } });
}
