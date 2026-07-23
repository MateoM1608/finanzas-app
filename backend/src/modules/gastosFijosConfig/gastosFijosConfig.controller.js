import { asyncHandler } from '../../middleware/asyncHandler.js';
import { crearGastoFijoSchema, actualizarGastoFijoSchema } from './gastosFijosConfig.schema.js';
import {
  listarGastosFijos,
  crearGastoFijo,
  actualizarGastoFijo,
  eliminarGastoFijo,
} from './gastosFijosConfig.service.js';

export const getGastosFijos = asyncHandler(async (req, res) => {
  const gastosFijos = await listarGastosFijos(req.usuario);
  res.json({ gastosFijos });
});

export const postGastoFijo = asyncHandler(async (req, res) => {
  const data = crearGastoFijoSchema.parse(req.body);
  const gastoFijo = await crearGastoFijo(req.usuario, data);
  res.status(201).json({ gastoFijo });
});

export const patchGastoFijo = asyncHandler(async (req, res) => {
  const data = actualizarGastoFijoSchema.parse(req.body);
  const gastoFijo = await actualizarGastoFijo(req.usuario, req.params.id, data);
  res.json({ gastoFijo });
});

export const deleteGastoFijo = asyncHandler(async (req, res) => {
  await eliminarGastoFijo(req.usuario, req.params.id);
  res.status(204).send();
});
