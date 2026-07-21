import { asyncHandler } from '../../middleware/asyncHandler.js';
import {
  crearConceptoSchema,
  actualizarConceptoSchema,
  asignarPuntosCorteSchema,
} from './conceptosRecurrentes.schema.js';
import {
  listarConceptos,
  crearConcepto,
  actualizarConcepto,
  asignarPuntosCorte,
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

export const putConceptoPuntosCorte = asyncHandler(async (req, res) => {
  const { puntoCorteIds } = asignarPuntosCorteSchema.parse(req.body);
  const concepto = await asignarPuntosCorte(req.usuario, req.params.id, puntoCorteIds);
  res.json({ concepto });
});
