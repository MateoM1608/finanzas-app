import { z } from 'zod';

export const crearIngresoPersonalSchema = z.object({
  monto: z.number().int().positive(),
  fecha: z.coerce.date(),
  estado: z.enum(['recibido', 'pendiente']).optional(),
  metodoPagoId: z.string().uuid().nullable().optional(),
  categoriaId: z.string().uuid().nullable().optional(),
});

export const actualizarIngresoPersonalSchema = z.object({
  monto: z.number().int().positive().optional(),
  fecha: z.coerce.date().optional(),
  estado: z.enum(['recibido', 'pendiente']).optional(),
  metodoPagoId: z.string().uuid().nullable().optional(),
  categoriaId: z.string().uuid().nullable().optional(),
});
