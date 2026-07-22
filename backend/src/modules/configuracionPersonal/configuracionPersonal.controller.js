import { asyncHandler } from '../../middleware/asyncHandler.js';
import { actualizarConfiguracionSchema, actualizarPuntosCorteSchema } from './configuracionPersonal.schema.js';
import {
  obtenerConfiguracion,
  actualizarFrecuencia,
  actualizarPuntosCorte,
} from './configuracionPersonal.service.js';

export const getConfiguracion = asyncHandler(async (req, res) => {
  const configuracion = await obtenerConfiguracion(req.usuario);
  res.json(configuracion);
});

export const patchConfiguracion = asyncHandler(async (req, res) => {
  const { frecuenciaCortePersonal } = actualizarConfiguracionSchema.parse(req.body);
  const configuracion = await actualizarFrecuencia(req.usuario, frecuenciaCortePersonal);
  res.json(configuracion);
});

export const putPuntosCorte = asyncHandler(async (req, res) => {
  const { puntos } = actualizarPuntosCorteSchema.parse(req.body);
  const puntosCorte = await actualizarPuntosCorte(req.usuario, puntos);
  res.json({ puntosCorte });
});
