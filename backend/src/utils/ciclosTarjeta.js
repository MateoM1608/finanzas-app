/**
 * Ciclos de una tarjeta de crédito: cada extracto cubre (corte anterior,
 * corte] y se paga el primer día de pago después del corte. Fechas de
 * calendario como medianoche UTC; un día que el mes no tiene (31 en
 * febrero) cae en su último día.
 */

function enMes(anio, mes, dia) {
  const a = anio + Math.floor(mes / 12);
  const m = ((mes % 12) + 12) % 12;
  const ultimo = new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(a, m, Math.min(dia, ultimo)));
}

/** Corte del mes de `fecha` (aunque sea antes o después de ella). */
export function corteDelMes(fecha, diaCorte) {
  const f = new Date(fecha);
  return enMes(f.getUTCFullYear(), f.getUTCMonth(), diaCorte);
}

/** Primer corte el mismo día o después de `fecha`: el extracto en que entra una compra. */
export function corteQueIncluye(fecha, diaCorte) {
  const f = new Date(fecha);
  const corte = enMes(f.getUTCFullYear(), f.getUTCMonth(), diaCorte);
  return f <= corte ? corte : enMes(f.getUTCFullYear(), f.getUTCMonth() + 1, diaCorte);
}

/** Corte `delta` meses antes (negativo) o después del corte dado. */
export function moverCorte(corte, delta, diaCorte) {
  const c = new Date(corte);
  return enMes(c.getUTCFullYear(), c.getUTCMonth() + delta, diaCorte);
}

/** Fecha límite de pago del extracto de ese corte: el primer día de pago después del corte. */
export function pagoDeCorte(corte, diaPago) {
  if (!diaPago) return null;
  const c = new Date(corte);
  const pago = enMes(c.getUTCFullYear(), c.getUTCMonth(), diaPago);
  return pago > corte ? pago : enMes(c.getUTCFullYear(), c.getUTCMonth() + 1, diaPago);
}

/**
 * Rango de un ciclo. Las compras de contado entran por su fecha en
 * (corte anterior, corte]; las cuotas de una compra a cuotas tienen como
 * fecha el día en que se pagan, así que entran al extracto cuyo pago es el
 * primero en o después de su fecha: (pago anterior, pago]. Sin día de pago,
 * las cuotas usan el mismo rango de corte.
 */
export function rangoCiclo(fechaCorte, metodo) {
  const corte = new Date(fechaCorte);
  const corteAnterior = moverCorte(corte, -1, metodo.diaCorte);
  const pago = pagoDeCorte(corte, metodo.diaPago);
  const pagoAnterior = pagoDeCorte(corteAnterior, metodo.diaPago);
  return {
    fechaCorte: corte,
    corteAnterior,
    fechaPago: pago,
    compras: { desde: corteAnterior, hasta: corte },
    cuotas: pago ? { desde: pagoAnterior, hasta: pago } : { desde: corteAnterior, hasta: corte },
  };
}

/** ¿Cae la fecha en (desde, hasta]? */
export function enRango(fecha, { desde, hasta }) {
  const f = new Date(fecha);
  return f > desde && f <= hasta;
}
