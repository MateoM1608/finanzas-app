import { z } from 'zod';

/**
 * Topes de entrada: un monto mayor no cabe en la columna (Int de Postgres,
 * ~2.147 millones) y daba un error interno; una fecha muy vieja en una cuenta
 * o un fijo (año 1) haría generar miles de cuotas de una vez.
 */
export const MONTO_MAX = 2_000_000_000;

const MIN = new Date('2000-01-01T00:00:00.000Z');
const MAX = new Date('2100-12-31T00:00:00.000Z');

export const fechaApp = z.coerce
  .date()
  .refine((d) => d >= MIN && d <= MAX, { message: 'La fecha debe estar entre el año 2000 y el 2100' });
