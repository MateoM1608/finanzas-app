import { z } from 'zod';

export const togglearItemSchema = z.object({
  incluido: z.boolean(),
});
