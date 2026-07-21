import { z } from 'zod';

export const contextoSplitSchema = z.enum(['general', 'gastos_variables']).default('general');

export const actualizarSplitSchema = z.object({
  splits: z
    .array(
      z.object({
        usuarioId: z.string().uuid(),
        porcentaje: z.number().min(0).max(100),
      }),
    )
    .min(1),
});
