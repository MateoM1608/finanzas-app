import { z } from 'zod';

export const crearCategoriaSchema = z.object({
  nombre: z.string().trim().min(1).max(60),
  aplicaA: z.array(z.enum(['gasto', 'ingreso', 'ahorro'])).min(1),
});

export const actualizarCategoriaSchema = z.object({
  nombre: z.string().trim().min(1).max(60).optional(),
  aplicaA: z.array(z.enum(['gasto', 'ingreso', 'ahorro'])).min(1).optional(),
});
