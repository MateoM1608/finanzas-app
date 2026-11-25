import { asyncHandler } from '../../middleware/asyncHandler.js';
import { obtenerResumenPersonal } from './resumenPersonal.service.js';
import { leerCiclo } from '../../utils/cicloQuery.js';

export const getResumenPersonal = asyncHandler(async (req, res) => {
  const resumen = await obtenerResumenPersonal(req.usuario, leerCiclo(req.query));
  res.json(resumen);
});
