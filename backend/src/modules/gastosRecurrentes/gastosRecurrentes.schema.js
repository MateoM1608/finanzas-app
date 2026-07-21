import { z } from 'zod';

export const actualizarInstanciaSchema = z.object({
  monto: z.number().int().positive().optional(),
  pagoUsuarioId: z.string().uuid().nullable().optional(),
});
