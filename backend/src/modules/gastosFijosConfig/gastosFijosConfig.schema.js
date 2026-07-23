import { z } from 'zod';

export const crearGastoFijoSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  monto: z.number().int().positive(),
  frecuencia: z.enum(['semanal', 'quincenal', 'mensual']),
  fechaInicio: z.coerce.date(),
  modoCobro: z.enum(['automatico', 'manual']),
  esObligatorio: z.boolean().optional(),
  metodoPagoIdDefault: z.string().uuid().nullable().optional(),
  categoriaId: z.string().uuid().nullable().optional(),
});

export const actualizarGastoFijoSchema = z.object({
  nombre: z.string().trim().min(1).max(100).optional(),
  monto: z.number().int().positive().optional(),
  frecuencia: z.enum(['semanal', 'quincenal', 'mensual']).optional(),
  modoCobro: z.enum(['automatico', 'manual']).optional(),
  esObligatorio: z.boolean().optional(),
  metodoPagoIdDefault: z.string().uuid().nullable().optional(),
  categoriaId: z.string().uuid().nullable().optional(),
  activo: z.boolean().optional(),
});
