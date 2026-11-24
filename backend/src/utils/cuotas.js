/**
 * Utilidades de compras a cuotas (personales y del hogar).
 */

function ultimoDiaMes(anio, mesIndex0) {
  return new Date(Date.UTC(anio, mesIndex0 + 1, 0)).getUTCDate();
}

/**
 * Divide un total (COP, entero) en N cuotas: total/N redondeado hacia abajo,
 * y el residuo va en la última para que la suma dé exacto.
 */
export function dividirEnCuotas(total, numeroCuotas) {
  const base = Math.floor(total / numeroCuotas);
  return Array.from({ length: numeroCuotas }, (_, i) =>
    i === numeroCuotas - 1 ? total - base * (numeroCuotas - 1) : base,
  );
}

/**
 * Fechas de las N cuotas: una por mes desde la primera, el mismo día del mes
 * (si el mes es más corto, su último día — 31 en febrero → 28/29).
 */
export function fechasDeCuotas(fechaPrimeraCuota, numeroCuotas) {
  const primera = new Date(fechaPrimeraCuota);
  const anio = primera.getUTCFullYear();
  const mes = primera.getUTCMonth();
  const dia = primera.getUTCDate();
  return Array.from({ length: numeroCuotas }, (_, i) => {
    const m = mes + i;
    const a = anio + Math.floor(m / 12);
    const mi = ((m % 12) + 12) % 12;
    return new Date(Date.UTC(a, mi, Math.min(dia, ultimoDiaMes(a, mi))));
  });
}

/**
 * Sugiere la fecha de la primera cuota según el método de pago:
 * - Tarjeta de crédito con día de corte y de pago: la compra entra al
 *   extracto del próximo corte (el mismo día del corte cuenta en ese corte);
 *   la cuota se paga el día de pago siguiente a ese corte.
 * - Crédito de almacén (o tarjeta sin corte) con día de pago: el próximo día
 *   de pago del mes siguiente a la compra.
 * - Sin datos: un mes después de la compra.
 */
export function sugerirFechaPrimeraCuota(fechaCompra, metodo) {
  const compra = new Date(fechaCompra);
  const anio = compra.getUTCFullYear();
  const mes = compra.getUTCMonth();
  const enMes = (a, m, dia) => {
    const aa = a + Math.floor(m / 12);
    const mm = ((m % 12) + 12) % 12;
    return new Date(Date.UTC(aa, mm, Math.min(dia, ultimoDiaMes(aa, mm))));
  };

  if (metodo?.diaPago && metodo?.diaCorte && metodo.tipo === 'tarjeta_credito') {
    let corte = enMes(anio, mes, metodo.diaCorte);
    if (compra > corte) corte = enMes(anio, mes + 1, metodo.diaCorte);
    let pago = enMes(corte.getUTCFullYear(), corte.getUTCMonth(), metodo.diaPago);
    if (pago <= corte) pago = enMes(corte.getUTCFullYear(), corte.getUTCMonth() + 1, metodo.diaPago);
    return pago;
  }
  if (metodo?.diaPago) {
    return enMes(anio, mes + 1, metodo.diaPago);
  }
  return enMes(anio, mes + 1, compra.getUTCDate());
}
