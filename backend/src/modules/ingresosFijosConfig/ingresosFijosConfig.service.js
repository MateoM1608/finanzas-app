import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';

async function requireConfigDelUsuario(usuarioId, id) {
  const config = await prisma.ingresoFijoConfig.findUnique({ where: { id } });
  if (!config || config.usuarioId !== usuarioId) {
    throw new HttpError(404, 'Ingreso fijo no encontrado');
  }
  return config;
}

export function listarIngresosFijos(usuarioActual) {
  return prisma.ingresoFijoConfig.findMany({
    where: { usuarioId: usuarioActual.id },
    orderBy: { creadoEn: 'asc' },
  });
}

export function crearIngresoFijo(usuarioActual, data) {
  return prisma.ingresoFijoConfig.create({
    data: { ...data, usuarioId: usuarioActual.id },
  });
}

export async function actualizarIngresoFijo(usuarioActual, id, data) {
  await requireConfigDelUsuario(usuarioActual.id, id);
  return prisma.ingresoFijoConfig.update({ where: { id }, data });
}

export async function eliminarIngresoFijo(usuarioActual, id) {
  await requireConfigDelUsuario(usuarioActual.id, id);

  const tieneInstancias = await prisma.ingresoPersonal.count({ where: { origenConfigId: id } });
  if (tieneInstancias) {
    throw new HttpError(
      409,
      'Este ingreso fijo ya generó ocurrencias — desactívalo en vez de eliminarlo, para no perder ese historial',
    );
  }

  await prisma.ingresoFijoConfig.delete({ where: { id } });
}
