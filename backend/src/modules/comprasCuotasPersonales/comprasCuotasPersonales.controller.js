import { asyncHandler } from '../../middleware/asyncHandler.js';
import { crearCompraPersonalSchema, sugerirPrimeraCuotaSchema } from './comprasCuotasPersonales.schema.js';
import { listarCompras, crearCompra, eliminarCompra, sugerirPrimeraCuota } from './comprasCuotasPersonales.service.js';

export const getCompras = asyncHandler(async (req, res) => {
  res.json({ compras: await listarCompras(req.usuario) });
});

export const getSugerirPrimeraCuota = asyncHandler(async (req, res) => {
  const params = sugerirPrimeraCuotaSchema.parse(req.query);
  res.json({ fecha: await sugerirPrimeraCuota(req.usuario, params) });
});

export const postCompra = asyncHandler(async (req, res) => {
  const data = crearCompraPersonalSchema.parse(req.body);
  res.status(201).json({ compra: await crearCompra(req.usuario, data) });
});

export const deleteCompra = asyncHandler(async (req, res) => {
  await eliminarCompra(req.usuario, req.params.id);
  res.status(204).send();
});
