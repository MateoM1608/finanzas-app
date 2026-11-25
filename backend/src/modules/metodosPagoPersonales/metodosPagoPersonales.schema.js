import { z } from 'zod';

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
  cupo: z.number().int().positive().nullable().optional(),
  tasaMensual: z.number().min(0).max(10).optional(),
  sistemaInteres: z.enum(['capital_fijo', 'cuota_fija']).optional(),
});

export const pagoTarjetaSchema = z.object({
  monto: z.number().int().positive(),
  fecha: z.coerce.date(),
  metodoPagoId: z.string().uuid().nullable().optional(),
});
