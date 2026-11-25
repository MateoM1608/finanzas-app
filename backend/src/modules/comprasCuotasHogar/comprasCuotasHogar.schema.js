import { fechaApp, MONTO_MAX } from '../../utils/validacion.js';
import { z } from 'zod';

export const crearCompraHogarSchema = z.object({
  item: z.string().trim().min(1).max(150),
  montoTotal: z.number().int().positive().max(MONTO_MAX),
  numeroCuotas: z.number().int().min(2).max(72),
  fechaCompra: fechaApp,
  fechaPrimeraCuota: fechaApp,
  modoCobro: z.enum(['automatico', 'manual']),
  tasaMensual: z.number().min(0).max(10).optional(),
  sistemaInteres: z.enum(['capital_fijo', 'cuota_fija']).optional(),
  pagoUsuarioId: z.string().uuid(),
  metodoPagoId: z.string().uuid().nullable().optional(),
  categoriaId: z.string().uuid().nullable().optional(),
  repartos: z
    .array(z.object({ usuarioId: z.string().uuid(), monto: z.number().int().nonnegative() }))
    .max(50)
    .optional(),
});

export const actualizarCompraHogarSchema = z.object({
  item: z.string().trim().min(1).max(150).optional(),
  montoTotal: z.number().int().positive().max(MONTO_MAX).optional(),
  numeroCuotas: z.number().int().min(2).max(72).optional(),
  fechaCompra: fechaApp.optional(),
  fechaPrimeraCuota: fechaApp.optional(),
  modoCobro: z.enum(['automatico', 'manual']).optional(),
  tasaMensual: z.number().min(0).max(10).optional(),
  sistemaInteres: z.enum(['capital_fijo', 'cuota_fija']).optional(),
  pagoUsuarioId: z.string().uuid().optional(),
  metodoPagoId: z.string().uuid().nullable().optional(),
  categoriaId: z.string().uuid().nullable().optional(),
  repartos: z
    .array(z.object({ usuarioId: z.string().uuid(), monto: z.number().int().nonnegative() }))
    .max(50)
    .optional(),
});
