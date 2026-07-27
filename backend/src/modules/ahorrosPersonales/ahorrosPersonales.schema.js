import { z } from 'zod';

export const crearAhorroSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  montoMetaTotal: z.number().int().positive().nullable().optional(),
  reglaTipo: z.enum(['porcentaje', 'monto_fijo']),
  reglaValor: z.number().int().positive(),
  baseCalculo: z.enum(['ingreso_menos_obligatorios', 'disponible_total']).optional(),
  modoTransaccion: z.enum(['automatico', 'manual']),
  categoriaId: z.string().uuid().nullable().optional(),
});

export const actualizarAhorroSchema = z.object({
  nombre: z.string().trim().min(1).max(100).optional(),
  montoMetaTotal: z.number().int().positive().nullable().optional(),
  reglaTipo: z.enum(['porcentaje', 'monto_fijo']).optional(),
  reglaValor: z.number().int().positive().optional(),
  baseCalculo: z.enum(['ingreso_menos_obligatorios', 'disponible_total']).optional(),
  modoTransaccion: z.enum(['automatico', 'manual']).optional(),
  categoriaId: z.string().uuid().nullable().optional(),
  activo: z.boolean().optional(),
});

export const crearTransaccionSchema = z.object({
  monto: z.number().int().positive(),
  fecha: z.coerce.date().optional(),
});
