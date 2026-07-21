import { z } from 'zod';

const repartoItemSchema = z.object({
  usuarioId: z.string().uuid(),
  monto: z.number().int().nonnegative(),
});

export const crearGastoVariableSchema = z.object({
  item: z.string().trim().min(1).max(150),
  valorTotal: z.number().int().positive(),
  pagoUsuarioId: z.string().uuid(),
  fechaLimite: z.coerce.date(),
  repartos: z.array(repartoItemSchema).optional(),
});

export const actualizarGastoVariableSchema = z.object({
  item: z.string().trim().min(1).max(150).optional(),
  valorTotal: z.number().int().positive().optional(),
  pagoUsuarioId: z.string().uuid().optional(),
  fechaLimite: z.coerce.date().optional(),
  repartos: z.array(repartoItemSchema).optional(),
});
