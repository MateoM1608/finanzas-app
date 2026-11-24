import { asyncHandler } from '../../middleware/asyncHandler.js';
import { crearGastoVariableSchema, actualizarGastoVariableSchema, pagarCuotaVariableSchema } from './gastosVariables.schema.js';
import {
  pagarCuotaVariable,
  deshacerPagoCuotaVariable,
  listarGastosVariables,
  crearGastoVariable,
  actualizarGastoVariable,
  eliminarGastoVariable,
} from './gastosVariables.service.js';

export const getGastosVariables = asyncHandler(async (req, res) => {
  const gastos = await listarGastosVariables(req.usuario);
  res.json({ gastos });
});

export const postGastoVariable = asyncHandler(async (req, res) => {
  const data = crearGastoVariableSchema.parse(req.body);
  const gasto = await crearGastoVariable(req.usuario, data);
  res.status(201).json({ gasto });
});

export const patchGastoVariable = asyncHandler(async (req, res) => {
  const data = actualizarGastoVariableSchema.parse(req.body);
  const gasto = await actualizarGastoVariable(req.usuario, req.params.id, data);
  res.json({ gasto });
});

export const deleteGastoVariable = asyncHandler(async (req, res) => {
  await eliminarGastoVariable(req.usuario, req.params.id);
  res.status(204).send();
});

export const postPagarCuota = asyncHandler(async (req, res) => {
  const data = pagarCuotaVariableSchema.parse(req.body ?? {});
  res.json({ gasto: await pagarCuotaVariable(req.usuario, req.params.id, data) });
});

export const postDeshacerPagoCuota = asyncHandler(async (req, res) => {
  res.json({ gasto: await deshacerPagoCuotaVariable(req.usuario, req.params.id) });
});
