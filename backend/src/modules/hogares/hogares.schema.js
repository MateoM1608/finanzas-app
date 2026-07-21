import { z } from 'zod';

export const crearHogarSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  frecuenciaCorte: z.enum(['semanal', 'quincenal', 'mensual']),
});

export const joinHogarSchema = z.object({
  codigo: z.string().trim().min(1).max(20),
});

export const actualizarHogarSchema = z.object({
  nombre: z.string().trim().min(1).max(100).optional(),
  frecuenciaCorte: z.enum(['semanal', 'quincenal', 'mensual']).optional(),
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

export const actualizarPermisosMiembroSchema = z.object({
  puedeEditarGastos: z.boolean().optional(),
  puedeInvitar: z.boolean().optional(),
});

export const transferirAdminSchema = z.object({
  nuevoAdminId: z.string().uuid(),
});
