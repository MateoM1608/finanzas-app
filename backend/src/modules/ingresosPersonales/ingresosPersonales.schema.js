import { fechaApp, MONTO_MAX } from '../../utils/validacion.js';
import { z } from 'zod';

export const crearIngresoPersonalSchema = z.object({
  monto: z.number().int().positive().max(MONTO_MAX),
  fecha: fechaApp,
  descripcion: z.string().trim().min(1).max(255).optional(),
  estado: z.enum(['recibido', 'pendiente']).optional(),
  metodoPagoId: z.string().uuid().nullable().optional(),
  categoriaId: z.string().uuid().nullable().optional(),
});

export const actualizarIngresoPersonalSchema = z.object({
  monto: z.number().int().positive().max(MONTO_MAX).optional(),
  fecha: fechaApp.optional(),
  descripcion: z.string().trim().min(1).max(255).nullable().optional(),
  estado: z.enum(['recibido', 'pendiente']).optional(),
  metodoPagoId: z.string().uuid().nullable().optional(),
  categoriaId: z.string().uuid().nullable().optional(),
});

export const cambiarMetodoSchema = z.object({
  metodoPagoId: z.string().uuid().nullable(),
});
