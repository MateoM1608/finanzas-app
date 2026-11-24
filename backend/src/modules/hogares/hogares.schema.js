import { z } from 'zod';

export const crearHogarSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
});

export const joinHogarSchema = z.object({
  codigo: z.string().trim().min(1).max(20),
});

export const actualizarHogarSchema = z.object({
  nombre: z.string().trim().min(1).max(100).optional(),
});

export const actualizarPermisosMiembroSchema = z.object({
  puedeEditarGastos: z.boolean().optional(),
  puedeInvitar: z.boolean().optional(),
});

export const transferirAdminSchema = z.object({
  nuevoAdminId: z.string().uuid(),
});
