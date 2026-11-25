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
  // Compra que ya venía en curso: cuántas cuotas se pagaron antes de registrarla.
  cuotasPagadasAntes: z.number().int().min(0).max(71).optional(),
}).refine((d) => (d.cuotasPagadasAntes ?? 0) < d.numeroCuotas, {
  message: 'Las cuotas ya pagadas deben ser menos que el total de cuotas',
  path: ['cuotasPagadasAntes'],
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
  cuotasPagadasAntes: z.number().int().min(0).max(71).optional(),
});
