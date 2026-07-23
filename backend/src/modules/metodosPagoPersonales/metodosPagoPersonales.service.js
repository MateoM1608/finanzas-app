import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';

async function requireMetodoDelUsuario(usuarioId, id) {
  const metodo = await prisma.metodoPagoPersonal.findUnique({ where: { id } });
  if (!metodo || metodo.usuarioId !== usuarioId) {
    throw new HttpError(404, 'Método de pago no encontrado');
  }
  return metodo;
}

export function listarMetodosPago(usuarioActual) {
  return prisma.metodoPagoPersonal.findMany({
    where: { usuarioId: usuarioActual.id },
    orderBy: { nombre: 'asc' },
  });
}

export function crearMetodoPago(usuarioActual, data) {
  return prisma.metodoPagoPersonal.create({
    data: { usuarioId: usuarioActual.id, nombre: data.nombre },
  });
}

export async function actualizarMetodoPago(usuarioActual, id, data) {
  await requireMetodoDelUsuario(usuarioActual.id, id);
  return prisma.metodoPagoPersonal.update({ where: { id }, data: { nombre: data.nombre } });
}

export async function eliminarMetodoPago(usuarioActual, id) {
  await requireMetodoDelUsuario(usuarioActual.id, id);

  const [gastos, ingresos, gastosFijos] = await Promise.all([
    prisma.gastoPersonal.count({ where: { metodoPagoId: id } }),
    prisma.ingresoPersonal.count({ where: { metodoPagoId: id } }),
    prisma.gastoFijoConfig.count({ where: { metodoPagoIdDefault: id } }),
  ]);
  if (gastos || ingresos || gastosFijos) {
    throw new HttpError(409, 'Este método de pago ya está en uso — no se puede eliminar');
  }

  await prisma.metodoPagoPersonal.delete({ where: { id } });
}
