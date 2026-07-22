import { z } from 'zod';

export const patchItemSchema = z
  .object({
    incluido: z.boolean().optional(),
    monto: z.number().int().positive().optional(),
  })
  .refine((data) => data.incluido !== undefined || data.monto !== undefined, {
    message: 'Debes especificar incluido o monto',
  });
