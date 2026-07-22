import { asyncHandler } from '../../middleware/asyncHandler.js';
import { patchItemSchema } from './cortesPersonales.schema.js';
import {
  listarCortesPersonales,
  obtenerCortePersonalAbierto,
  obtenerCortePersonal,
  iniciarCortePersonal,
  togglearItemPersonal,
  actualizarItemCortePersonal,
  confirmarCortePersonal,
} from './cortesPersonales.service.js';

export const getCortes = asyncHandler(async (req, res) => {
  const cortes = await listarCortesPersonales(req.usuario);
  res.json({ cortes });
});

export const getCorteAbierto = asyncHandler(async (req, res) => {
  const corte = await obtenerCortePersonalAbierto(req.usuario);
  res.json({ corte });
});

export const getCorteDetalle = asyncHandler(async (req, res) => {
  const corte = await obtenerCortePersonal(req.usuario, req.params.id);
  res.json({ corte });
});

export const postCorte = asyncHandler(async (req, res) => {
  const { corte, motivo } = await iniciarCortePersonal(req.usuario);
  res.status(corte ? 201 : 200).json({ corte, motivo });
});

export const patchCorteItem = asyncHandler(async (req, res) => {
  const data = patchItemSchema.parse(req.body);
  const corte =
    data.incluido !== undefined
      ? await togglearItemPersonal(req.usuario, req.params.id, req.params.itemId, data.incluido)
      : await actualizarItemCortePersonal(req.usuario, req.params.id, req.params.itemId, data.monto);
  res.json({ corte });
});

export const postConfirmarCorte = asyncHandler(async (req, res) => {
  const corte = await confirmarCortePersonal(req.usuario, req.params.id);
  res.json({ corte });
});
