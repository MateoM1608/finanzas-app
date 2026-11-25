import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { hoyUTC } from '../../utils/fechas.js';
import {
  CLAVE_PRESTAMOS,
  CLAVE_SIN_CATEGORIA,
  claveDeMes,
  finDeMes,
  gastoPorCategoria,
  inicioDeMes,
  resumenTopes,
} from '../../utils/topesHogar.js';

/**
 * Categorías del hogar (compartidas por los miembros) y topes mensuales de
 * gasto (entrega E4). Crear, editar o borrar necesita permiso de editar los
 * gastos del hogar; verlas, solo ser miembro.
 */
export const CATEGORIAS_BASICAS = ['Mercado', 'Servicios', 'Arriendo', 'Salidas', 'Transporte', 'Mascotas', 'Salud', 'Otros'];

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

async function requireCategoria(hogarId, id) {
  const categoria = await prisma.categoriaHogar.findUnique({ where: { id } });
  if (!categoria || categoria.hogarId !== hogarId) throw new HttpError(404, 'Categoría no encontrada');
  return categoria;
}

async function requireTope(hogarId, id) {
  const tope = await prisma.topeHogar.findUnique({ where: { id } });
  if (!tope || tope.hogarId !== hogarId) throw new HttpError(404, 'Tope no encontrado');
  return tope;
}

function nombreRepetido(error) {
  if (error?.code === 'P2002') throw new HttpError(409, 'Ya existe una categoría con ese nombre');
  throw error;
}

// --- Categorías ---

export async function listarCategorias(usuarioActual) {
  const hogarId = requireHogarId(usuarioActual);
  const categorias = await prisma.categoriaHogar.findMany({
    where: { hogarId },
    include: { _count: { select: { gastosVariables: true, cuentasFijas: true, comprasCuotas: true, topes: true } } },
    orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
  });
  return categorias.map(({ _count, ...c }) => ({
    ...c,
    usos: _count.gastosVariables + _count.cuentasFijas + _count.comprasCuotas + _count.topes,
  }));
}

export async function crearCategoria(usuarioActual, { nombre }) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);
  return prisma.categoriaHogar.create({ data: { hogarId, nombre } }).catch(nombreRepetido);
}

/** Crea las categorías básicas que falten (para empezar rápido). */
export async function crearCategoriasBasicas(usuarioActual) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);
  await prisma.categoriaHogar.createMany({
    data: CATEGORIAS_BASICAS.map((nombre) => ({ hogarId, nombre })),
    skipDuplicates: true,
  });
  return listarCategorias(usuarioActual);
}

export async function actualizarCategoria(usuarioActual, id, data) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);
  await requireCategoria(hogarId, id);
  const categoria = await prisma.categoriaHogar
    .update({ where: { id }, data: { nombre: data.nombre ?? undefined, activo: data.activo ?? undefined } })
    .catch(nombreRepetido);
  // Desactivar la categoría desactiva también sus topes.
  if (data.activo === false) await prisma.topeHogar.updateMany({ where: { categoriaId: id }, data: { activo: false } });
  return categoria;
}

/** Solo se borra si nada la usa; si no, se desactiva (no desaparece de lo ya registrado). */
export async function eliminarCategoria(usuarioActual, id) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);
  await requireCategoria(hogarId, id);
  const [gastos, cuentas, compras, topes] = await Promise.all([
    prisma.gastoVariablePareja.count({ where: { categoriaId: id } }),
    prisma.conceptoRecurrentePareja.count({ where: { categoriaId: id } }),
    prisma.compraCuotasHogar.count({ where: { categoriaId: id } }),
    prisma.topeHogar.count({ where: { categoriaId: id } }),
  ]);
  if (gastos + cuentas + compras + topes) {
    throw new HttpError(409, 'Esta categoría ya se usa en gastos, cuentas o topes: desactívala en lugar de eliminarla');
  }
  await prisma.categoriaHogar.delete({ where: { id } });
}

/** Valida que una categoría (opcional) sea del hogar y esté activa, o ya fuera la del registro. */
export async function validarCategoriaHogar(hogarId, categoriaId, categoriaActualId = null) {
  if (!categoriaId) return null;
  if (categoriaId === categoriaActualId) return categoriaId;
  const categoria = await prisma.categoriaHogar.findUnique({ where: { id: categoriaId } });
  if (!categoria || categoria.hogarId !== hogarId) throw new HttpError(400, 'Esa categoría no es de tu hogar');
  if (!categoria.activo) throw new HttpError(400, 'Esa categoría está desactivada');
  return categoriaId;
}

