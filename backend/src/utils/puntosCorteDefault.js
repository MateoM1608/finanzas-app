// Puntos de corte por defecto según la frecuencia elegida (la "referencia" es editable
// luego en Settings; diaMes/diaSemana son estructurales y los usa el cálculo de fechas).
// Compartido entre el hogar (PuntoCorteHogar) y los recurrentes personales (PuntoCortePersonal).
export function puntosCorteDefault(frecuenciaCorte) {
  if (frecuenciaCorte === 'semanal') {
    return [{ orden: 1, referencia: 'lunes', diaSemana: 1 }];
  }
  if (frecuenciaCorte === 'quincenal') {
    return [
      { orden: 1, referencia: 'dia_15', diaMes: 15 },
      { orden: 2, referencia: 'fin_de_mes', diaMes: null },
    ];
  }
  return [{ orden: 1, referencia: 'fin_de_mes', diaMes: null }]; // mensual
}
