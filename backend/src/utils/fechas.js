/**
 * Zona horaria de la app. Todas las fechas "de calendario" (fecha de un gasto,
 * inicio de un período, fecha nominal de un corte) se guardan como medianoche
 * UTC de ese día — pero "hoy" hay que calcularlo en la hora local del usuario,
 * no en UTC: en Colombia (UTC-5), desde las 7pm el reloj UTC ya va en el día
 * siguiente, y eso generaba ocurrencias fijas y períodos un día antes de tiempo.
 */
const ZONA_HORARIA = process.env.APP_TZ || 'America/Bogota';

const formateadorFecha = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_HORARIA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** "Hoy" en la zona horaria de la app, como medianoche UTC de ese día. */
export function hoyUTC(ahora = new Date()) {
  const [anio, mes, dia] = formateadorFecha.format(ahora).split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia));
}
