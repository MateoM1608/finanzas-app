import { fechaApp, MONTO_MAX } from '../../utils/validacion.js';
import { z } from 'zod';

const repartoItemSchema = z.object({
  usuarioId: z.string().uuid(),
  monto: z.number().int().nonnegative(),
});

export const crearGastoVariableSchema = z.object({
  item: z.string().trim().min(1).max(150),
  valorTotal: z.number().int().positive().max(MONTO_MAX),
  pagoUsuarioId: z.string().uuid(),
  fecha: fechaApp,
  metodoPagoId: z.string().uuid().nullable().optional(),
  repartos: z.array(repartoItemSchema).optional(),
});

export const actualizarGastoVariableSchema = z.object({
  item: z.string().trim().min(1).max(150).optional(),
  valorTotal: z.number().int().positive().max(MONTO_MAX).optional(),
  pagoUsuarioId: z.string().uuid().optional(),
  fecha: fechaApp.optional(),
  metodoPagoId: z.string().uuid().nullable().optional(),
  repartos: z.array(repartoItemSchema).optional(),
});

export const pagarCuotaVariableSchema = z.object({
  pagoUsuarioId: z.string().uuid().optional(),
  fechaPago: fechaApp.optional(),
});
