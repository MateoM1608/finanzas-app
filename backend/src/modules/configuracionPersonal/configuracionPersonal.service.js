import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { puntosCorteDefault } from '../../utils/puntosCorteDefault.js';

export async function obtenerConfiguracion(usuarioActual) {
  const puntosCorte = await prisma.puntoCortePersonal.findMany({
    where: { usuarioId: usuarioActual.id },
    orderBy: { orden: 'asc' },
  });
  return { frecuenciaCortePersonal: usuarioActual.frecuenciaCortePersonal, puntosCorte };
}

export async function actualizarFrecuencia(usuarioActual, frecuenciaCortePersonal) {
  const usuarioId = usuarioActual.id;
  const cambia = frecuenciaCortePersonal !== usuarioActual.frecuenciaCortePersonal;

  return prisma.$transaction(async (tx) => {
    if (cambia) {
      const puntosExistentes = await tx.puntoCortePersonal.findMany({ where: { usuarioId } });
      const puntoIds = puntosExistentes.map((p) => p.id);
      await tx.conceptoPuntoCortePersonal.deleteMany({ where: { puntoCorteId: { in: puntoIds } } });
      await tx.puntoCortePersonal.deleteMany({ where: { usuarioId } });
      await tx.puntoCortePersonal.createMany({
        data: puntosCorteDefault(frecuenciaCortePersonal).map((p) => ({ ...p, usuarioId })),
      });
    }

    await tx.usuario.update({ where: { id: usuarioId }, data: { frecuenciaCortePersonal } });

    const puntosCorte = await tx.puntoCortePersonal.findMany({
      where: { usuarioId },
      orderBy: { orden: 'asc' },
    });

    return { frecuenciaCortePersonal, puntosCorte };
  });
}

export async function actualizarPuntosCorte(usuarioActual, puntos) {
  const usuarioId = usuarioActual.id;
  const existentes = await prisma.puntoCortePersonal.findMany({ where: { usuarioId } });
  const existentesIds = new Set(existentes.map((p) => p.id));

  for (const punto of puntos) {
    if (!existentesIds.has(punto.id)) {
      throw new HttpError(400, 'Uno de los puntos de corte no te pertenece');
    }
  }

  await prisma.$transaction(
    puntos.map((punto) =>
      prisma.puntoCortePersonal.update({
        where: { id: punto.id },
        data: { referencia: punto.referencia },
      }),
    ),
  );

  return prisma.puntoCortePersonal.findMany({ where: { usuarioId }, orderBy: { orden: 'asc' } });
}
