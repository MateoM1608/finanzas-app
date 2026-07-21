import { z } from 'zod';

export const crearHogarSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  frecuenciaCorte: z.enum(['semanal', 'quincenal', 'mensual']),
});

export const joinHogarSchema = z.object({
  codigo: z.string().trim().min(1).max(20),
});
