import { prisma } from '../../config/prisma.js';
import { calcularFechasPendientes } from '../../utils/instanciasFijas.js';
import { fechasDeCuenta, periodoDeCuota } from '../../utils/cuentasFijas.js';
import { obtenerSplitVigente } from '../../utils/reparto.js';
import { hoyUTC } from '../../utils/fechas.js';

/**
 * "Mis próximos meses": lo que el usuario ya tiene comprometido en el mes
 * actual y los siguientes, contra lo que espera recibir. Solo su parte —
 * privado como el resto del panel personal.
 *
 * Comprometido = su parte de las cuentas fijas del hogar + su parte de las
 * cuotas de compras del hogar + sus gastos fijos personales + sus cuotas
 * personales. Los gastos personales que generan los cuadres del hogar
 * (origen cuadre_hogar) NO se suman aparte: son la misma plata que ya se
 * cuenta desde las tablas del hogar.
 */

function claveMes(fecha) {
  const f = new Date(fecha);
  return `${f.getUTCFullYear()}-${String(f.getUTCMonth() + 1).padStart(2, '0')}`;
}

function porcentajeDe(split, usuarioId) {
  return split.find((s) => s.usuarioId === usuarioId)?.porcentaje ?? 0;
}

/**
 * Costo MENSUAL promedio de cada cuenta variable: la suma de lo pagado en
 * cada mes, promediada sobre los últimos `meses` meses COMPLETOS (con todas
 * sus cuotas pagadas: 1 si es mensual, 2 si es quincenal — 3 meses de una
 * quincenal son 6 pagos). Un mes a medio pagar bajaría el promedio, así que
 * solo si todavía no hay ningún mes completo se usan los meses con algún
 * pago, escalando su total al mes completo.
 *
 * `pagadas` viene ordenado por fecha descendente; `cuotasPorMes` da cuántas
 * cuotas tiene al mes cada cuenta.
 */
