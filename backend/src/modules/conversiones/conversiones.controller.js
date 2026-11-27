import { asyncHandler } from '../../middleware/asyncHandler.js';
import { crearGastoVariableSchema } from '../gastosVariables/gastosVariables.schema.js';
import { crearCompraHogarSchema } from '../comprasCuotasHogar/comprasCuotasHogar.schema.js';
import { crearGastoPersonalSchema } from '../gastosPersonales/gastosPersonales.schema.js';
import { crearCompraPersonalSchema } from '../comprasCuotasPersonales/comprasCuotasPersonales.schema.js';
import { gastoHogarACompra, compraHogarAGasto, gastoPersonalACompra, compraPersonalAGasto } from './conversiones.service.js';

export const postGastoHogarACompra = asyncHandler(async (req, res) => {
  const data = crearCompraHogarSchema.parse(req.body);
  res.status(201).json({ compra: await gastoHogarACompra(req.usuario, req.params.id, data) });
});

export const postCompraHogarAGasto = asyncHandler(async (req, res) => {
  const data = crearGastoVariableSchema.parse(req.body);
  res.status(201).json({ gasto: await compraHogarAGasto(req.usuario, req.params.id, data) });
});

export const postGastoPersonalACompra = asyncHandler(async (req, res) => {
  const data = crearCompraPersonalSchema.parse(req.body);
  res.status(201).json({ compra: await gastoPersonalACompra(req.usuario, req.params.id, data) });
});

export const postCompraPersonalAGasto = asyncHandler(async (req, res) => {
  const data = crearGastoPersonalSchema.parse(req.body);
  res.status(201).json({ gasto: await compraPersonalAGasto(req.usuario, req.params.id, data) });
});
