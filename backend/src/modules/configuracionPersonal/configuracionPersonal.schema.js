import { z } from 'zod';

export const actualizarConfiguracionSchema = z.object({
  frecuenciaCortePersonal: z.enum(['semanal', 'quincenal', 'mensual']),
});

export const actualizarPuntosCorteSchema = z.object({
  puntos: z
    .array(
      z.object({
        id: z.string().uuid(),
        referencia: z.string().trim().min(1).max(50),
      }),
    )
    .min(1),
});
