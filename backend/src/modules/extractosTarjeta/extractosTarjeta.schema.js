import { fechaApp, MONTO_MAX } from '../../utils/validacion.js';
import { z } from 'zod';
import { USD_MAX_CENTAVOS } from '../../utils/dolares.js';

const monto = z.number().int().positive().max(MONTO_MAX);

export const guardarExtractoSchema = z.object({
  totalBanco: z.number().int().min(0).max(MONTO_MAX).nullable().optional(),
  // Parte en dólares del extracto del banco, en centavos de US$.
  totalBancoUsd: z.number().int().min(0).max(USD_MAX_CENTAVOS).nullable().optional(),
  notas: z.string().trim().max(500).nullable().optional(),
});

export const revisarSchema = z.object({ revisado: z.boolean() });

export const ajusteSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('correccion'), gastoId: z.string().uuid(), monto, descripcion: z.string().trim().max(200).optional() }),
  z.object({ tipo: z.literal('no_cobrado'), gastoId: z.string().uuid() }),
  z.object({
    tipo: z.literal('cargo'),
    concepto: z.enum(['interes', 'mora', 'cuota_manejo', 'seguro', 'comision', 'avance', 'otro']),
    monto,
    descripcion: z.string().trim().max(200).optional(),
    categoriaId: z.string().uuid().nullable().optional(),
  }),
  z.object({
    tipo: z.literal('no_reconocido'),
    monto,
    descripcion: z.string().trim().min(1).max(200),
    fecha: fechaApp.optional(),
  }),
]);

export const reclamoSchema = z.object({ estadoReclamo: z.enum(['pendiente', 'reversado', 'aceptado']) });
