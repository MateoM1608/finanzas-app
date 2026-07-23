import { asyncHandler } from '../../middleware/asyncHandler.js';
import { crearIngresoPersonalSchema, actualizarIngresoPersonalSchema } from './ingresosPersonales.schema.js';
import {
  listarIngresosPersonales,
  crearIngresoPersonal,
  actualizarIngresoPersonal,
  eliminarIngresoPersonal,
} from './ingresosPersonales.service.js';

export const getIngresos = asyncHandler(async (req, res) => {
  const ingresos = await listarIngresosPersonales(req.usuario.id);
  res.json({ ingresos });
});

export const postIngreso = asyncHandler(async (req, res) => {
  const data = crearIngresoPersonalSchema.parse(req.body);
  const ingreso = await crearIngresoPersonal(req.usuario.id, data);
  res.status(201).json({ ingreso });
});

export const patchIngreso = asyncHandler(async (req, res) => {
  const data = actualizarIngresoPersonalSchema.parse(req.body);
  const ingreso = await actualizarIngresoPersonal(req.usuario.id, req.params.id, data);
  res.json({ ingreso });
});

export const deleteIngreso = asyncHandler(async (req, res) => {
  await eliminarIngresoPersonal(req.usuario.id, req.params.id);
  res.status(204).send();
});
