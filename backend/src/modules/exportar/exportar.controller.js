import { z } from 'zod';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { TABLAS, armarTabla, aCsv, aXlsx } from './exportar.service.js';
import { hoyUTC } from '../../utils/fechas.js';

const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform((t) => new Date(`${t}T00:00:00.000Z`));

const querySchema = z.object({
  formato: z.enum(['xlsx', 'csv']).default('xlsx'),
  // CSV: una tabla (por defecto Movimientos). XLSX: todas, una hoja cada una.
  tabla: z.enum(Object.keys(TABLAS)).default('movimientos'),
  desde: fecha.optional(),
  hasta: fecha.optional(),
});

export const getExportar = asyncHandler(async (req, res) => {
  const q = querySchema.parse(req.query);
  if (q.desde && q.hasta && q.desde > q.hasta) throw new HttpError(400, 'La fecha inicial es posterior a la final');
  const rango = { desde: q.desde, hasta: q.hasta };
  const sufijo = hoyUTC().toISOString().slice(0, 10);

  res.setHeader('Cache-Control', 'no-store');
  if (q.formato === 'csv') {
    const tabla = await armarTabla(req.usuario, q.tabla, rango);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="finanzas_${q.tabla}_${sufijo}.csv"`);
    return res.send(aCsv(tabla));
  }
  const tablas = [];
  for (const clave of Object.keys(TABLAS)) tablas.push([clave, await armarTabla(req.usuario, clave, rango)]);
  const buffer = await aXlsx(tablas);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="finanzas_${sufijo}.xlsx"`);
  return res.send(Buffer.from(buffer));
});
