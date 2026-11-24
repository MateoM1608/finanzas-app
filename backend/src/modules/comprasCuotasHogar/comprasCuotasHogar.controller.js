import { asyncHandler } from '../../middleware/asyncHandler.js';
import { crearCompraHogarSchema, actualizarCompraHogarSchema } from './comprasCuotasHogar.schema.js';
import { listarCompras, crearCompra, actualizarCompra, eliminarCompra } from './comprasCuotasHogar.service.js';

export const getCompras = asyncHandler(async (req, res) => {
  res.json({ compras: await listarCompras(req.usuario) });
});

export const postCompra = asyncHandler(async (req, res) => {
  const data = crearCompraHogarSchema.parse(req.body);
  res.status(201).json({ compra: await crearCompra(req.usuario, data) });
});

export const deleteCompra = asyncHandler(async (req, res) => {
  await eliminarCompra(req.usuario, req.params.id);
  res.status(204).send();
});

export const patchCompra = asyncHandler(async (req, res) => {
  const data = actualizarCompraHogarSchema.parse(req.body);
  res.json({ compra: await actualizarCompra(req.usuario, req.params.id, data) });
});
