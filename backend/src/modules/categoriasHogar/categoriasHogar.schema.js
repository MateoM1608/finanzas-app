import { z } from 'zod';
import { MONTO_MAX } from '../../utils/validacion.js';

export const crearCategoriaSchema = z.object({ nombre: z.string().trim().min(1).max(60) });
export const actualizarCategoriaSchema = z.object({
  nombre: z.string().trim().min(1).max(60).optional(),
  activo: z.boolean().optional(),
});

export const crearTopeSchema = z.object({
  categoriaId: z.string().uuid().nullable().optional(),
  montoMensual: z.number().int().positive().max(MONTO_MAX),
});
export const actualizarTopeSchema = z.object({
  montoMensual: z.number().int().positive().max(MONTO_MAX).optional(),
  activo: z.boolean().optional(),
});
