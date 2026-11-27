import { fechaApp, MONTO_MAX } from '../../utils/validacion.js';
import { z } from 'zod';

const uuid = z.string().uuid();
const tipo = z.enum(['cdt', 'fondo', 'acciones', 'cripto', 'finca_raiz', 'otro']);

export const movimientoSchema = z.object({
  tipo: z.enum(['aporte', 'retiro']),
  monto: z.number().int().positive().max(MONTO_MAX),
  fecha: fechaApp.optional(),
  metodoPagoId: uuid.nullable().optional(),
  // false: la plata vino de otra fuente o ya estaba invertida (o, en un retiro, no llegó a una cuenta): no toca el Disponible.
  enCaja: z.boolean().optional(),
});

export const crearInversionSchema = z.object({
  ambito: z.enum(['personal', 'hogar']),
  nombre: z.string().trim().min(1).max(100),
  tipo: tipo.optional(),
  entidad: z.string().trim().max(100).optional(),
  fechaInicio: fechaApp,
  tasaEA: z.number().min(0).max(200).nullable().optional(),
  fechaVencimiento: fechaApp.nullable().optional(),
  aporteInicial: z
    .object({ monto: z.number().int().positive().max(MONTO_MAX), fecha: fechaApp.optional(), metodoPagoId: uuid.nullable().optional(), enCaja: z.boolean().optional() })
    .optional(),
});

export const actualizarInversionSchema = z.object({
  nombre: z.string().trim().min(1).max(100).optional(),
  tipo: tipo.optional(),
  entidad: z.string().trim().max(100).nullable().optional(),
  tasaEA: z.number().min(0).max(200).nullable().optional(),
  fechaVencimiento: fechaApp.nullable().optional(),
  activa: z.boolean().optional(),
});

export const valoracionSchema = z.object({
  valor: z.number().int().min(0).max(MONTO_MAX),
  fecha: fechaApp.optional(),
});
