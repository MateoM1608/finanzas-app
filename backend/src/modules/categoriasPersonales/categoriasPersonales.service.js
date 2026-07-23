import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';

async function requireCategoriaDelUsuario(usuarioId, id) {
  const categoria = await prisma.categoriaPersonal.findUnique({ where: { id } });
  if (!categoria || categoria.usuarioId !== usuarioId) {
    throw new HttpError(404, 'Categoría no encontrada');
  }
  return categoria;
}

export function listarCategorias(usuarioActual) {
  return prisma.categoriaPersonal.findMany({
    where: { usuarioId: usuarioActual.id },
    orderBy: { nombre: 'asc' },
  });
}

export function crearCategoria(usuarioActual, data) {
  return prisma.categoriaPersonal.create({
    data: { usuarioId: usuarioActual.id, nombre: data.nombre, aplicaA: data.aplicaA },
  });
}

export async function actualizarCategoria(usuarioActual, id, data) {
  await requireCategoriaDelUsuario(usuarioActual.id, id);
  return prisma.categoriaPersonal.update({
    where: { id },
    data: {
      nombre: data.nombre ?? undefined,
      aplicaA: data.aplicaA ?? undefined,
    },
  });
}

export async function eliminarCategoria(usuarioActual, id) {
  await requireCategoriaDelUsuario(usuarioActual.id, id);

  const [gastos, ingresos, gastosFijos, ingresosFijos] = await Promise.all([
    prisma.gastoPersonal.count({ where: { categoriaId: id } }),
    prisma.ingresoPersonal.count({ where: { categoriaId: id } }),
    prisma.gastoFijoConfig.count({ where: { categoriaId: id } }),
    prisma.ingresoFijoConfig.count({ where: { categoriaId: id } }),
  ]);
  if (gastos || ingresos || gastosFijos || ingresosFijos) {
    throw new HttpError(409, 'Esta categoría ya está en uso — no se puede eliminar');
  }

  await prisma.categoriaPersonal.delete({ where: { id } });
}
