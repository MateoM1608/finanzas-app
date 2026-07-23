import { z } from 'zod';

export const guardarMetodoPagoSchema = z.object({
  nombre: z.string().trim().min(1).max(60),
});
