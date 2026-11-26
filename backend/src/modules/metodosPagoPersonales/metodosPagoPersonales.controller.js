import { asyncHandler } from '../../middleware/asyncHandler.js';
import { guardarMetodoPagoSchema, pagoTarjetaSchema, saldoInicialSchema } from './metodosPagoPersonales.schema.js';
import {
  registrarPagoTarjeta,
  listarMetodosPago,
  crearMetodoPago,
  actualizarMetodoPago,
  eliminarMetodoPago,
  guardarSaldoInicial,
} from './metodosPagoPersonales.service.js';
import { obtenerTrm } from '../../utils/dolares.js';
import { HttpError } from '../../middleware/errorHandler.js';

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

export const putSaldoInicial = asyncHandler(async (req, res) => {
  const data = saldoInicialSchema.parse(req.body);
  res.json({ saldoInicial: await guardarSaldoInicial(req.usuario, req.params.id, data) });
});

export const postPagoTarjeta = asyncHandler(async (req, res) => {
  const data = pagoTarjetaSchema.parse(req.body);
  res.status(201).json({ pago: await registrarPagoTarjeta(req.usuario, req.params.id, data) });
});

// TRM oficial de una fecha (?fecha=YYYY-MM-DD) o de hoy, para sugerir la tasa
// de una compra en dólares. null si no se pudo consultar ni hay una usada antes.
export const getTrm = asyncHandler(async (req, res) => {
  const fecha = req.query.fecha ? String(req.query.fecha) : null;
  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new HttpError(400, 'Fecha inválida');
  res.json({ trm: await obtenerTrm(req.usuario.id, fecha) });
});
