import { z } from 'zod';

const repartoItemSchema = z.object({
  usuarioId: z.string().uuid(),
  monto: z.number().int().nonnegative(),
});

export const crearGastoVariableSchema = z.object({
  item: z.string().trim().min(1).max(150),
  valorTotal: z.number().int().positive(),
  pagoUsuarioId: z.string().uuid(),
  fecha: z.coerce.date(),
  metodoPagoId: z.string().uuid().nullable().optional(),
  repartos: z.array(repartoItemSchema).optional(),
});

export const actualizarGastoVariableSchema = z.object({
  item: z.string().trim().min(1).max(150).optional(),
  valorTotal: z.number().int().positive().optional(),
  pagoUsuarioId: z.string().uuid().optional(),
  fecha: z.coerce.date().optional(),
  metodoPagoId: z.string().uuid().nullable().optional(),
  repartos: z.array(repartoItemSchema).optional(),
});

export const pagarCuotaVariableSchema = z.object({
  pagoUsuarioId: z.string().uuid().optional(),
  fechaPago: z.coerce.date().optional(),
});
