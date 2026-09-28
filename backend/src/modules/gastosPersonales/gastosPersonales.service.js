import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { calcularFechasPendientes } from '../../utils/instanciasFijas.js';
import { evaluarPeriodoSiCorresponde } from '../../utils/evaluacionAhorro.js';

const INCLUDE_GASTO = {
  metodoPago: true,
  categoria: true,
};

/**
 * Dispara la evaluación de Ahorros del período que contiene la fecha de este
 * gasto, cuando queda pagado y es obligatorio — ver
 * Modulo_Panel_Personal_Ajustes.md sección 6.4. Es idempotente (no hace nada
 * si ese período ya fue evaluado), así que no importa si se llama de más.
 */
async function evaluarSiObligatorioPagado(gasto) {
  if (gasto.esObligatorio && gasto.estado === 'pagado') {
    await evaluarPeriodoSiCorresponde(gasto.usuarioId, gasto.fecha);
  }
}

/**
 * Genera (si no existen ya) las ocurrencias de cada concepto fijo activo
 * entre su `fechaInicio` y hoy — directamente como filas reales de
 * GastoPersonal, no como una tabla de "instancia" aparte: acá no hay corte
 * que las convierta en gasto real, la fila generada YA ES el gasto (en
 * estado `pagado` si el cobro es automático, `pendiente` si es manual).
 */
async function asegurarInstanciasFijas(usuarioId) {
  const configs = await prisma.gastoFijoConfig.findMany({ where: { usuarioId, activo: true } });
  if (!configs.length) return;

  const hoy = new Date();
  for (const config of configs) {
    const fechas = calcularFechasPendientes(config.fechaInicio, config.frecuencia, hoy);

    const existentes = await prisma.gastoPersonal.findMany({
      where: { origenConfigId: config.id },
      select: { fecha: true },
    });
    const fechasExistentes = new Set(existentes.map((g) => g.fecha.getTime()));
    const nuevas = fechas.filter((f) => !fechasExistentes.has(f.getTime()));
    if (!nuevas.length) continue;

    await prisma.gastoPersonal.createMany({
      data: nuevas.map((fecha) => ({
        usuarioId,
        origenConfigId: config.id,
        monto: config.monto,
        fecha,
        descripcion: config.nombre,
        estado: config.modoCobro === 'automatico' ? 'pagado' : 'pendiente',
        esObligatorio: config.esObligatorio,
        metodoPagoId: config.metodoPagoIdDefault,
        categoriaId: config.categoriaId,
        origen: 'app',
      })),
    });
  }
}

export async function listarGastosPersonales(usuarioId) {
  await asegurarInstanciasFijas(usuarioId);
  return prisma.gastoPersonal.findMany({
    where: { usuarioId },
    include: INCLUDE_GASTO,
    orderBy: { fecha: 'desc' },
  });
}

export async function crearGastoPersonal(usuarioId, data) {
  const gasto = await prisma.gastoPersonal.create({
    data: { ...data, usuarioId },
    include: INCLUDE_GASTO,
  });
  await evaluarSiObligatorioPagado(gasto);
  return gasto;
}

export async function actualizarGastoPersonal(usuarioId, gastoId, data) {
  const gasto = await prisma.gastoPersonal.findUnique({ where: { id: gastoId } });
  if (!gasto || gasto.usuarioId !== usuarioId) {
    throw new HttpError(404, 'Gasto no encontrado');
  }

  const actualizado = await prisma.gastoPersonal.update({
    where: { id: gastoId },
    data,
    include: INCLUDE_GASTO,
  });
  await evaluarSiObligatorioPagado(actualizado);
  return actualizado;
}

export async function eliminarGastoPersonal(usuarioId, gastoId) {
  const gasto = await prisma.gastoPersonal.findUnique({ where: { id: gastoId } });
  if (!gasto || gasto.usuarioId !== usuarioId) {
    throw new HttpError(404, 'Gasto no encontrado');
  }
  if (gasto.origenConfigId) {
    throw new HttpError(
      409,
      'Este gasto viene de un concepto fijo — desactiva el concepto en vez de eliminar esta ocurrencia (si no, volvería a generarse)',
    );
  }
  if (gasto.origenCorteId) {
    throw new HttpError(409, 'Este gasto viene de un corte del hogar ya cerrado — no se puede eliminar');
  }

  await prisma.gastoPersonal.delete({ where: { id: gastoId } });
}
