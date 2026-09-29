import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { asegurarIngresosFijos } from '../../utils/instanciasFijasPersonales.js';

const INCLUDE_INGRESO = {
  metodoPago: true,
  categoria: true,
};

export async function listarIngresosPersonales(usuarioId) {
  await asegurarIngresosFijos(usuarioId);
  return prisma.ingresoPersonal.findMany({
    where: { usuarioId },
    include: INCLUDE_INGRESO,
    orderBy: { fecha: 'desc' },
  });
}

export function crearIngresoPersonal(usuarioId, data) {
  return prisma.ingresoPersonal.create({
    data: { ...data, usuarioId },
    include: INCLUDE_INGRESO,
  });
}

export async function actualizarIngresoPersonal(usuarioId, ingresoId, data) {
  const ingreso = await prisma.ingresoPersonal.findUnique({ where: { id: ingresoId } });
  if (!ingreso || ingreso.usuarioId !== usuarioId) {
    throw new HttpError(404, 'Ingreso no encontrado');
  }

  return prisma.ingresoPersonal.update({
    where: { id: ingresoId },
    data,
    include: INCLUDE_INGRESO,
  });
}

export async function eliminarIngresoPersonal(usuarioId, ingresoId) {
  const ingreso = await prisma.ingresoPersonal.findUnique({ where: { id: ingresoId } });
  if (!ingreso || ingreso.usuarioId !== usuarioId) {
    throw new HttpError(404, 'Ingreso no encontrado');
  }
  if (ingreso.origenConfigId) {
    throw new HttpError(
      409,
      'Este ingreso viene de un concepto fijo — desactiva el concepto en vez de eliminar esta ocurrencia (si no, volvería a generarse)',
    );
  }

  await prisma.ingresoPersonal.delete({ where: { id: ingresoId } });
}
