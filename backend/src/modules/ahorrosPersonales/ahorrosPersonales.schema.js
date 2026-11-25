import { fechaApp, MONTO_MAX } from '../../utils/validacion.js';
import { z } from 'zod';

export const crearAhorroSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  montoMetaTotal: z.number().int().positive().max(MONTO_MAX).nullable().optional(),
  reglaTipo: z.enum(['porcentaje', 'monto_fijo']),
  reglaValor: z.number().int().positive().max(MONTO_MAX),
  baseCalculo: z.enum(['ingreso_menos_obligatorios', 'disponible_total']).optional(),
  modoTransaccion: z.enum(['automatico', 'manual']),
  categoriaId: z.string().uuid().nullable().optional(),
});

export const actualizarAhorroSchema = z.object({
  nombre: z.string().trim().min(1).max(100).optional(),
  montoMetaTotal: z.number().int().positive().max(MONTO_MAX).nullable().optional(),
  reglaTipo: z.enum(['porcentaje', 'monto_fijo']).optional(),
  reglaValor: z.number().int().positive().max(MONTO_MAX).optional(),
  baseCalculo: z.enum(['ingreso_menos_obligatorios', 'disponible_total']).optional(),
  modoTransaccion: z.enum(['automatico', 'manual']).optional(),
  categoriaId: z.string().uuid().nullable().optional(),
  activo: z.boolean().optional(),
});

export const crearTransaccionSchema = z.object({
  tipo: z.enum(['aporte', 'retiro']).optional(),
  monto: z.number().int().positive().max(MONTO_MAX),
  fecha: fechaApp.optional(),
  metodoPagoId: z.string().uuid().nullable().optional(),
});
