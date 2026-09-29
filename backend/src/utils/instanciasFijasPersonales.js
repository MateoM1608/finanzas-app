import { prisma } from '../config/prisma.js';
import { calcularFechasPendientes } from './instanciasFijas.js';
import { hoyUTC } from './fechas.js';

/**
 * Genera (si no existen ya) las ocurrencias de cada gasto fijo activo entre
 * su `fechaInicio` y hoy — directamente como filas reales de GastoPersonal,
 * no como una tabla de "instancia" aparte: acá no hay corte que las convierta
 * en gasto real, la fila generada YA ES el gasto (en estado `pagado` si el
 * cobro es automático, `pendiente` si es manual).
 *
 * `skipDuplicates` se apoya en el único (origenConfigId, fecha): el panel
 * personal dispara varias consultas en paralelo que llaman a esto al mismo
 * tiempo, y sin él la segunda en llegar reventaba con un P2002.
 */
export async function asegurarGastosFijos(usuarioId) {
  const configs = await prisma.gastoFijoConfig.findMany({ where: { usuarioId, activo: true } });
  if (!configs.length) return;

  const hoy = hoyUTC();
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
      skipDuplicates: true,
    });
  }
}

/** Mismo mecanismo que `asegurarGastosFijos`, para ingresos fijos. */
export async function asegurarIngresosFijos(usuarioId) {
  const configs = await prisma.ingresoFijoConfig.findMany({ where: { usuarioId, activo: true } });
  if (!configs.length) return;

  const hoy = hoyUTC();
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
        descripcion: config.nombre,
        estado: config.modo === 'automatico' ? 'recibido' : 'pendiente',
        categoriaId: config.categoriaId,
        origen: 'app',
      })),
      skipDuplicates: true,
    });
  }
}

/**
 * Asegura gastos e ingresos fijos del usuario. Todo cálculo que lea el
 * período (Resumen, Límites, Ahorros) tiene que llamarlo ANTES de consultar:
 * si no, en la primera carga del panel esos cálculos corrían en paralelo con
 * el listado de gastos y veían el período sin los fijos del día todavía
 * generados — y Límites/Ahorros guardaban ese snapshot incompleto.
 */
export async function asegurarInstanciasFijasPersonales(usuarioId) {
  await asegurarGastosFijos(usuarioId);
  await asegurarIngresosFijos(usuarioId);
}
