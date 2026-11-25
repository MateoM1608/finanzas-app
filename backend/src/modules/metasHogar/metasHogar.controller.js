import { asyncHandler } from '../../middleware/asyncHandler.js';
import { crearMetaSchema, actualizarMetaSchema, movimientoMetaSchema } from './metasHogar.schema.js';
import {
  listarMetas,
  crearMeta,
  actualizarMeta,
  eliminarMeta,
  registrarMovimiento,
  eliminarMovimiento,
} from './metasHogar.service.js';

export const getMetas = asyncHandler(async (req, res) => {
  res.json({ metas: await listarMetas(req.usuario) });
});
export const postMeta = asyncHandler(async (req, res) => {
  res.status(201).json({ meta: await crearMeta(req.usuario, crearMetaSchema.parse(req.body)) });
});
export const patchMeta = asyncHandler(async (req, res) => {
  res.json({ meta: await actualizarMeta(req.usuario, req.params.id, actualizarMetaSchema.parse(req.body)) });
});
export const deleteMeta = asyncHandler(async (req, res) => {
  await eliminarMeta(req.usuario, req.params.id);
  res.status(204).send();
});
export const postMovimiento = asyncHandler(async (req, res) => {
  res.status(201).json({ meta: await registrarMovimiento(req.usuario, req.params.id, movimientoMetaSchema.parse(req.body)) });
});
export const deleteMovimiento = asyncHandler(async (req, res) => {
  res.json({ meta: await eliminarMovimiento(req.usuario, req.params.id, req.params.movId) });
});
