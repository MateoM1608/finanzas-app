import { prisma } from '../config/prisma.js';
import { hoyUTC } from './fechas.js';

/**
 * Calendario de las cuentas fijas del hogar (ConceptoRecurrentePareja). Cada
 * cuenta tiene su propio calendario — frecuencia + día(s) del mes desde su
 * `fechaInicio` — sin ningún "punto de corte" compartido del hogar: los
 * cuadres se hacen cuando el hogar decide, no en fechas fijas.
 */

function ultimoDiaMes(anio, mesIndex0) {
  return new Date(Date.UTC(anio, mesIndex0 + 1, 0)).getUTCDate();
}

/** Día efectivo en un mes: null = último día; un día más largo que el mes cae en su último día. */
function fechaEnMes(dia, anio, mesIndex0) {
  const ultimo = ultimoDiaMes(anio, mesIndex0);
  return new Date(Date.UTC(anio, mesIndex0, dia == null ? ultimo : Math.min(dia, ultimo)));
}

function diasDelConcepto(concepto) {
  if (concepto.frecuencia === 'quincenal') {
    return [concepto.diaMes ?? 15, concepto.diaMes2 ?? null];
  }
  return [concepto.diaMes ?? null];
}

function inicioDeDia(fecha) {
  const f = new Date(fecha);
  return new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate()));
}

/**
 * Fechas de cuota de una cuenta entre su `fechaInicio` (inclusive) y `hasta`
 * (inclusive), ordenadas. Si se pasa `incluirSiguiente`, agrega además la
 * primera fecha posterior a `hasta` (la "próxima").
 */
export function fechasDeCuenta(concepto, hasta, { incluirSiguiente = false } = {}) {
  const inicio = inicioDeDia(concepto.fechaInicio);
  const limite = inicioDeDia(hasta);
  const fechas = [];
  let anio = inicio.getUTCFullYear();
  let mes = inicio.getUTCMonth();
  let siguienteEncontrada = false;

  // Tope de seguridad: 20 años de cuotas.
  for (let i = 0; i < 240 && !siguienteEncontrada; i += 1) {
    const delMes = diasDelConcepto(concepto)
      .map((dia) => fechaEnMes(dia, anio, mes))
      .sort((a, b) => a - b);
    for (const fecha of delMes) {
      if (fecha < inicio) continue;
      if (fecha <= limite) {
        fechas.push(fecha);
      } else if (incluirSiguiente && !siguienteEncontrada) {
        fechas.push(fecha);
        siguienteEncontrada = true;
      }
    }
    if (!incluirSiguiente && new Date(Date.UTC(anio, mes, 1)) > limite) break;
    mes += 1;
    if (mes === 12) {
      mes = 0;
      anio += 1;
    }
  }

  // Dos días que caen en la misma fecha (ej. 30 y último en febrero) se cuentan una vez.
  return fechas.filter((f, idx) => idx === 0 || f.getTime() !== fechas[idx - 1].getTime());
}

/**
 * Período al que pertenece una cuota: el mes (mensual) o la mitad del mes
 * (quincenal: día ≤ 15 o después). Sirve para no volver a cobrar un período
 * que ya se pagó cuando cambia el calendario de la cuenta (ej. del 30 al 5:
 * septiembre ya pagado el 30 no debe generar otra cuota el 5).
 */
export function periodoDeCuota(concepto, fecha) {
  const f = new Date(fecha);
  const mes = `${f.getUTCFullYear()}-${f.getUTCMonth()}`;
  if (concepto.frecuencia !== 'quincenal') return mes;
  return `${mes}-${f.getUTCDate() <= 15 ? 1 : 2}`;
}

/**
 * Genera perezosamente (no hay cron en esta app) las cuotas que falten de
 * cada cuenta fija activa del hogar: todas las de su calendario hasta hoy,
 * más la próxima — así se puede marcar pagada antes de su fecha. Idempotente
 * por el unique (conceptoId, fecha).
 */
export async function asegurarCuotasHogar(hogarId, hoy = hoyUTC()) {
  const conceptos = await prisma.conceptoRecurrentePareja.findMany({
    where: { hogarId, activo: true },
  });

  if (!conceptos.length) return;

  // Períodos que ya tienen una cuota pagada (o en un cuadre): no se vuelven a
  // generar aunque el calendario haya cambiado de día.
  const pagadas = await prisma.gastoRecurrenteInstancia.findMany({
    where: { conceptoId: { in: conceptos.map((c) => c.id) }, estado: { not: 'por_pagar' } },
    select: { conceptoId: true, fecha: true },
  });
  const porId = new Map(conceptos.map((c) => [c.id, c]));
  const ocupados = new Set(pagadas.map((p) => `${p.conceptoId}|${periodoDeCuota(porId.get(p.conceptoId), p.fecha)}`));

  // Una sola query: ON CONFLICT DO NOTHING sobre (conceptoId, fecha) deja
  // intactas las cuotas que ya existen (pagadas o no).
  const filas = conceptos.flatMap((concepto) =>
    fechasDeCuenta(concepto, hoy, { incluirSiguiente: true })
      .filter((fecha) => !ocupados.has(`${concepto.id}|${periodoDeCuota(concepto, fecha)}`))
      .map((fecha) => ({
        conceptoId: concepto.id,
        fecha,
        monto: concepto.tipoMonto === 'fijo' ? concepto.montoDefault : null,
      })),
  );
  if (filas.length) {
    await prisma.gastoRecurrenteInstancia.createMany({ data: filas, skipDuplicates: true });
  }
}