export function costoMensualPromedio(pagadas, cuotasPorMes, meses) {
  const porConcepto = new Map();
  for (const p of pagadas) {
    const delConcepto = porConcepto.get(p.conceptoId) ?? new Map();
    const mes = claveMes(p.fecha);
    const acumulado = delConcepto.get(mes) ?? { total: 0, cuotas: 0 };
    acumulado.total += p.monto;
    acumulado.cuotas += 1;
    delConcepto.set(mes, acumulado);
    porConcepto.set(p.conceptoId, delConcepto);
  }
  const promedios = new Map();
  for (const [conceptoId, porMes] of porConcepto) {
    const esperadas = cuotasPorMes.get(conceptoId) ?? 1;
    const recientes = [...porMes.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    const completos = recientes.filter(([, m]) => m.cuotas >= esperadas).slice(0, meses);
    const tomados = completos.length
      ? completos.map(([, m]) => m.total)
      : recientes.slice(0, meses).map(([, m]) => (m.total * esperadas) / m.cuotas);
    promedios.set(conceptoId, Math.round(tomados.reduce((a, b) => a + b, 0) / tomados.length));
  }
  return promedios;
}

export async function obtenerProyeccion(usuarioActual, numeroMeses = 6) {
  const usuarioId = usuarioActual.id;
  const hogarId = usuarioActual.hogarId;
  const hoy = hoyUTC();
  const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
  const fin = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + numeroMeses, 0));
  const enVentana = (f) => f >= inicio && f <= fin;

  const meses = new Map();
  for (let i = 0; i < numeroMeses; i += 1) {
    const clave = claveMes(new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + i, 1)));
    meses.set(clave, {
      periodo: clave,
      hogarCuentasFijas: 0,
      hogarCuotas: 0,
      fijosPersonales: 0,
      cuotasPersonales: 0,
      ingresosEsperados: 0,
      estimado: false,
      detalle: [],
    });
  }
  const sumar = (fecha, campo, monto, nombre, { estimado = false, tipo } = {}) => {
    const mes = meses.get(claveMes(fecha));
    if (!mes || !monto) return;
    mes[campo] += monto;
    if (estimado) mes.estimado = true;
    mes.detalle.push({ tipo: tipo ?? campo, nombre, fecha, monto, estimado });
  };

  // --- Personal: gastos fijos (usa el monto real de la fila si ya se generó) ---
  const [configsGasto, gastosDeFijos, cuotasPersonales, configsIngreso, ingresosEnVentana] = await Promise.all([
    prisma.gastoFijoConfig.findMany({ where: { usuarioId, activo: true } }),
    prisma.gastoPersonal.findMany({
      where: { usuarioId, origenConfigId: { not: null }, fecha: { gte: inicio, lte: fin } },
      select: { origenConfigId: true, fecha: true, monto: true },
    }),
    prisma.gastoPersonal.findMany({
      where: { usuarioId, compraId: { not: null }, fecha: { gte: inicio, lte: fin } },
      include: { compra: { select: { numeroCuotas: true } } },
    }),
    prisma.ingresoFijoConfig.findMany({ where: { usuarioId, activo: true } }),
    prisma.ingresoPersonal.findMany({
      where: { usuarioId, fecha: { gte: inicio, lte: fin }, origen: { not: 'liquidacion_hogar' } },
      select: { origenConfigId: true, fecha: true, monto: true, descripcion: true },
    }),
  ]);

  const realGasto = new Map(gastosDeFijos.map((g) => [`${g.origenConfigId}|${g.fecha.getTime()}`, g.monto]));
  for (const config of configsGasto) {
    for (const fecha of calcularFechasPendientes(config.fechaInicio, config.frecuencia, fin).filter(enVentana)) {
      const monto = realGasto.get(`${config.id}|${fecha.getTime()}`) ?? config.monto;
      sumar(fecha, 'fijosPersonales', monto, config.nombre);
    }
  }
  for (const cuota of cuotasPersonales) {
    sumar(cuota.fecha, 'cuotasPersonales', cuota.monto, `${cuota.descripcion ?? 'Compra'} (${cuota.numeroCuota}/${cuota.compra.numeroCuotas})`);
  }

  // --- Ingresos esperados: fijos proyectados + los ya registrados sueltos ---
  const realIngreso = new Map(
    ingresosEnVentana.filter((i) => i.origenConfigId).map((i) => [`${i.origenConfigId}|${i.fecha.getTime()}`, i.monto]),
  );
  for (const config of configsIngreso) {
    for (const fecha of calcularFechasPendientes(config.fechaInicio, config.frecuencia, fin).filter(enVentana)) {
      sumar(fecha, 'ingresosEsperados', realIngreso.get(`${config.id}|${fecha.getTime()}`) ?? config.monto, config.nombre, {
        tipo: 'ingreso',
      });
    }
  }
  for (const ingreso of ingresosEnVentana.filter((i) => !i.origenConfigId)) {
    sumar(ingreso.fecha, 'ingresosEsperados', ingreso.monto, ingreso.descripcion ?? 'Ingreso', { tipo: 'ingreso' });
  }

  // --- Hogar: mi parte de cuentas fijas y de cuotas de compras ---
  if (hogarId) {
    const [conceptos, cuotasCuentas, cuotasCompras, splitActual] = await Promise.all([
      prisma.conceptoRecurrentePareja.findMany({ where: { hogarId, activo: true } }),
      prisma.gastoRecurrenteInstancia.findMany({
        where: { concepto: { hogarId }, fecha: { gte: inicio, lte: fin } },
        include: { repartos: true },
      }),
      prisma.gastoVariablePareja.findMany({
        where: { hogarId, compraId: { not: null }, fecha: { gte: inicio, lte: fin } },
        include: { repartos: true, compra: { select: { numeroCuotas: true } } },
      }),
      obtenerSplitVigente(hogarId, 'general'),
    ]);

    // Cuentas de monto variable sin pagar: se estiman con su COSTO MENSUAL
    // promedio de los últimos 3 meses completos pagados (costoMensualPromedio);
    // cada cuota sin pagar toma la parte que le toca del mes (la mitad, si es
    // quincenal). Se marca como estimado.
    const pagadasVariables = await prisma.gastoRecurrenteInstancia.findMany({
      where: { concepto: { hogarId, tipoMonto: 'variable' }, monto: { not: null }, estado: { not: 'por_pagar' } },
      orderBy: { fecha: 'desc' },
      select: { conceptoId: true, monto: true, fecha: true },
    });
    const cuotasPorMes = new Map(conceptos.map((c) => [c.id, c.frecuencia === 'quincenal' ? 2 : 1]));
    const costoMensual = costoMensualPromedio(pagadasVariables, cuotasPorMes, 3);
    const estimadoPorCuota = new Map(
      [...costoMensual.entries()].map(([id, mensual]) => [id, Math.round(mensual / (cuotasPorMes.get(id) ?? 1))]),
    );
    const cuotaPorClave = new Map(cuotasCuentas.map((c) => [`${c.conceptoId}|${c.fecha.getTime()}`, c]));
    const conceptoPorId = new Map(conceptos.map((c) => [c.id, c]));
    // Un período ya pagado en otra fecha (la cuenta cambió de día) cuenta con ese pago.
    const pagadaPorPeriodo = new Map(
      cuotasCuentas
        .filter((c) => c.estado !== 'por_pagar' && conceptoPorId.has(c.conceptoId))
        .map((c) => [`${c.conceptoId}|${periodoDeCuota(conceptoPorId.get(c.conceptoId), c.fecha)}`, c]),
    );
    const miPorcentaje = porcentajeDe(splitActual, usuarioId);

    for (const concepto of conceptos) {
      for (const fecha of fechasDeCuenta(concepto, fin).filter(enVentana)) {
        const cuota =
          cuotaPorClave.get(`${concepto.id}|${fecha.getTime()}`) ??
          pagadaPorPeriodo.get(`${concepto.id}|${periodoDeCuota(concepto, fecha)}`);
        const miReparto = cuota?.repartos.find((r) => r.usuarioId === usuarioId);
        if (miReparto) {
          sumar(fecha, 'hogarCuentasFijas', miReparto.monto, concepto.nombre);
          continue;
        }
        const montoTotal = cuota?.monto ?? concepto.montoDefault ?? estimadoPorCuota.get(concepto.id) ?? null;
        if (montoTotal == null) continue;
        const estimado = concepto.tipoMonto === 'variable';
        sumar(fecha, 'hogarCuentasFijas', Math.round((montoTotal * miPorcentaje) / 100), concepto.nombre, { estimado });
      }
    }
    for (const cuota of cuotasCompras) {
      const miParte = cuota.repartos.find((r) => r.usuarioId === usuarioId)?.monto ?? 0;
      sumar(cuota.fecha, 'hogarCuotas', miParte, `${cuota.item} (${cuota.numeroCuota}/${cuota.compra.numeroCuotas})`);
    }
  }

  return {
    meses: [...meses.values()].map((m) => {
      const comprometido = m.hogarCuentasFijas + m.hogarCuotas + m.fijosPersonales + m.cuotasPersonales;
      return {
        ...m,
        comprometido,
        libre: m.ingresosEsperados - comprometido,
        detalle: m.detalle.sort((a, b) => new Date(a.fecha) - new Date(b.fecha)),
      };
    }),
  };
}
