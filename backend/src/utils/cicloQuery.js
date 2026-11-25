import { z } from 'zod';
import { CICLOS_HACIA_ATRAS } from './cicloPersonal.js';

/** `?ciclo=` de las consultas del panel personal: 0 (actual) a -24. */
export const cicloQuerySchema = z.object({
  ciclo: z.coerce.number().int().min(-CICLOS_HACIA_ATRAS).max(0).default(0),
});

export function leerCiclo(query) {
  return cicloQuerySchema.parse(query).ciclo;
}