// --- Topes ---

export async function listarTopes(usuarioActual) {
  const hogarId = requireHogarId(usuarioActual);
  return prisma.topeHogar.findMany({
    where: { hogarId },
    include: { categoria: { select: { id: true, nombre: true, activo: true } } },
    orderBy: [{ activo: 'desc' }, { creadoEn: 'asc' }],
  });
}

async function validarTopeUnico(hogarId, categoriaId, excluirId = null) {
  const repetido = await prisma.topeHogar.count({
    where: { hogarId, categoriaId: categoriaId ?? null, activo: true, ...(excluirId && { id: { not: excluirId } }) },
  });
  if (repetido) {
    throw new HttpError(409, categoriaId ? 'Esa categoría ya tiene un tope activo' : 'Ya hay un tope activo para el total del hogar');
  }
}

export async function crearTope(usuarioActual, data) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);
  const categoriaId = await validarCategoriaHogar(hogarId, data.categoriaId ?? null);
  await validarTopeUnico(hogarId, categoriaId);
  return prisma.topeHogar.create({
    data: { hogarId, categoriaId, montoMensual: data.montoMensual },
    include: { categoria: { select: { id: true, nombre: true, activo: true } } },
  });
}

export async function actualizarTope(usuarioActual, id, data) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);
  const tope = await requireTope(hogarId, id);
  if (data.activo === true && !tope.activo) {
    if (tope.categoriaId) await validarCategoriaHogar(hogarId, tope.categoriaId);
    await validarTopeUnico(hogarId, tope.categoriaId, id);
  }
  return prisma.topeHogar.update({
    where: { id },
    data: { montoMensual: data.montoMensual ?? undefined, activo: data.activo ?? undefined },
    include: { categoria: { select: { id: true, nombre: true, activo: true } } },
  });
}

export async function eliminarTope(usuarioActual, id) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);
  await requireTope(hogarId, id);
  // Sus fotos por mes se borran con él (cascade).
  await prisma.topeHogar.delete({ where: { id } });
}

export function obtenerResumenTopes(usuarioActual) {
  return resumenTopes(requireHogarId(usuarioActual));
}

/**
 * Gasto del hogar por categoría en un mes (por defecto el actual): lo pagado
 * con fecha hasta hoy, ordenado de mayor a menor, con su porcentaje.
 */
export async function obtenerGastoPorCategoria(usuarioActual, mesTexto) {
  const hogarId = requireHogarId(usuarioActual);
  const hoy = hoyUTC();
  let mes = inicioDeMes(hoy);
  if (mesTexto) {
    const [a, m] = mesTexto.split('-').map(Number);
    const pedido = new Date(Date.UTC(a, m - 1, 1));
    if (Number.isNaN(pedido.getTime()) || pedido > mes) throw new HttpError(400, 'Mes inválido');
    mes = pedido;
  }
  const [{ gastado }, categorias] = await Promise.all([
    gastoPorCategoria(hogarId, mes, finDeMes(mes), { hoy }),
    prisma.categoriaHogar.findMany({ where: { hogarId }, select: { id: true, nombre: true } }),
  ]);
  const nombres = new Map(categorias.map((c) => [c.id, c.nombre]));
  nombres.set(CLAVE_PRESTAMOS, 'Préstamos');
  nombres.set(CLAVE_SIN_CATEGORIA, 'Sin categoría');
  const total = [...gastado.values()].reduce((a, b) => a + b, 0);
  const filas = [...gastado.entries()]
    .filter(([, monto]) => monto > 0)
    .map(([clave, monto]) => ({
      categoriaId: nombres.has(clave) && clave !== CLAVE_PRESTAMOS && clave !== CLAVE_SIN_CATEGORIA ? clave : null,
      clave,
      nombre: nombres.get(clave) ?? 'Sin categoría',
      monto,
      porcentaje: total ? Math.round((monto / total) * 100) : 0,
    }))
    .sort((a, b) => b.monto - a.monto);
  return { mes: claveDeMes(mes), total, categorias: filas };
}
