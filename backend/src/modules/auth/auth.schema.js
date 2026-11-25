import { z } from 'zod';

export const registerSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  usuario: z.string().trim().min(3).max(50).toLowerCase(),
  password: z.string().min(8).max(100),
});

export const loginSchema = z.object({
  usuario: z.string().trim().min(1).max(50).toLowerCase(),
  password: z.string().min(1).max(100),
});

export const cambiarPasswordSchema = z.object({
  actual: z.string().min(1).max(100),
  nueva: z.string().min(8).max(100),
});
