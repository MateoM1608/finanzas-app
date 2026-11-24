import { z } from 'zod';

export const pagarCuotaSchema = z.object({
  monto: z.number().int().positive().optional(),
  pagoUsuarioId: z.string().uuid().optional(),
  fechaPago: z.coerce.date().optional(),
  metodoPagoId: z.string().uuid().nullable().optional(),
});
