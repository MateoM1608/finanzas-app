import { z } from 'zod';

export const patchItemSchema = z
  .object({
    incluido: z.boolean().optional(),
    monto: z.number().int().positive().optional(),
    pagoUsuarioId: z.string().optional(),
  })
  .refine(
    (data) => data.incluido !== undefined || data.monto !== undefined || data.pagoUsuarioId !== undefined,
    { message: 'Debes especificar incluido, monto o pagoUsuarioId' },
  );
