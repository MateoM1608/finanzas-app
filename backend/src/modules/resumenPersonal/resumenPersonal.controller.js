import { asyncHandler } from '../../middleware/asyncHandler.js';
import { obtenerResumenPersonal } from './resumenPersonal.service.js';

export const getResumenPersonal = asyncHandler(async (req, res) => {
  const resumen = await obtenerResumenPersonal(req.usuario);
  res.json(resumen);
});
