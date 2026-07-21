import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';

function requireHogarId(usuarioActual) {
  if (!usuarioActual.hogarId) {
    throw new HttpError(409, 'No perteneces a ningún hogar todavía');
  }
  return usuarioActual.hogarId;
}

function requirePermisoEdicion(usuarioActual) {
  if (!usuarioActual.esAdmin && !usuarioActual.puedeEditarGastos) {
    throw new HttpError(403, 'No tienes permiso para editar los conceptos del hogar');
  }
}

async function requireConceptoDelHogar(hogarId, conceptoId) {
  const concepto = await prisma.conceptoRecurrentePareja.findUnique({ where: { id: conceptoId } });
  if (!concepto || concepto.hogarId !== hogarId) {
    throw new HttpError(404, 'Concepto no encontrado');
  }
  return concepto;
}

export function listarConceptos(usuarioActual) {
  const hogarId = requireHogarId(usuarioActual);
  return prisma.conceptoRecurrentePareja.findMany({
    where: { hogarId },
    include: { puntosCorte: { include: { puntoCorte: true } } },
    orderBy: { creadoEn: 'asc' },
  });
}

export async function crearConcepto(usuarioActual, data) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);

  return prisma.conceptoRecurrentePareja.create({
    data: {
      hogarId,
      nombre: data.nombre,
      tipoMonto: data.tipoMonto,
      montoDefault: data.tipoMonto === 'fijo' ? data.montoDefault : null,
    },
  });
}

export async function actualizarConcepto(usuarioActual, conceptoId, data) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);
  await requireConceptoDelHogar(hogarId, conceptoId);

  return prisma.conceptoRecurrentePareja.update({
    where: { id: conceptoId },
    data: {
      nombre: data.nombre ?? undefined,
      activo: data.activo ?? undefined,
      tipoMonto: data.tipoMonto ?? undefined,
      montoDefault: data.montoDefault === undefined ? undefined : data.montoDefault,
    },
  });
}

export async function asignarPuntosCorte(usuarioActual, conceptoId, puntoCorteIds) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);
  await requireConceptoDelHogar(hogarId, conceptoId);

  if (puntoCorteIds.length) {
    const puntosValidos = await prisma.puntoCorteHogar.count({
      where: { id: { in: puntoCorteIds }, hogarId },
    });
    if (puntosValidos !== puntoCorteIds.length) {
      throw new HttpError(400, 'Uno de los puntos de corte no pertenece a tu hogar');
    }
  }

  await prisma.$transaction([
    prisma.conceptoPuntoCorte.deleteMany({ where: { conceptoId } }),
    ...(puntoCorteIds.length
      ? [
          prisma.conceptoPuntoCorte.createMany({
            data: puntoCorteIds.map((puntoCorteId) => ({ conceptoId, puntoCorteId })),
          }),
        ]
      : []),
  ]);

  return prisma.conceptoRecurrentePareja.findUnique({
    where: { id: conceptoId },
    include: { puntosCorte: { include: { puntoCorte: true } } },
  });
}
