import { asyncHandler } from '../../middleware/asyncHandler.js';
import { guardarMetodoPagoSchema } from './metodosPagoPersonales.schema.js';
import {
  listarMetodosPago,
  crearMetodoPago,
  actualizarMetodoPago,
  eliminarMetodoPago,
} from './metodosPagoPersonales.service.js';

export const getMetodosPago = asyncHandler(async (req, res) => {
  const metodos = await listarMetodosPago(req.usuario);
  res.json({ metodos });
});

export const postMetodoPago = asyncHandler(async (req, res) => {
  const data = guardarMetodoPagoSchema.parse(req.body);
  const metodo = await crearMetodoPago(req.usuario, data);
  res.status(201).json({ metodo });
});

export const patchMetodoPago = asyncHandler(async (req, res) => {
  const data = guardarMetodoPagoSchema.parse(req.body);
  const metodo = await actualizarMetodoPago(req.usuario, req.params.id, data);
  res.json({ metodo });
});

export const deleteMetodoPago = asyncHandler(async (req, res) => {
  await eliminarMetodoPago(req.usuario, req.params.id);
  res.status(204).send();
});
