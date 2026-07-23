import { prisma } from '../../config/prisma.js';
import { calcularPeriodoActual, calcularPeriodoAnterior, dentroDelRango } from '../../utils/cicloPersonal.js';

const MESES_VENTANA = 6;

function claveMes(fecha) {
  const d = new Date(fecha);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function sumarMontos(items) {
  return items.reduce((acc, i) => acc + i.monto, 0);
}

/**
 * Resumen del panel personal: reemplaza el antiguo dashboard de Fase 6.
 * `disponible` es histórico (sin período) — "cuánto tengo ahora"; `neto` sí
 * usa el ciclo configurable (`Usuario.frecuenciaCicloPersonal`) para comparar
 * el período en curso contra el anterior. Ver Modulo_Panel_Personal_Ajustes.md
 * sección 5.
 */
export async function obtenerResumenPersonal(usuarioActual) {
  const usuarioId = usuarioActual.id;

  const [gastosPagados, ingresosRecibidos, gastosPendientes, ingresosPendientes] = await Promise.all([
    prisma.gastoPersonal.findMany({
      where: { usuarioId, estado: 'pagado' },
      include: { categoria: true },
      orderBy: { fecha: 'asc' },
    }),
    prisma.ingresoPersonal.findMany({
      where: { usuarioId, estado: 'recibido' },
      orderBy: { fecha: 'asc' },
    }),
    prisma.gastoPersonal.findMany({
      where: { usuarioId, estado: 'pendiente' },
      include: { categoria: true },
    }),
    prisma.ingresoPersonal.findMany({ where: { usuarioId, estado: 'pendiente' } }),
  ]);

  const disponible = sumarMontos(ingresosRecibidos) - sumarMontos(gastosPagados);

  const frecuencia = usuarioActual.frecuenciaCicloPersonal;
  const periodoActual = calcularPeriodoActual(frecuencia);
  const periodoAnterior = calcularPeriodoAnterior(frecuencia);

  const netoEnRango = (rango) => {
    const ingresos = sumarMontos(ingresosRecibidos.filter((i) => dentroDelRango(i.fecha, rango)));
    const gastos = sumarMontos(gastosPagados.filter((g) => dentroDelRango(g.fecha, rango)));
    return ingresos - gastos;
  };
  const netoActual = netoEnRango(periodoActual);
  const netoAnterior = netoEnRango(periodoAnterior);
  const variacionPct = netoAnterior
    ? ((netoActual - netoAnterior) / Math.abs(netoAnterior)) * 100
    : null;

  const compromisosPendientes = [
    ...gastosPendientes.map((g) => ({
      tipo: 'gasto',
      id: g.id,
      monto: g.monto,
      fecha: g.fecha,
      descripcion: g.descripcion,
      categoria: g.categoria?.nombre ?? null,
      esObligatorio: g.esObligatorio,
    })),
    ...ingresosPendientes.map((i) => ({
      tipo: 'ingreso',
      id: i.id,
      monto: i.monto,
      fecha: i.fecha,
    })),
  ].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  // Serie mensual + desglose por categoría, igual que el dashboard de Fase 6.
  const totalesPorMes = new Map();
  for (const gasto of gastosPagados) {
    const clave = claveMes(gasto.fecha);
    totalesPorMes.set(clave, (totalesPorMes.get(clave) ?? 0) + gasto.monto);
  }
  const mesesConDatos = [...totalesPorMes.keys()].sort();
  const ultimosMeses = mesesConDatos.slice(-MESES_VENTANA);
  const serieMensual = ultimosMeses.map((periodo) => ({
    periodo,
    total: totalesPorMes.get(periodo),
  }));

  const desdeVentana = ultimosMeses[0];
  const gastosVentana = desdeVentana
    ? gastosPagados.filter((g) => claveMes(g.fecha) >= desdeVentana)
    : gastosPagados;
  const totalesPorCategoria = new Map();
  for (const gasto of gastosVentana) {
    const categoria = gasto.categoria?.nombre || 'Sin categoría';
    totalesPorCategoria.set(categoria, (totalesPorCategoria.get(categoria) ?? 0) + gasto.monto);
  }
  const porCategoria = [...totalesPorCategoria.entries()]
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total);

  return {
    disponible,
    neto: {
      actual: netoActual,
      anterior: netoAnterior,
      variacionPct,
      periodoActualInicio: periodoActual.inicio,
      periodoActualFin: periodoActual.fin,
    },
    compromisosPendientes,
    serieMensual,
    porCategoria,
  };
}
