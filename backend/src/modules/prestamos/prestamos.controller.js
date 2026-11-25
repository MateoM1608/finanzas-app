import { asyncHandler } from '../../middleware/asyncHandler.js';
import { crearPrestamoSchema, actualizarPrestamoSchema, pagarCuotaSchema, abonoSchema } from './prestamos.schema.js';
import {
  listarPrestamos,
  obtenerPrestamo,
  crearPrestamo,
  actualizarPrestamo,
  eliminarPrestamo,
  pagarCuota,
  deshacerPagoCuota,
  abonar,
  eliminarAbono,
} from './prestamos.service.js';

const numero = (req) => Number.parseInt(req.params.numero, 10);

export const getPrestamos = asyncHandler(async (req, res) => {
  res.json(await listarPrestamos(req.usuario));
});

export const getPrestamo = asyncHandler(async (req, res) => {
  res.json({ prestamo: await obtenerPrestamo(req.usuario, req.params.id) });
});

export const postPrestamo = asyncHandler(async (req, res) => {
  const data = crearPrestamoSchema.parse(req.body);
  res.status(201).json({ prestamo: await crearPrestamo(req.usuario, data) });
});

export const patchPrestamo = asyncHandler(async (req, res) => {
  const data = actualizarPrestamoSchema.parse(req.body);
  res.json({ prestamo: await actualizarPrestamo(req.usuario, req.params.id, data) });
});

export const deletePrestamo = asyncHandler(async (req, res) => {
  await eliminarPrestamo(req.usuario, req.params.id);
  res.status(204).send();
});

export const postPagarCuota = asyncHandler(async (req, res) => {
  const data = pagarCuotaSchema.parse(req.body ?? {});
  res.json({ prestamo: await pagarCuota(req.usuario, req.params.id, numero(req), data) });
});

export const postDeshacerPago = asyncHandler(async (req, res) => {
  res.json({ prestamo: await deshacerPagoCuota(req.usuario, req.params.id, numero(req)) });
});

export const postAbono = asyncHandler(async (req, res) => {
  const data = abonoSchema.parse(req.body);
  res.status(201).json({ prestamo: await abonar(req.usuario, req.params.id, data) });
});

export const deleteAbono = asyncHandler(async (req, res) => {
  res.json({ prestamo: await eliminarAbono(req.usuario, req.params.id, req.params.abonoId) });
});
