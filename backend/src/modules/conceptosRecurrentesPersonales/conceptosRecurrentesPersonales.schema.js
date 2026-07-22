import { z } from 'zod';

export const crearConceptoSchema = z
  .object({
    nombre: z.string().trim().min(1).max(100),
    categoria: z.string().trim().min(1).max(50).optional(),
    tipoMonto: z.enum(['fijo', 'variable']),
    montoDefault: z.number().int().positive().optional(),
  })
  .refine((data) => data.tipoMonto === 'variable' || data.montoDefault !== undefined, {
    message: 'Los conceptos de monto fijo requieren montoDefault',
    path: ['montoDefault'],
  });

export const actualizarConceptoSchema = z.object({
  nombre: z.string().trim().min(1).max(100).optional(),
  categoria: z.string().trim().min(1).max(50).nullable().optional(),
  activo: z.boolean().optional(),
  tipoMonto: z.enum(['fijo', 'variable']).optional(),
  montoDefault: z.number().int().positive().nullable().optional(),
});

export const asignarPuntosCorteSchema = z.object({
  puntoCorteIds: z.array(z.string().uuid()),
});
