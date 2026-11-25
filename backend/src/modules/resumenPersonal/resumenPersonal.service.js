import { prisma } from '../../config/prisma.js';
import { calcularPeriodoPorIndice, dentroDelRango } from '../../utils/cicloPersonal.js';
import { asegurarInstanciasFijasPersonales } from '../../utils/instanciasFijasPersonales.js';
import { gastosDeConsumo, ingresosReales } from '../../utils/consumo.js';
import { valorInversionesDe } from '../inversiones/inversiones.service.js';
import { misAportesEnMetas } from '../metasHogar/metasHogar.service.js';
import { deudaPrestamosDe } from '../prestamos/prestamos.service.js';

const MESES_VENTANA = 6;

function claveMes(fecha) {
  // Fechas de calendario guardadas como medianoche UTC: leerlas en UTC (en
  // hora de Colombia el día 1 caía en el mes anterior).
  const d = new Date(fecha);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function sumarMontos(items) {
  return items.reduce((acc, i) => acc + i.monto, 0);
}

/**
 * Resumen del panel personal: reemplaza el antiguo dashboard de Fase 6.
 * `ciclo` es el índice relativo del ciclo consultado (0 = actual, -1 = el
 * anterior…, Etapa 6), según `Usuario.frecuenciaCicloPersonal`:
 * - `disponible` (caja) es histórico: en el actual, "cuánto tengo ahora";
 *   en un ciclo pasado, el saldo al cierre de ese ciclo (igual la deuda de
 *   tarjetas).
 * - `neto` compara ese ciclo contra el anterior a él.
 * - `compromisosPendientes`: en el actual, lo pendiente hasta el fin del
 *   ciclo; en uno pasado, lo de ese ciclo que sigue sin pagar/recibir.
 * - `serieMensual`: los últimos meses hasta el mes en que termina el ciclo;
 *   `porCategoria`: solo ese ciclo.
 * Ver Modulo_Panel_Personal_Ajustes.md secciones 5 y 7.4.
 */
export async function obtenerResumenPersonal(usuarioActual, indiceCiclo = 0) {
  const usuarioId = usuarioActual.id;
  await asegurarInstanciasFijasPersonales(usuarioId);

  const frecuencia = usuarioActual.frecuenciaCicloPersonal;
  const periodoActual = calcularPeriodoPorIndice(frecuencia, indiceCiclo);
  const periodoAnterior = calcularPeriodoPorIndice(frecuencia, indiceCiclo - 1);
  const esActual = indiceCiclo === 0;
  const finCiclo = periodoActual.fin;
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
        OR: [{ fecha: { lte: finCiclo } }, { compraId: null, prestamoId: null, origen: { not: 'pago_hogar' } }],
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
  // En un ciclo pasado: solo lo que había pasado hasta su último día.
  const hastaCierre = (items) => (esActual ? items : items.filter((m) => new Date(m.fecha) <= finCiclo));
  const gastosCaja = hastaCierre(gastosPagados);
  const conTarjeta = (g) => g.metodoPago?.tipo === 'tarjeta_credito';
  const disponible = sumarMontos(hastaCierre(ingresosRecibidos)) - sumarMontos(gastosCaja.filter((g) => !conTarjeta(g)));
  const cargosTarjeta = sumarMontos(gastosCaja.filter(conTarjeta));
  const pagosTarjeta = sumarMontos(gastosCaja.filter((g) => g.origen === 'pago_tarjeta'));
  const deudaTarjetas = cargosTarjeta - pagosTarjeta;

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

  const delCiclo = (items) => (esActual ? items : items.filter((m) => dentroDelRango(m.fecha, periodoActual)));
  const compromisosPendientes = [
    ...delCiclo(gastosPendientes).map((g) => ({
      tipo: 'gasto',
      id: g.id,
      monto: g.monto,
      fecha: g.fecha,
      descripcion: g.descripcion,
      categoria: g.categoria?.nombre ?? null,
      esObligatorio: g.esObligatorio,
    })),
    ...delCiclo(ingresosPendientes).map((i) => ({
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
  const mesCierre = claveMes(finCiclo);
  const mesesConDatos = [...totalesPorMes.keys()].filter((m) => m <= mesCierre).sort();
  const ultimosMeses = mesesConDatos.slice(-MESES_VENTANA);
  const serieMensual = ultimosMeses.map((periodo) => ({
    periodo,
    total: totalesPorMes.get(periodo),
  }));

  const totalesPorCategoria = new Map();
  for (const gasto of consumo.filter((g) => dentroDelRango(g.fecha, periodoActual))) {
    const categoria = gasto.categoria || 'Sin categoría';
    totalesPorCategoria.set(categoria, (totalesPorCategoria.get(categoria) ?? 0) + gasto.monto);
  }
  const porCategoria = [...totalesPorCategoria.entries()]
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total);

  // Patrimonio (solo en el ciclo actual): lo que tengo menos lo que debo.
  let patrimonio = null;
  if (esActual) {
    const [inversiones, metasHogar, prestamos] = await Promise.all([
      valorInversionesDe(usuarioActual),
      misAportesEnMetas(usuarioActual),
      deudaPrestamosDe(usuarioActual),
    ]);
    patrimonio = {
      total: disponible + inversiones + metasHogar - deudaTarjetas - prestamos,
      disponible,
      inversiones,
      metasHogar,
      deudaTarjetas,
      prestamos,
    };
  }

  return {
    ciclo: { indice: indiceCiclo, frecuencia, inicio: periodoActual.inicio, fin: periodoActual.fin },
    patrimonio,
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
