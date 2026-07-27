import { asyncHandler } from '../../middleware/asyncHandler.js';
import { crearAhorroSchema, actualizarAhorroSchema, crearTransaccionSchema } from './ahorrosPersonales.schema.js';
import {
  listarAhorros,
  crearAhorro,
  actualizarAhorro,
  eliminarAhorro,
  registrarAporte,
  obtenerResumenAhorros,
} from './ahorrosPersonales.service.js';

export const getAhorros = asyncHandler(async (req, res) => {
  const ahorros = await listarAhorros(req.usuario);
  res.json({ ahorros });
});

export const getResumenAhorros = asyncHandler(async (req, res) => {
  const resumen = await obtenerResumenAhorros(req.usuario);
  res.json(resumen);
});

export const postAhorro = asyncHandler(async (req, res) => {
  const data = crearAhorroSchema.parse(req.body);
  const ahorro = await crearAhorro(req.usuario, data);
  res.status(201).json({ ahorro });
});

export const patchAhorro = asyncHandler(async (req, res) => {
  const data = actualizarAhorroSchema.parse(req.body);
  const ahorro = await actualizarAhorro(req.usuario, req.params.id, data);
  res.json({ ahorro });
});

export const deleteAhorro = asyncHandler(async (req, res) => {
  await eliminarAhorro(req.usuario, req.params.id);
  res.status(204).send();
});

export const postTransaccion = asyncHandler(async (req, res) => {
  const data = crearTransaccionSchema.parse(req.body);
  const transaccion = await registrarAporte(req.usuario, req.params.id, data);
  res.status(201).json({ transaccion });
});
