import { fechaApp, MONTO_MAX } from '../../utils/validacion.js';
import { z } from 'zod';

export const pagarCuotaSchema = z.object({
  monto: z.number().int().positive().max(MONTO_MAX).optional(),
  pagoUsuarioId: z.string().uuid().optional(),
  fechaPago: fechaApp.optional(),
  metodoPagoId: z.string().uuid().nullable().optional(),
});
