import { fechaApp, MONTO_MAX } from '../../utils/validacion.js';
import { z } from 'zod';

// Día del mes de una cuenta fija: 1-31, o null = último día del mes.
const diaMes = z.number().int().min(1).max(31).nullable();

const camposCalendario = {
  frecuencia: z.enum(['mensual', 'quincenal']),
  diaMes: diaMes.optional(),
  diaMes2: diaMes.optional(),
  fechaInicio: fechaApp,
};

function diasQuincenaValidos(data) {
  if (data.frecuencia !== 'quincenal') return true;
  const d1 = data.diaMes ?? 15;
  const d2 = data.diaMes2 ?? 31; // null = último día
  return d1 < d2;
}

export const crearConceptoSchema = z
  .object({
    nombre: z.string().trim().min(1).max(100),
    tipoMonto: z.enum(['fijo', 'variable']),
    montoDefault: z.number().int().positive().max(MONTO_MAX).optional(),
    responsableUsuarioId: z.string().uuid().nullable().optional(),
    ...camposCalendario,
  })
  .refine((data) => data.tipoMonto === 'variable' || data.montoDefault !== undefined, {
    message: 'Las cuentas de monto fijo requieren el monto',
    path: ['montoDefault'],
  })
  .refine(diasQuincenaValidos, {
    message: 'En una cuenta quincenal el primer día debe ser antes que el segundo',
    path: ['diaMes2'],
  });

export const actualizarConceptoSchema = z.object({
  nombre: z.string().trim().min(1).max(100).optional(),
  activo: z.boolean().optional(),
  tipoMonto: z.enum(['fijo', 'variable']).optional(),
  montoDefault: z.number().int().positive().max(MONTO_MAX).nullable().optional(),
  responsableUsuarioId: z.string().uuid().nullable().optional(),
  frecuencia: camposCalendario.frecuencia.optional(),
  diaMes: diaMes.optional(),
  diaMes2: diaMes.optional(),
  fechaInicio: camposCalendario.fechaInicio.optional(),
});
