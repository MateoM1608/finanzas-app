import { asyncHandler } from '../../middleware/asyncHandler.js';
import { crearLimiteSchema, actualizarLimiteSchema } from './limitesPersonales.schema.js';
import {
  listarLimites,
  crearLimite,
  actualizarLimite,
  eliminarLimite,
  obtenerResumenLimites,
} from './limitesPersonales.service.js';

export const getLimites = asyncHandler(async (req, res) => {
  const limites = await listarLimites(req.usuario);
  res.json({ limites });
});

export const getResumenLimites = asyncHandler(async (req, res) => {
  const resumen = await obtenerResumenLimites(req.usuario);
  res.json(resumen);
});

export const postLimite = asyncHandler(async (req, res) => {
  const data = crearLimiteSchema.parse(req.body);
  const limite = await crearLimite(req.usuario, data);
  res.status(201).json({ limite });
});

export const patchLimite = asyncHandler(async (req, res) => {
  const data = actualizarLimiteSchema.parse(req.body);
  const limite = await actualizarLimite(req.usuario, req.params.id, data);
  res.json({ limite });
});

export const deleteLimite = asyncHandler(async (req, res) => {
  await eliminarLimite(req.usuario, req.params.id);
  res.status(204).send();
});
