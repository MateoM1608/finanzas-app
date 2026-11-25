import { asyncHandler } from '../../middleware/asyncHandler.js';
import { guardarExtractoSchema, revisarSchema, ajusteSchema, reclamoSchema } from './extractosTarjeta.schema.js';
import {
  listarCiclos,
  obtenerCiclo,
  guardarExtracto,
  revisarExtracto,
  agregarAjuste,
  resolverReclamo,
  eliminarAjuste,
} from './extractosTarjeta.service.js';

export const getCiclos = asyncHandler(async (req, res) => {
  res.json(await listarCiclos(req.usuario, req.params.metodoId));
});

export const getCiclo = asyncHandler(async (req, res) => {
  res.json(await obtenerCiclo(req.usuario, req.params.metodoId, req.params.fecha));
});

export const putExtracto = asyncHandler(async (req, res) => {
  const data = guardarExtractoSchema.parse(req.body);
  res.json(await guardarExtracto(req.usuario, req.params.metodoId, req.params.fecha, data));
});

export const postRevisar = asyncHandler(async (req, res) => {
  const { revisado } = revisarSchema.parse(req.body);
  res.json(await revisarExtracto(req.usuario, req.params.metodoId, req.params.fecha, revisado));
});

export const postAjuste = asyncHandler(async (req, res) => {
  const data = ajusteSchema.parse(req.body);
  res.status(201).json(await agregarAjuste(req.usuario, req.params.metodoId, req.params.fecha, data));
});

export const patchReclamo = asyncHandler(async (req, res) => {
  const { estadoReclamo } = reclamoSchema.parse(req.body);
  res.json(await resolverReclamo(req.usuario, req.params.id, estadoReclamo));
});

export const deleteAjuste = asyncHandler(async (req, res) => {
  res.json(await eliminarAjuste(req.usuario, req.params.id));
});
