import { asyncHandler } from '../../middleware/asyncHandler.js';
import { actualizarSplitSchema } from './splitPorcentaje.schema.js';
import { obtenerSplitVigente, actualizarSplit } from './splitPorcentaje.service.js';

export const getSplit = asyncHandler(async (req, res) => {
  const split = await obtenerSplitVigente(req.usuario);
  res.json({ split });
});

export const putSplit = asyncHandler(async (req, res) => {
  const { splits } = actualizarSplitSchema.parse(req.body);
  const split = await actualizarSplit(req.usuario, splits);
  res.json({ split });
});
