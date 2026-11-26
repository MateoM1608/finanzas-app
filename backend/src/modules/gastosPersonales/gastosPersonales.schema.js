import { fechaApp, MONTO_MAX } from '../../utils/validacion.js';
import { z } from 'zod';
import { centavosUsd, tasaCambio } from '../../utils/dolares.js';

export const crearGastoPersonalSchema = z.object({
  monto: z.number().int().positive().max(MONTO_MAX),
  fecha: fechaApp,
  descripcion: z.string().trim().min(1).max(255).optional(),
  estado: z.enum(['pagado', 'pendiente']).optional(),
  esObligatorio: z.boolean().optional(),
  metodoPagoId: z.string().uuid().nullable().optional(),
  categoriaId: z.string().uuid().nullable().optional(),
  // Compra en dólares con tarjeta de crédito: US$ en centavos y la tasa;
  // `monto` es su valor en pesos.
  montoUsd: centavosUsd.nullable().optional(),
  trm: tasaCambio.nullable().optional(),
});

export const actualizarGastoPersonalSchema = z.object({
  monto: z.number().int().positive().max(MONTO_MAX).optional(),
  fecha: fechaApp.optional(),
  descripcion: z.string().trim().min(1).max(255).nullable().optional(),
  estado: z.enum(['pagado', 'pendiente']).optional(),
  esObligatorio: z.boolean().optional(),
  metodoPagoId: z.string().uuid().nullable().optional(),
  categoriaId: z.string().uuid().nullable().optional(),
  montoUsd: centavosUsd.nullable().optional(),
  trm: tasaCambio.nullable().optional(),
});

export const cambiarMetodoSchema = z.object({
  metodoPagoId: z.string().uuid().nullable(),
});
