import { z } from 'zod';

export const crearGastoPersonalSchema = z.object({
  monto: z.number().int().positive(),
  fecha: z.coerce.date(),
  categoria: z.string().trim().min(1).max(50).optional(),
  descripcion: z.string().trim().min(1).max(255).optional(),
});
