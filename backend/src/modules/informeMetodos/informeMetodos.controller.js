import { z } from 'zod';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { obtenerInforme } from './informeMetodos.service.js';

const querySchema = z.object({ mes: z.string().regex(/^\d{4}-\d{2}$/).optional() });

export const getInforme = asyncHandler(async (req, res) => {
  const { mes } = querySchema.parse(req.query);
  res.json(await obtenerInforme(req.usuario, req.params.metodoId, mes));
});
