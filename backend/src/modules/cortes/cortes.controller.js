import { asyncHandler } from '../../middleware/asyncHandler.js';
import { patchItemSchema } from './cortes.schema.js';
import {
  listarCortes,
  obtenerCorteAbierto,
  obtenerCorte,
  iniciarCorte,
  togglearItem,
  actualizarItemCorte,
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
  const data = patchItemSchema.parse(req.body);
  const corte =
    data.incluido !== undefined
      ? await togglearItem(req.usuario, req.params.id, req.params.itemId, data.incluido)
      : await actualizarItemCorte(req.usuario, req.params.id, req.params.itemId, data);
  res.json({ corte });
});

export const postConfirmarCorte = asyncHandler(async (req, res) => {
  const corte = await confirmarCorte(req.usuario, req.params.id);
  res.json({ corte });
});
