import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { calcularFechasPendientes } from '../../utils/instanciasFijas.js';

const INCLUDE_INGRESO = {
  metodoPago: true,
  categoria: true,
};

/** Mismo mecanismo que gastosPersonales.service.js#asegurarInstanciasFijas. */
async function asegurarInstanciasFijas(usuarioId) {
  const configs = await prisma.ingresoFijoConfig.findMany({ where: { usuarioId, activo: true } });
  if (!configs.length) return;

  const hoy = new Date();
  for (const config of configs) {
    const fechas = calcularFechasPendientes(config.fechaInicio, config.frecuencia, hoy);

    const existentes = await prisma.ingresoPersonal.findMany({
      where: { origenConfigId: config.id },
      select: { fecha: true },
    });
    const fechasExistentes = new Set(existentes.map((i) => i.fecha.getTime()));
    const nuevas = fechas.filter((f) => !fechasExistentes.has(f.getTime()));
    if (!nuevas.length) continue;

    await prisma.ingresoPersonal.createMany({
      data: nuevas.map((fecha) => ({
        usuarioId,
        origenConfigId: config.id,
        monto: config.monto,
        fecha,
        estado: config.modo === 'automatico' ? 'recibido' : 'pendiente',
        categoriaId: config.categoriaId,
        origen: 'app',
      })),
    });
  }
}

export async function listarIngresosPersonales(usuarioId) {
  await asegurarInstanciasFijas(usuarioId);
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
