import { calcularCuotas } from './cuotas.js';

/**
 * Cálculos de préstamos (entrega D1). Todo en COP enteros; tasas en %.
 */

/** Tasa mensual equivalente: una E.A. se convierte con (1 + EA)^(1/12) − 1. */
export function tasaMensualDe(tasa, esAnual) {
  if (!tasa) return 0;
  if (!esAnual) return tasa;
  return Math.round(((1 + tasa / 100) ** (1 / 12) - 1) * 100 * 10000) / 10000;
}

/** Plan de N cuotas sobre un saldo: [{ monto, capital, interes, seguro }]. */
export function planPorNumero(saldo, numeroCuotas, tasaMensual, sistema, seguro = 0) {
  if (saldo <= 0 || numeroCuotas <= 0) return [];
  return calcularCuotas(saldo, numeroCuotas, tasaMensual, sistema).map((c) => ({
    ...c,
    seguro,
    monto: c.monto + seguro,
  }));
}

/**
 * Plan que conserva la cuota (sin seguro) y acorta el plazo, para un abono
 * "bajar el plazo", como lo hacen los bancos: cada cuota paga el interés del
 * saldo y el resto va a capital, hasta acabar; la última es menor.
 * - cuota_fija: la referencia es la cuota (capital + interés).
 * - capital_fijo o sin interés: la referencia es el capital por cuota.
 */
export function planPorCuota(saldo, cuotaReferencia, tasaMensual, sistema, seguro = 0) {
  const r = (tasaMensual ?? 0) / 100;
  const porCapital = sistema === 'capital_fijo' || r <= 0;
  const plan = [];
  let restante = saldo;
  while (restante > 0 && plan.length < 360) {
    const interes = Math.round(restante * r);
    let capital = porCapital ? cuotaReferencia : cuotaReferencia - interes;
    // Si la cuota ya no alcanza para el interés, se paga al menos algo de capital.
    if (capital <= 0) capital = Math.max(1, Math.ceil(restante / (360 - plan.length)));
    capital = Math.min(restante, capital);
    plan.push({ monto: capital + interes + seguro, capital, interes, seguro });
    restante -= capital;
  }
  return plan;
}
