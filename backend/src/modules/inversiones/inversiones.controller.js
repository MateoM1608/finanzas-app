import { asyncHandler } from '../../middleware/asyncHandler.js';
import { crearInversionSchema, actualizarInversionSchema, movimientoSchema, valoracionSchema } from './inversiones.schema.js';
import {
  listarInversiones,
  crearInversion,
  actualizarInversion,
  eliminarInversion,
  registrarMovimiento,
  eliminarMovimiento,
  registrarValoracion,
  eliminarValoracion,
} from './inversiones.service.js';

export const getInversiones = asyncHandler(async (req, res) => {
  res.json(await listarInversiones(req.usuario));
});
export const postInversion = asyncHandler(async (req, res) => {
  res.status(201).json({ inversion: await crearInversion(req.usuario, crearInversionSchema.parse(req.body)) });
});
export const patchInversion = asyncHandler(async (req, res) => {
  res.json({ inversion: await actualizarInversion(req.usuario, req.params.id, actualizarInversionSchema.parse(req.body)) });
});
export const deleteInversion = asyncHandler(async (req, res) => {
  await eliminarInversion(req.usuario, req.params.id);
  res.status(204).send();
});
export const postMovimiento = asyncHandler(async (req, res) => {
  res.status(201).json({ inversion: await registrarMovimiento(req.usuario, req.params.id, movimientoSchema.parse(req.body)) });
});
export const deleteMovimiento = asyncHandler(async (req, res) => {
  res.json({ inversion: await eliminarMovimiento(req.usuario, req.params.id, req.params.movId) });
});
export const postValoracion = asyncHandler(async (req, res) => {
  res.status(201).json({ inversion: await registrarValoracion(req.usuario, req.params.id, valoracionSchema.parse(req.body)) });
});
export const deleteValoracion = asyncHandler(async (req, res) => {
  res.json({ inversion: await eliminarValoracion(req.usuario, req.params.id, req.params.valId) });
});
