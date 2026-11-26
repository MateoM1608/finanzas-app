import { fechaApp, MONTO_MAX } from '../../utils/validacion.js';
import { z } from 'zod';
import { centavosUsd, tasaCambio } from '../../utils/dolares.js';

const dia = z.number().int().min(1).max(31).nullable().optional();

// Solo los datos que la app necesita de una tarjeta: nunca el número
// completo, el código de seguridad ni la fecha de vencimiento.
export const guardarMetodoPagoSchema = z.object({
  nombre: z.string().trim().min(1).max(60),
  tipo: z.enum(['efectivo', 'debito', 'tarjeta_credito', 'credito_almacen', 'otro']).optional(),
  ultimos4: z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'Solo los últimos 4 dígitos')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  diaCorte: dia,
  diaPago: dia,
  cupo: z.number().int().positive().max(MONTO_MAX).nullable().optional(),
  tasaMensual: z.number().min(0).max(10).optional(),
  sistemaInteres: z.enum(['capital_fijo', 'cuota_fija']).optional(),
  // Solo al crear: lo que hay hoy en la cuenta (o lo que se debe en la tarjeta).
  // En una tarjeta, también lo que se debe en dólares (centavos) con su tasa.
  saldoInicial: z
    .object({
      monto: z.number().int().min(0).max(MONTO_MAX),
      fecha: fechaApp,
      montoUsd: centavosUsd.nullable().optional(),
      trm: tasaCambio.nullable().optional(),
    })
    .optional(),
});

// Punto de partida de una cuenta: monto 0 lo quita.
export const saldoInicialSchema = z.object({
  monto: z.number().int().min(0).max(MONTO_MAX),
  fecha: fechaApp,
  montoUsd: centavosUsd.nullable().optional(),
  trm: tasaCambio.nullable().optional(),
});

// Pago de la parte en dólares: montoUsd = US$ que cubre (centavos); monto = pesos que costó.
export const pagoTarjetaSchema = z.object({
  monto: z.number().int().positive().max(MONTO_MAX),
  fecha: fechaApp,
  metodoPagoId: z.string().uuid().nullable().optional(),
  montoUsd: centavosUsd.nullable().optional(),
});
