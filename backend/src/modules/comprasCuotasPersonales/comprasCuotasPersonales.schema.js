import { z } from 'zod';

export const crearCompraPersonalSchema = z.object({
  descripcion: z.string().trim().min(1).max(255),
  montoTotal: z.number().int().positive(),
  numeroCuotas: z.number().int().min(2).max(72),
  fechaPrimeraCuota: z.coerce.date(),
  modoCobro: z.enum(['automatico', 'manual']),
  metodoPagoId: z.string().uuid().nullable().optional(),
  categoriaId: z.string().uuid().nullable().optional(),
  esObligatorio: z.boolean().optional(),
});

export const sugerirPrimeraCuotaSchema = z.object({
  fechaCompra: z.coerce.date().optional(),
  metodoPagoId: z.string().uuid().optional(),
});

export const actualizarCompraPersonalSchema = z.object({
  descripcion: z.string().trim().min(1).max(255).optional(),
  montoTotal: z.number().int().positive().optional(),
  numeroCuotas: z.number().int().min(2).max(72).optional(),
  fechaPrimeraCuota: z.coerce.date().optional(),
  modoCobro: z.enum(['automatico', 'manual']).optional(),
  metodoPagoId: z.string().uuid().nullable().optional(),
  categoriaId: z.string().uuid().nullable().optional(),
  esObligatorio: z.boolean().optional(),
});
