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

/** Los retiros de inversiones y metas del hogar se manejan desde allí. */
function requireNoEsRetiro(ingreso) {
  if (['retiro_inversion', 'retiro_meta_hogar', 'retiro_ahorro'].includes(ingreso.origen)) {
    throw new HttpError(409, 'Este ingreso es un retiro de un ahorro, inversión o meta: quítalo desde allí');
  }
}

export async function actualizarIngresoPersonal(usuarioId, ingresoId, data) {
  const ingreso = await prisma.ingresoPersonal.findUnique({ where: { id: ingresoId } });
  if (!ingreso || ingreso.usuarioId !== usuarioId) {
    throw new HttpError(404, 'Ingreso no encontrado');
  }
  if (ingreso.origen === 'liquidacion_hogar') {
    throw new HttpError(409, 'Este ingreso es el reintegro de un cuadre del hogar y no se puede cambiar');
  }
  requireNoEsRetiro(ingreso);

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
  if (ingreso.origen === 'liquidacion_hogar') {
    throw new HttpError(409, 'Este ingreso es el reintegro de un cuadre del hogar y no se puede eliminar');
  }
  requireNoEsRetiro(ingreso);
  if (ingreso.origenConfigId) {
    throw new HttpError(
      409,
      'Este ingreso viene de un concepto fijo — desactiva el concepto en vez de eliminar esta ocurrencia (si no, volvería a generarse)',
    );
  }

  await prisma.ingresoPersonal.delete({ where: { id: ingresoId } });
}

async function requireMetodoPropio(usuarioId, metodoPagoId) {
  if (!metodoPagoId) return null;
  const metodo = await prisma.metodoPagoPersonal.findUnique({ where: { id: metodoPagoId } });
  if (!metodo || metodo.usuarioId !== usuarioId) {
    throw new HttpError(400, 'Método de pago no encontrado');
  }
  return metodoPagoId;
}

/** Cambia SOLO el método de un ingreso propio (ej. dónde entró el reintegro de un cuadre). */
export async function cambiarMetodoIngresoPersonal(usuarioId, ingresoId, metodoPagoId) {
  const ingreso = await prisma.ingresoPersonal.findUnique({ where: { id: ingresoId } });
  if (!ingreso || ingreso.usuarioId !== usuarioId) {
    throw new HttpError(404, 'Ingreso no encontrado');
  }
  const metodo = await requireMetodoPropio(usuarioId, metodoPagoId);
  return prisma.ingresoPersonal.update({ where: { id: ingresoId }, data: { metodoPagoId: metodo }, include: INCLUDE_INGRESO });
}
