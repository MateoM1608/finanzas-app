import { z } from 'zod';

export const actualizarCicloPersonalSchema = z.object({
  frecuenciaCicloPersonal: z.enum(['semanal', 'quincenal', 'mensual']),
});
