function inicioDeDiaUTC(fecha) {
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
}

function sumarPaso(fecha, frecuencia) {
  const anio = fecha.getUTCFullYear();
  const mes = fecha.getUTCMonth();
  const dia = fecha.getUTCDate();

  if (frecuencia === 'semanal') {
    return new Date(Date.UTC(anio, mes, dia + 7));
  }
  if (frecuencia === 'quincenal') {
    return new Date(Date.UTC(anio, mes, dia + 15));
  }
  // mensual: mismo día del mes siguiente; si ese mes no llega a tener ese día
  // (ej. 31 en febrero), cae al último día de ese mes en vez de desbordar a marzo.
  const ultimoDiaMesSiguiente = new Date(Date.UTC(anio, mes + 2, 0)).getUTCDate();
  return new Date(Date.UTC(anio, mes + 1, Math.min(dia, ultimoDiaMesSiguiente)));
}

/**
 * Fechas de ocurrencia de un concepto fijo entre su `fechaInicio` (inclusive)
 * y `hastaFecha` (inclusive), sumando el paso de la frecuencia cada vez — sin
 * "puntos de corte" compartidos: cada concepto fijo tiene su propio ancla y
 * calendario, independiente de cualquier otro concepto o del hogar.
 */
export function calcularFechasPendientes(fechaInicio, frecuencia, hastaFecha) {
  const fechas = [];
  let cursor = inicioDeDiaUTC(new Date(fechaInicio));
  const limite = inicioDeDiaUTC(new Date(hastaFecha));

  while (cursor <= limite) {
    fechas.push(cursor);
    cursor = sumarPaso(cursor, frecuencia);
  }
  return fechas;
}
