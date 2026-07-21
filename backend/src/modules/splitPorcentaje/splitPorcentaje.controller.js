import { asyncHandler } from '../../middleware/asyncHandler.js';
import { actualizarSplitSchema, contextoSplitSchema } from './splitPorcentaje.schema.js';
import { obtenerSplitVigente, actualizarSplit } from './splitPorcentaje.service.js';

export const getSplit = asyncHandler(async (req, res) => {
  const contexto = contextoSplitSchema.parse(req.query.contexto);
  const split = await obtenerSplitVigente(req.usuario, contexto);
  res.json({ split, contexto });
});

export const putSplit = asyncHandler(async (req, res) => {
  const contexto = contextoSplitSchema.parse(req.query.contexto);
  const { splits } = actualizarSplitSchema.parse(req.body);
  const split = await actualizarSplit(req.usuario, splits, contexto);
  res.json({ split, contexto });
});
