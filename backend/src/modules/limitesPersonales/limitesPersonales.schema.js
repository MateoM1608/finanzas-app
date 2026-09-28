import { z } from 'zod';

export const crearLimiteSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  tipoObjetivo: z.enum(['categoria', 'obligatorios', 'no_obligatorios', 'todo_gasto']),
  categoriaId: z.string().uuid().nullable().optional(),
  reglaTipo: z.enum(['porcentaje', 'monto_fijo']),
  reglaValor: z.number().int().positive(),
});

export const actualizarLimiteSchema = z.object({
  nombre: z.string().trim().min(1).max(100).optional(),
  tipoObjetivo: z.enum(['categoria', 'obligatorios', 'no_obligatorios', 'todo_gasto']).optional(),
  categoriaId: z.string().uuid().nullable().optional(),
  reglaTipo: z.enum(['porcentaje', 'monto_fijo']).optional(),
  reglaValor: z.number().int().positive().optional(),
  activo: z.boolean().optional(),
});
