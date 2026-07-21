import { z } from 'zod';

export const crearConceptoSchema = z
  .object({
    nombre: z.string().trim().min(1).max(100),
    tipoMonto: z.enum(['fijo', 'variable']),
    montoDefault: z.number().int().positive().optional(),
    pagadorDefaultUsuarioId: z.string().uuid().nullable().optional(),
  })
  .refine((data) => data.tipoMonto === 'variable' || data.montoDefault !== undefined, {
    message: 'Los conceptos de monto fijo requieren montoDefault',
    path: ['montoDefault'],
  });

export const actualizarConceptoSchema = z.object({
  nombre: z.string().trim().min(1).max(100).optional(),
  activo: z.boolean().optional(),
  tipoMonto: z.enum(['fijo', 'variable']).optional(),
  montoDefault: z.number().int().positive().nullable().optional(),
  pagadorDefaultUsuarioId: z.string().uuid().nullable().optional(),
});

export const asignarPuntosCorteSchema = z.object({
  puntoCorteIds: z.array(z.string().uuid()),
});
