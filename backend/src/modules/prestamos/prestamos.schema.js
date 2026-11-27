import { fechaApp, MONTO_MAX } from '../../utils/validacion.js';
import { z } from 'zod';

const uuid = z.string().uuid();
const monto = z.number().int().positive().max(MONTO_MAX);

export const crearPrestamoSchema = z
  .object({
    ambito: z.enum(['personal', 'hogar']),
    nombre: z.string().trim().min(1).max(100),
    entidad: z.string().trim().max(100).optional(),
    tipo: z.enum(['libre_inversion', 'vehiculo', 'vivienda', 'educativo', 'persona', 'otro']).optional(),
    // Préstamo nuevo: monto y plazo. Ya en curso: saldo de hoy, cuotas que faltan y ya pagadas.
    enCurso: z.boolean().optional(),
    montoPrestado: monto.optional(),
    plazoMeses: z.number().int().min(1).max(360).optional(),
    saldoActual: monto.optional(),
    cuotasRestantes: z.number().int().min(1).max(360).optional(),
    cuotasPagadas: z.number().int().min(0).max(MONTO_MAX).max(360).optional(),
    // Tasa en %: efectiva anual (tasaEsAnual) o mensual.
    tasa: z.number().min(0).max(200).optional(),
    tasaEsAnual: z.boolean().optional(),
    sistemaInteres: z.enum(['cuota_fija', 'capital_fijo']).optional(),
    seguroMensual: z.number().int().min(0).max(MONTO_MAX).optional(),
    fechaDesembolso: fechaApp.optional(),
    fechaPrimeraCuota: fechaApp,
    modoCobro: z.enum(['automatico', 'manual']).optional(),
    metodoPagoId: uuid.nullable().optional(),
    pagoUsuarioId: uuid.optional(),
    categoriaId: uuid.nullable().optional(),
    // Personal, préstamo nuevo: la plata llegó a una cuenta.
    desembolso: z.object({ metodoPagoId: uuid.nullable().optional(), fecha: fechaApp.optional() }).optional(),
  })
  .refine((d) => (d.enCurso ? d.saldoActual && d.cuotasRestantes : d.montoPrestado && d.plazoMeses), {
    message: 'Un préstamo nuevo necesita monto y plazo; uno en curso, saldo actual y cuotas que faltan',
  })
  .refine((d) => d.ambito !== 'hogar' || d.pagoUsuarioId, { message: 'Indica quién paga las cuotas' });

export const actualizarPrestamoSchema = z.object({
  nombre: z.string().trim().min(1).max(100).optional(),
  entidad: z.string().trim().max(100).nullable().optional(),
  tipo: z.enum(['libre_inversion', 'vehiculo', 'vivienda', 'educativo', 'persona', 'otro']).optional(),
  categoriaId: uuid.nullable().optional(),
  modoCobro: z.enum(['automatico', 'manual']).optional(),
  metodoPagoId: uuid.nullable().optional(),
  pagoUsuarioId: uuid.optional(),
  // Condiciones del plan: recalculan las cuotas sin pagar. Siempre: tasa,
  // sistema, seguro, saldo de capital de hoy, cuotas que faltan y fecha de la
  // próxima cuota. Solo sin pagos ni abonos: monto prestado, cuotas pagadas
  // antes de registrarlo y fecha del desembolso.
  tasa: z.number().min(0).max(200).optional(),
  tasaEsAnual: z.boolean().optional(),
  sistemaInteres: z.enum(['cuota_fija', 'capital_fijo']).optional(),
  seguroMensual: z.number().int().min(0).max(MONTO_MAX).optional(),
  saldoActual: monto.optional(),
  cuotasRestantes: z.number().int().min(1).max(360).optional(),
  fechaProximaCuota: fechaApp.optional(),
  montoPrestado: monto.optional(),
  cuotasPrevias: z.number().int().min(0).max(360).optional(),
  fechaDesembolso: fechaApp.nullable().optional(),
});

export const pagarCuotaSchema = z.object({
  fecha: fechaApp.optional(),
  monto: monto.optional(),
  metodoPagoId: uuid.nullable().optional(),
  pagoUsuarioId: uuid.optional(),
});

export const abonoSchema = z.object({
  fecha: fechaApp.optional(),
  monto,
  modo: z.enum(['reducir_plazo', 'reducir_cuota']),
  metodoPagoId: uuid.nullable().optional(),
  pagoUsuarioId: uuid.optional(),
});
