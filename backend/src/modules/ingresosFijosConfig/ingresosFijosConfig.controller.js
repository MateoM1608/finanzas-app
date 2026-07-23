import { asyncHandler } from '../../middleware/asyncHandler.js';
import { crearIngresoFijoSchema, actualizarIngresoFijoSchema } from './ingresosFijosConfig.schema.js';
import {
  listarIngresosFijos,
  crearIngresoFijo,
  actualizarIngresoFijo,
  eliminarIngresoFijo,
} from './ingresosFijosConfig.service.js';

export const getIngresosFijos = asyncHandler(async (req, res) => {
  const ingresosFijos = await listarIngresosFijos(req.usuario);
  res.json({ ingresosFijos });
});

export const postIngresoFijo = asyncHandler(async (req, res) => {
  const data = crearIngresoFijoSchema.parse(req.body);
  const ingresoFijo = await crearIngresoFijo(req.usuario, data);
  res.status(201).json({ ingresoFijo });
});

export const patchIngresoFijo = asyncHandler(async (req, res) => {
  const data = actualizarIngresoFijoSchema.parse(req.body);
  const ingresoFijo = await actualizarIngresoFijo(req.usuario, req.params.id, data);
  res.json({ ingresoFijo });
});

export const deleteIngresoFijo = asyncHandler(async (req, res) => {
  await eliminarIngresoFijo(req.usuario, req.params.id);
  res.status(204).send();
});
