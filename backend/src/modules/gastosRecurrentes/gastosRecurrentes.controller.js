import { asyncHandler } from '../../middleware/asyncHandler.js';
import { actualizarInstanciaSchema } from './gastosRecurrentes.schema.js';
import { obtenerPeriodoActual, actualizarInstancia } from './gastosRecurrentes.service.js';

export const getPeriodoActual = asyncHandler(async (req, res) => {
  const periodo = await obtenerPeriodoActual(req.usuario);
  res.json(periodo);
});

export const patchInstancia = asyncHandler(async (req, res) => {
  const data = actualizarInstanciaSchema.parse(req.body);
  const instancia = await actualizarInstancia(req.usuario, req.params.id, data);
  res.json({ instancia });
});
