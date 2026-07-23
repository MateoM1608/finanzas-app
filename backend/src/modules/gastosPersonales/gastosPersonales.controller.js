import { asyncHandler } from '../../middleware/asyncHandler.js';
import { crearGastoPersonalSchema, actualizarGastoPersonalSchema } from './gastosPersonales.schema.js';
import {
  listarGastosPersonales,
  crearGastoPersonal,
  actualizarGastoPersonal,
  eliminarGastoPersonal,
} from './gastosPersonales.service.js';

export const getGastos = asyncHandler(async (req, res) => {
  const gastos = await listarGastosPersonales(req.usuario.id);
  res.json({ gastos });
});

export const postGasto = asyncHandler(async (req, res) => {
  const data = crearGastoPersonalSchema.parse(req.body);
  const gasto = await crearGastoPersonal(req.usuario.id, data);
  res.status(201).json({ gasto });
});

export const patchGasto = asyncHandler(async (req, res) => {
  const data = actualizarGastoPersonalSchema.parse(req.body);
  const gasto = await actualizarGastoPersonal(req.usuario.id, req.params.id, data);
  res.json({ gasto });
});

export const deleteGasto = asyncHandler(async (req, res) => {
  await eliminarGastoPersonal(req.usuario.id, req.params.id);
  res.status(204).send();
});
