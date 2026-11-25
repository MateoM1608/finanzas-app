import { fechaApp, MONTO_MAX } from '../../utils/validacion.js';
import { z } from 'zod';

export const crearCompraPersonalSchema = z.object({
  descripcion: z.string().trim().min(1).max(255),
  montoTotal: z.number().int().positive().max(MONTO_MAX),
  numeroCuotas: z.number().int().min(2).max(72),
  fechaPrimeraCuota: fechaApp,
  modoCobro: z.enum(['automatico', 'manual']),
  tasaMensual: z.number().min(0).max(10).optional(),
  sistemaInteres: z.enum(['capital_fijo', 'cuota_fija']).optional(),
  metodoPagoId: z.string().uuid().nullable().optional(),
  categoriaId: z.string().uuid().nullable().optional(),
  esObligatorio: z.boolean().optional(),
});

export const sugerirPrimeraCuotaSchema = z.object({
  fechaCompra: fechaApp.optional(),
  metodoPagoId: z.string().uuid().optional(),
});

export const actualizarCompraPersonalSchema = z.object({
  descripcion: z.string().trim().min(1).max(255).optional(),
  montoTotal: z.number().int().positive().max(MONTO_MAX).optional(),
  numeroCuotas: z.number().int().min(2).max(72).optional(),
  fechaPrimeraCuota: fechaApp.optional(),
  modoCobro: z.enum(['automatico', 'manual']).optional(),
  tasaMensual: z.number().min(0).max(10).optional(),
  sistemaInteres: z.enum(['capital_fijo', 'cuota_fija']).optional(),
  metodoPagoId: z.string().uuid().nullable().optional(),
  categoriaId: z.string().uuid().nullable().optional(),
  esObligatorio: z.boolean().optional(),
});
