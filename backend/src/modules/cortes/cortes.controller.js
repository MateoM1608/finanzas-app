import { asyncHandler } from '../../middleware/asyncHandler.js';
import { togglearItemSchema } from './cortes.schema.js';
import {
  listarCortes,
  obtenerCorteAbierto,
  obtenerCorte,
  iniciarCorte,
  togglearItem,
  confirmarCorte,
} from './cortes.service.js';

export const getCortes = asyncHandler(async (req, res) => {
  const cortes = await listarCortes(req.usuario);
  res.json({ cortes });
});

export const getCorteAbierto = asyncHandler(async (req, res) => {
  const corte = await obtenerCorteAbierto(req.usuario);
  res.json({ corte });
});

export const getCorteDetalle = asyncHandler(async (req, res) => {
  const corte = await obtenerCorte(req.usuario, req.params.id);
  res.json({ corte });
});

export const postCorte = asyncHandler(async (req, res) => {
  const { corte, motivo } = await iniciarCorte(req.usuario);
  res.status(corte ? 201 : 200).json({ corte, motivo });
});

export const patchCorteItem = asyncHandler(async (req, res) => {
  const { incluido } = togglearItemSchema.parse(req.body);
  const corte = await togglearItem(req.usuario, req.params.id, req.params.itemId, incluido);
  res.json({ corte });
});

export const postConfirmarCorte = asyncHandler(async (req, res) => {
  const corte = await confirmarCorte(req.usuario, req.params.id);
  res.json({ corte });
});
