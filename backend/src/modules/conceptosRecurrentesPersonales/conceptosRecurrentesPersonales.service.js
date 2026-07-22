import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';

async function requireConceptoDelUsuario(usuarioId, conceptoId) {
  const concepto = await prisma.conceptoRecurrentePersonal.findUnique({ where: { id: conceptoId } });
  if (!concepto || concepto.usuarioId !== usuarioId) {
    throw new HttpError(404, 'Concepto no encontrado');
  }
  return concepto;
}

export function listarConceptos(usuarioActual) {
  return prisma.conceptoRecurrentePersonal.findMany({
    where: { usuarioId: usuarioActual.id },
    include: { puntosCorte: { include: { puntoCorte: true } } },
    orderBy: { creadoEn: 'asc' },
  });
}

export function crearConcepto(usuarioActual, data) {
  return prisma.conceptoRecurrentePersonal.create({
    data: {
      usuarioId: usuarioActual.id,
      nombre: data.nombre,
      categoria: data.categoria ?? null,
      tipoMonto: data.tipoMonto,
      montoDefault: data.tipoMonto === 'fijo' ? data.montoDefault : null,
    },
  });
}

export async function actualizarConcepto(usuarioActual, conceptoId, data) {
  const concepto = await requireConceptoDelUsuario(usuarioActual.id, conceptoId);

  const tipoMontoFinal = data.tipoMonto ?? concepto.tipoMonto;
  const montoDefaultFinal = data.montoDefault === undefined ? concepto.montoDefault : data.montoDefault;
  if (tipoMontoFinal === 'fijo' && montoDefaultFinal == null) {
    throw new HttpError(400, 'Los conceptos de monto fijo requieren montoDefault');
  }

  return prisma.conceptoRecurrentePersonal.update({
    where: { id: conceptoId },
    data: {
      nombre: data.nombre ?? undefined,
      categoria: data.categoria === undefined ? undefined : data.categoria,
      activo: data.activo ?? undefined,
      tipoMonto: data.tipoMonto ?? undefined,
      montoDefault: tipoMontoFinal === 'variable' ? null : montoDefaultFinal,
    },
  });
}

export async function eliminarConcepto(usuarioActual, conceptoId) {
  await requireConceptoDelUsuario(usuarioActual.id, conceptoId);

  const tieneInstancias = await prisma.gastoRecurrentePersonalInstancia.count({ where: { conceptoId } });
  if (tieneInstancias) {
    throw new HttpError(
      409,
      'Este concepto ya tiene gastos registrados en algún período — desactívalo en vez de eliminarlo, para no perder ese historial',
    );
  }

  await prisma.$transaction([
    prisma.conceptoPuntoCortePersonal.deleteMany({ where: { conceptoId } }),
    prisma.conceptoRecurrentePersonal.delete({ where: { id: conceptoId } }),
  ]);
}

export async function asignarPuntosCorte(usuarioActual, conceptoId, puntoCorteIds) {
  const usuarioId = usuarioActual.id;
  await requireConceptoDelUsuario(usuarioId, conceptoId);

  if (puntoCorteIds.length) {
    const puntosValidos = await prisma.puntoCortePersonal.count({
      where: { id: { in: puntoCorteIds }, usuarioId },
    });
    if (puntosValidos !== puntoCorteIds.length) {
      throw new HttpError(400, 'Uno de los puntos de corte no te pertenece');
    }
  }

  await prisma.$transaction([
    prisma.conceptoPuntoCortePersonal.deleteMany({ where: { conceptoId } }),
    ...(puntoCorteIds.length
      ? [
          prisma.conceptoPuntoCortePersonal.createMany({
            data: puntoCorteIds.map((puntoCorteId) => ({ conceptoId, puntoCorteId })),
          }),
        ]
      : []),
  ]);

  return prisma.conceptoRecurrentePersonal.findUnique({
    where: { id: conceptoId },
    include: { puntosCorte: { include: { puntoCorte: true } } },
  });
}
