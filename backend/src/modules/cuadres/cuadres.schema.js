import { z } from 'zod';

export const marcarItemSchema = z.object({
  incluido: z.boolean(),
});

// Método con que quien confirma pagó o recibió su parte del neto (privado).
export const confirmarCuadreSchema = z.object({
  metodoPagoId: z.string().uuid().nullable().optional(),
});
