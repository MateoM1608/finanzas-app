import { hoyUTC } from './fechas.js';

function inicioDeDiaUTC(fecha) {
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
}

function ultimoDiaMes(anio, mesIndex0) {
  return new Date(Date.UTC(anio, mesIndex0 + 1, 0)).getUTCDate();
}

function inicioSemanaISO(fecha) {
  const diaIso = fecha.getUTCDay() || 7; // domingo=0 -> 7
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate() - (diaIso - 1)));
}

/**
 * Rango del período (inicio/fin, ambos inclusive) que contiene `fechaRef`,
 * puramente por calendario según `frecuencia` — a diferencia del corte de
 * hogar, acá no hay "puntos" configurables: mensual = mes calendario,
 * quincenal = [1-15] / [16-fin de mes], semanal = semana ISO (lunes-domingo).
 */
function calcularPeriodo(frecuencia, fechaRef) {
  const hoy = inicioDeDiaUTC(fechaRef);
  const anio = hoy.getUTCFullYear();
  const mes = hoy.getUTCMonth();
  const dia = hoy.getUTCDate();

  if (frecuencia === 'semanal') {
    const inicio = inicioSemanaISO(hoy);
    const fin = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate() + 6));
    return { inicio, fin };
  }

  if (frecuencia === 'quincenal') {
    if (dia <= 15) {
      return { inicio: new Date(Date.UTC(anio, mes, 1)), fin: new Date(Date.UTC(anio, mes, 15)) };
    }
    return {
      inicio: new Date(Date.UTC(anio, mes, 16)),
      fin: new Date(Date.UTC(anio, mes, ultimoDiaMes(anio, mes))),
    };
  }

  // mensual
  return {
    inicio: new Date(Date.UTC(anio, mes, 1)),
    fin: new Date(Date.UTC(anio, mes, ultimoDiaMes(anio, mes))),
  };
}

export function calcularPeriodoActual(frecuencia, fechaRef = hoyUTC()) {
  return calcularPeriodo(frecuencia, fechaRef);
}

export function calcularPeriodoAnterior(frecuencia, fechaRef = hoyUTC()) {
  const actual = calcularPeriodo(frecuencia, fechaRef);
  // Un día antes del inicio del período actual cae, por construcción, dentro
  // del período inmediatamente anterior — sirve como referencia para
  // recalcularlo con la misma función.
  const diaAnterior = new Date(
    Date.UTC(actual.inicio.getUTCFullYear(), actual.inicio.getUTCMonth(), actual.inicio.getUTCDate() - 1),
  );
  return calcularPeriodo(frecuencia, diaAnterior);
}

export function dentroDelRango(fecha, rango) {
  const f = inicioDeDiaUTC(new Date(fecha));
  return f >= rango.inicio && f <= rango.fin;
}
