import { prisma } from '../../config/prisma.js';
import { calcularPeriodoActual, calcularPeriodoAnterior, dentroDelRango } from '../../utils/cicloPersonal.js';
import { asegurarInstanciasFijasPersonales } from '../../utils/instanciasFijasPersonales.js';
import { gastosDeConsumo, ingresosReales } from '../../utils/consumo.js';

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
  await asegurarInstanciasFijasPersonales(usuarioId);

  const finCiclo = calcularPeriodoActual(usuarioActual.frecuenciaCicloPersonal).fin;
  const [gastosPagados, ingresosRecibidos, gastosPendientes, ingresosPendientes, consumo, ingresosSinReintegros] = await Promise.all([
    // Vista de CAJA: todo lo que salió (incluye el 100 % de lo pagado del
    // hogar, los pagos de cuadre y de tarjeta).
    prisma.gastoPersonal.findMany({
      where: { usuarioId, estado: 'pagado' },
      include: { metodoPago: { select: { tipo: true } } },
    }),
    prisma.ingresoPersonal.findMany({
      where: { usuarioId, estado: 'recibido' },
      orderBy: { fecha: 'asc' },
    }),
    // Las cuotas futuras (de compras a cuotas o de pagos del hogar) no se
    // listan acá hasta que entren al ciclo actual: viven en "Mis próximos meses".
    prisma.gastoPersonal.findMany({
      where: {
        usuarioId,
        estado: 'pendiente',
        OR: [{ fecha: { lte: finCiclo } }, { compraId: null, origen: { not: 'pago_hogar' } }],
      },
      include: { categoria: true },
    }),
    prisma.ingresoPersonal.findMany({ where: { usuarioId, estado: 'pendiente' }, include: { categoria: true } }),
    // Vista de CONSUMO: lo que el usuario gastó (su parte del hogar incluida).
    gastosDeConsumo(usuarioId),
    ingresosReales(usuarioId),
  ]);

  // Disponible (caja): lo que entró menos lo que salió. Una compra con
  // tarjeta de crédito no sale de la cuenta hasta que se paga la tarjeta
  // (ese pago es un gasto de origen pago_tarjeta, que sí cuenta).
  const conTarjeta = (g) => g.metodoPago?.tipo === 'tarjeta_credito';
  const disponible = sumarMontos(ingresosRecibidos) - sumarMontos(gastosPagados.filter((g) => !conTarjeta(g)));
  const cargosTarjeta = sumarMontos(gastosPagados.filter(conTarjeta));
  const pagosTarjeta = sumarMontos(gastosPagados.filter((g) => g.origen === 'pago_tarjeta'));
  const deudaTarjetas = cargosTarjeta - pagosTarjeta;

  const frecuencia = usuarioActual.frecuenciaCicloPersonal;
  const periodoActual = calcularPeriodoActual(frecuencia);
  const periodoAnterior = calcularPeriodoAnterior(frecuencia);

  // Neto del ciclo (consumo): ingresos reales menos lo que gastó, con su
  // parte del hogar y sin reintegros de cuadres.
  const netoEnRango = (rango) => {
    const ingresos = sumarMontos(ingresosSinReintegros.filter((i) => dentroDelRango(i.fecha, rango)));
    const gastos = sumarMontos(consumo.filter((g) => dentroDelRango(g.fecha, rango)));
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
      descripcion: i.descripcion,
      categoria: i.categoria?.nombre ?? null,
    })),
  ].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  // Serie mensual + desglose por categoría (consumo: la parte del hogar va
  // en la categoría "Hogar", en el mes de cada gasto).
  const totalesPorMes = new Map();
  for (const gasto of consumo) {
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
  const gastosVentana = desdeVentana ? consumo.filter((g) => claveMes(g.fecha) >= desdeVentana) : consumo;
  const totalesPorCategoria = new Map();
  for (const gasto of gastosVentana) {
    const categoria = gasto.categoria || 'Sin categoría';
    totalesPorCategoria.set(categoria, (totalesPorCategoria.get(categoria) ?? 0) + gasto.monto);
  }
  const porCategoria = [...totalesPorCategoria.entries()]
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total);

  return {
    disponible,
    deudaTarjetas,
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
