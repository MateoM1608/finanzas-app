import { asyncHandler } from '../../middleware/asyncHandler.js';
import { crearConceptoSchema, actualizarConceptoSchema } from './conceptosRecurrentes.schema.js';
import {
  listarConceptos,
  crearConcepto,
  actualizarConcepto,
  eliminarConcepto,
} from './conceptosRecurrentes.service.js';

export const getConceptos = asyncHandler(async (req, res) => {
  const conceptos = await listarConceptos(req.usuario);
  res.json({ conceptos });
});

export const postConcepto = asyncHandler(async (req, res) => {
  const data = crearConceptoSchema.parse(req.body);
  const concepto = await crearConcepto(req.usuario, data);
  res.status(201).json({ concepto });
});

export const patchConcepto = asyncHandler(async (req, res) => {
  const data = actualizarConceptoSchema.parse(req.body);
  const concepto = await actualizarConcepto(req.usuario, req.params.id, data);
  res.json({ concepto });
});

export const deleteConcepto = asyncHandler(async (req, res) => {
  await eliminarConcepto(req.usuario, req.params.id);
  res.status(204).send();
});
