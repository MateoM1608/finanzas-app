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
export function fechasDeCuotas(fechaPrimeraCuota, numeroCuotas, diaFijo = null) {
  const primera = new Date(fechaPrimeraCuota);
  const anio = primera.getUTCFullYear();
  const mes = primera.getUTCMonth();
  // diaFijo: el día del plan original (ej. 31), para que una cuota que cayó
  // en un mes corto (28 de febrero) no corra todas las siguientes al 28.
  const dia = diaFijo ?? primera.getUTCDate();
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

/**
 * Cuotas de una compra con su capital e interés: [{ monto, capital, interes }].
 * `tasaMensual` en % (ej. 2.1 = 2,1 % mensual). Sin interés: el total se
 * divide en partes iguales (dividirEnCuotas). Con interés, sobre el saldo de
 * capital que falta antes de cada cuota:
 * - capital_fijo: capital = total/N (residuo en la última) e interés =
 *   saldo × tasa; las cuotas van bajando.
 * - cuota_fija (francés): cuota = P·r / (1 − (1+r)^−N), interés = saldo × r
 *   y capital = cuota − interés; la última cierra el saldo exacto.
 * Todo en COP enteros.
 */
export function calcularCuotas(total, numeroCuotas, tasaMensual = 0, sistema = 'capital_fijo') {
  const r = (tasaMensual ?? 0) / 100;
  if (r <= 0) {
    return dividirEnCuotas(total, numeroCuotas).map((m) => ({ monto: m, capital: m, interes: 0 }));
  }
  const cuotas = [];
  let saldo = total;
  if (sistema === 'cuota_fija') {
    const cuotaFija = Math.round((total * r) / (1 - (1 + r) ** -numeroCuotas));
    for (let i = 0; i < numeroCuotas; i += 1) {
      const interes = Math.round(saldo * r);
      const capital = i === numeroCuotas - 1 ? saldo : Math.min(saldo, cuotaFija - interes);
      cuotas.push({ monto: capital + interes, capital, interes });
      saldo -= capital;
    }
    return cuotas;
  }
  const capitales = dividirEnCuotas(total, numeroCuotas);
  for (const capital of capitales) {
    const interes = Math.round(saldo * r);
    cuotas.push({ monto: capital + interes, capital, interes });
    saldo -= capital;
  }
  return cuotas;
}

/**
 * Interés que aplica a una compra a cuotas: si la compra trae su propia tasa
 * (`tasaMensual` definido: 0 = sin interés / promoción, o una tasa distinta),
 * esa; si no, la del método de pago (la tarjeta o el crédito). Sin método o
 * sin tasa en el método: sin interés.
 */
export function interesDeCompra(data, metodo) {
  // A una cuota la tarjeta no cobra interés: se paga entera con el extracto.
  if (data.numeroCuotas === 1 && (data.tasaMensual === undefined || data.tasaMensual === null)) {
    return { tasaMensual: 0, sistemaInteres: data.sistemaInteres ?? metodo?.sistemaInteres ?? 'capital_fijo' };
  }
  if (data.tasaMensual !== undefined && data.tasaMensual !== null) {
    return { tasaMensual: data.tasaMensual, sistemaInteres: data.sistemaInteres ?? metodo?.sistemaInteres ?? 'capital_fijo' };
  }
  return { tasaMensual: metodo?.tasaMensual ?? 0, sistemaInteres: metodo?.sistemaInteres ?? 'capital_fijo' };
}
