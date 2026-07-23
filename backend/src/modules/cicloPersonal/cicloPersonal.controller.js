import { asyncHandler } from '../../middleware/asyncHandler.js';
import { actualizarCicloPersonalSchema } from './cicloPersonal.schema.js';
import { obtenerCicloPersonal, actualizarCicloPersonal } from './cicloPersonal.service.js';

export const getCiclo = asyncHandler(async (req, res) => {
  res.json(obtenerCicloPersonal(req.usuario));
});

export const patchCiclo = asyncHandler(async (req, res) => {
  const { frecuenciaCicloPersonal } = actualizarCicloPersonalSchema.parse(req.body);
  const ciclo = await actualizarCicloPersonal(req.usuario, frecuenciaCicloPersonal);
  res.json(ciclo);
});
