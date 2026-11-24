import { z } from 'zod';

export const crearCompraHogarSchema = z.object({
  item: z.string().trim().min(1).max(150),
  montoTotal: z.number().int().positive(),
  numeroCuotas: z.number().int().min(2).max(72),
  fechaCompra: z.coerce.date(),
  fechaPrimeraCuota: z.coerce.date(),
  modoCobro: z.enum(['automatico', 'manual']),
  pagoUsuarioId: z.string().uuid(),
  metodoPagoId: z.string().uuid().nullable().optional(),
  repartos: z
    .array(z.object({ usuarioId: z.string().uuid(), monto: z.number().int().nonnegative() }))
    .optional(),
});

export const actualizarCompraHogarSchema = z.object({
  item: z.string().trim().min(1).max(150).optional(),
  montoTotal: z.number().int().positive().optional(),
  numeroCuotas: z.number().int().min(2).max(72).optional(),
  fechaCompra: z.coerce.date().optional(),
  fechaPrimeraCuota: z.coerce.date().optional(),
  modoCobro: z.enum(['automatico', 'manual']).optional(),
  pagoUsuarioId: z.string().uuid().optional(),
  metodoPagoId: z.string().uuid().nullable().optional(),
  repartos: z
    .array(z.object({ usuarioId: z.string().uuid(), monto: z.number().int().nonnegative() }))
    .optional(),
});
