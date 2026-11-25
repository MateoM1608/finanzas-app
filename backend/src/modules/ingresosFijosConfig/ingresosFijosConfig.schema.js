import { fechaApp, MONTO_MAX } from '../../utils/validacion.js';
import { z } from 'zod';

export const crearIngresoFijoSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  monto: z.number().int().positive().max(MONTO_MAX),
  frecuencia: z.enum(['semanal', 'quincenal', 'mensual']),
  fechaInicio: fechaApp,
  modo: z.enum(['automatico', 'manual']),
  categoriaId: z.string().uuid().nullable().optional(),
});

export const actualizarIngresoFijoSchema = z.object({
  nombre: z.string().trim().min(1).max(100).optional(),
  monto: z.number().int().positive().max(MONTO_MAX).optional(),
  frecuencia: z.enum(['semanal', 'quincenal', 'mensual']).optional(),
  modo: z.enum(['automatico', 'manual']).optional(),
  categoriaId: z.string().uuid().nullable().optional(),
  activo: z.boolean().optional(),
});
