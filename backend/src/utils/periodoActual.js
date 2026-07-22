function ultimoDiaMes(anio, mesIndex0) {
  return new Date(Date.UTC(anio, mesIndex0 + 1, 0)).getUTCDate();
}

function fechaNominalMensual(punto, anio, mesIndex0) {
  const dia = punto.diaMes ?? ultimoDiaMes(anio, mesIndex0);
  return new Date(Date.UTC(anio, mesIndex0, dia));
}

function fechaNominalSemanal(punto, fechaEnLaSemana) {
  const diaIso = fechaEnLaSemana.getUTCDay() || 7; // domingo=0 -> 7
  const lunes = new Date(fechaEnLaSemana);
  lunes.setUTCDate(fechaEnLaSemana.getUTCDate() - (diaIso - 1));
  const resultado = new Date(lunes);
  resultado.setUTCDate(lunes.getUTCDate() + (punto.diaSemana - 1));
  return resultado;
}

function inicioDeHoyUTC(fechaRef) {
  return new Date(Date.UTC(fechaRef.getUTCFullYear(), fechaRef.getUTCMonth(), fechaRef.getUTCDate()));
}

// Genera fechas nominales candidatas para cada punto de corte, en un rango de
// ciclos (meses o semanas) alrededor de `hoy`, según `offsets`.
function generarCandidatos(hogar, puntosCorte, hoy, offsets) {
  const candidatos = [];

  if (hogar.frecuenciaCorte === 'semanal') {
    for (const offsetSemanas of offsets) {
      const fechaBase = new Date(hoy);
      fechaBase.setUTCDate(hoy.getUTCDate() + offsetSemanas * 7);
      for (const punto of puntosCorte) {
        candidatos.push({ punto, fecha: fechaNominalSemanal(punto, fechaBase) });
      }
    }
  } else {
    for (const offsetMeses of offsets) {
      const anio = hoy.getUTCFullYear();
      const mes = hoy.getUTCMonth() + offsetMeses;
      for (const punto of puntosCorte) {
        candidatos.push({ punto, fecha: fechaNominalMensual(punto, anio, mes) });
      }
    }
  }

  candidatos.sort((a, b) => a.fecha - b.fecha);
  return candidatos;
}

/**
 * Calcula el punto de corte "vigente" para hoy: el próximo punto nominal que no ha
 * llegado (o que es justo hoy), y el inicio del período que lo precede. Independiente
 * de cuándo se ejecute realmente un corte — eso lo decide quien lo inicia (fase 5),
 * esto solo determina en qué ciclo calendario estamos parados ahora mismo.
 */
export function calcularPeriodoActual(hogar, puntosCorte, fechaRef = new Date()) {
  if (!puntosCorte.length) {
    throw new Error('El hogar no tiene puntos de corte configurados');
  }

  const hoy = inicioDeHoyUTC(fechaRef);
  const candidatos = generarCandidatos(hogar, puntosCorte, hoy, [-1, 0, 1]);

  const siguienteIdx = candidatos.findIndex((c) => c.fecha >= hoy);
  if (siguienteIdx === -1) {
    throw new Error('No se pudo calcular el período actual');
  }

  const actual = candidatos[siguienteIdx];
  const anterior = candidatos[siguienteIdx - 1];

  const periodoInicio = anterior
    ? new Date(
        Date.UTC(
          anterior.fecha.getUTCFullYear(),
          anterior.fecha.getUTCMonth(),
          anterior.fecha.getUTCDate() + 1,
        ),
      )
    : new Date(Date.UTC(actual.fecha.getUTCFullYear(), actual.fecha.getUTCMonth(), 1));

  return {
    puntoCorte: actual.punto,
    fechaNominal: actual.fecha,
    periodoInicio,
  };
}

/**
 * Determina el punto de "atraso" listo para cerrar: el punto pasado (o de
 * hoy) más reciente que no se haya cerrado todavía. Un corte junta TODO lo
 * pendiente con fecha ≤ su fecha nominal sin importar cuán viejo sea, así que
 * cerrar el punto más reciente ya cubre cualquier atraso acumulado de puntos
 * anteriores.
 *
 * Devuelve `null` si no hay ningún punto pasado sin cerrar — eso NO significa
 * que no haya nada que cerrar: puede que el hogar esté al día y lo único
 * pendiente sea el período actual (todavía en curso). Esa posibilidad la
 * evalúa quien llama esta función, combinándola con `calcularPeriodoActual` y
 * los datos reales pendientes (ver `cortes.service.js#iniciarCorte`) — esta
 * función solo sabe de fechas, no de qué hay realmente pendiente.
 */
export function calcularProximaFechaNominalPendiente(
  hogar,
  puntosCorte,
  fechasNominalesCerradas,
  fechaRef = new Date(),
) {
  if (!puntosCorte.length) {
    throw new Error('El hogar no tiene puntos de corte configurados');
  }

  const hoy = inicioDeHoyUTC(fechaRef);
  const candidatos = generarCandidatos(hogar, puntosCorte, hoy, [-2, -1, 0]);
  const cerradas = new Set(fechasNominalesCerradas.map((f) => new Date(f).getTime()));

  const pasados = candidatos.filter((c) => c.fecha <= hoy);
  if (!pasados.length) return null;

  const masReciente = pasados[pasados.length - 1];
  if (cerradas.has(masReciente.fecha.getTime())) return null;

  return masReciente;
}
