import { z } from 'zod';

export const marcarItemSchema = z.object({
  incluido: z.boolean(),
});
