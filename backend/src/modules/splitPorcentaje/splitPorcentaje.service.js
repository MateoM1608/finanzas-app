import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { hoyUTC } from '../../utils/fechas.js';

function requireHogarId(usuarioActual) {
  if (!usuarioActual.hogarId) {
    throw new HttpError(409, 'No perteneces a ningún hogar todavía');
  }
  return usuarioActual.hogarId;
}

function requirePermisoEdicion(usuarioActual) {
  if (!usuarioActual.esAdmin && !usuarioActual.puedeEditarGastos) {
    throw new HttpError(403, 'No tienes permiso para editar el split del hogar');
  }
}

function inicioDeHoy() {
  return hoyUTC();
}

export async function obtenerSplitVigente(usuarioActual, contexto = 'general') {
  const hogarId = requireHogarId(usuarioActual);

  const ultimo = await prisma.splitPorcentajeMiembro.findFirst({
    where: { hogarId, contexto, periodoInicio: { lte: hoyUTC() } },
    orderBy: { periodoInicio: 'desc' },
  });

  if (!ultimo) return [];

  return prisma.splitPorcentajeMiembro.findMany({
    where: { hogarId, contexto, periodoInicio: ultimo.periodoInicio },
    include: { usuario: { select: { id: true, nombre: true, usuario: true } } },
  });
}

export async function actualizarSplit(usuarioActual, splits, contexto = 'general') {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);

  const idsUnicos = new Set(splits.map((s) => s.usuarioId));
  if (idsUnicos.size !== splits.length) {
    throw new HttpError(400, 'No repitas el mismo usuario en el split');
  }

  const suma = splits.reduce((acc, s) => acc + s.porcentaje, 0);
  if (Math.abs(suma - 100) > 0.01) {
    throw new HttpError(400, `Los porcentajes deben sumar 100% (suma actual: ${suma}%)`);
  }

  const miembros = await prisma.usuario.findMany({ where: { hogarId }, select: { id: true } });
  const idsValidos = new Set(miembros.map((m) => m.id));
  for (const s of splits) {
    if (!idsValidos.has(s.usuarioId)) {
      throw new HttpError(400, 'Uno de los usuarios no pertenece a tu hogar');
    }
  }

  const periodoInicio = inicioDeHoy();

  await prisma.$transaction([
    prisma.splitPorcentajeMiembro.deleteMany({ where: { hogarId, periodoInicio, contexto } }),
    prisma.splitPorcentajeMiembro.createMany({
      data: splits.map((s) => ({
        hogarId,
        usuarioId: s.usuarioId,
        porcentaje: s.porcentaje,
        periodoInicio,
        contexto,
      })),
    }),
  ]);

  return obtenerSplitVigente(usuarioActual, contexto);
}
