import { fechaApp, MONTO_MAX } from '../../utils/validacion.js';
import { z } from 'zod';

export const crearMetaSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  montoMeta: z.number().int().positive().max(MONTO_MAX),
  fechaMeta: fechaApp.nullable().optional(),
});

export const actualizarMetaSchema = z.object({
  nombre: z.string().trim().min(1).max(100).optional(),
  montoMeta: z.number().int().positive().max(MONTO_MAX).optional(),
  fechaMeta: fechaApp.nullable().optional(),
  activa: z.boolean().optional(),
});

export const movimientoMetaSchema = z.object({
  tipo: z.enum(['aporte', 'retiro']),
  monto: z.number().int().positive().max(MONTO_MAX),
  fecha: fechaApp.optional(),
  metodoPagoId: z.string().uuid().nullable().optional(),
});
