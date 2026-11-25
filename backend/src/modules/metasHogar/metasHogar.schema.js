import { z } from 'zod';

export const crearMetaSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  montoMeta: z.number().int().positive(),
  fechaMeta: z.coerce.date().nullable().optional(),
});

export const actualizarMetaSchema = z.object({
  nombre: z.string().trim().min(1).max(100).optional(),
  montoMeta: z.number().int().positive().optional(),
  fechaMeta: z.coerce.date().nullable().optional(),
  activa: z.boolean().optional(),
});

export const movimientoMetaSchema = z.object({
  tipo: z.enum(['aporte', 'retiro']),
  monto: z.number().int().positive(),
  fecha: z.coerce.date().optional(),
  metodoPagoId: z.string().uuid().nullable().optional(),
});
