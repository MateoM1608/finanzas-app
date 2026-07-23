import { z } from 'zod';

export const crearGastoPersonalSchema = z.object({
  monto: z.number().int().positive(),
  fecha: z.coerce.date(),
  descripcion: z.string().trim().min(1).max(255).optional(),
  estado: z.enum(['pagado', 'pendiente']).optional(),
  esObligatorio: z.boolean().optional(),
  metodoPagoId: z.string().uuid().nullable().optional(),
  categoriaId: z.string().uuid().nullable().optional(),
});

export const actualizarGastoPersonalSchema = z.object({
  monto: z.number().int().positive().optional(),
  fecha: z.coerce.date().optional(),
  descripcion: z.string().trim().min(1).max(255).nullable().optional(),
  estado: z.enum(['pagado', 'pendiente']).optional(),
  esObligatorio: z.boolean().optional(),
  metodoPagoId: z.string().uuid().nullable().optional(),
  categoriaId: z.string().uuid().nullable().optional(),
});
