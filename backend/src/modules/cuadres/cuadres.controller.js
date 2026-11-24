import { asyncHandler } from '../../middleware/asyncHandler.js';
import { marcarItemSchema } from './cuadres.schema.js';
import {
  listarCuadres,
  obtenerCuadreAbierto,
  obtenerCuadre,
  iniciarCuadre,
  marcarItem,
  descartarCuadre,
  confirmarCuadre,
  obtenerSaldo,
  obtenerResumenHogar,
} from './cuadres.service.js';

export const getCuadres = asyncHandler(async (req, res) => {
  res.json({ cuadres: await listarCuadres(req.usuario) });
});

export const getCuadreAbierto = asyncHandler(async (req, res) => {
  res.json({ cuadre: await obtenerCuadreAbierto(req.usuario) });
});

export const getCuadreDetalle = asyncHandler(async (req, res) => {
  res.json({ cuadre: await obtenerCuadre(req.usuario, req.params.id) });
});

export const postCuadre = asyncHandler(async (req, res) => {
  const { cuadre, motivo } = await iniciarCuadre(req.usuario);
  res.status(cuadre ? 201 : 200).json({ cuadre, motivo });
});

export const patchCuadreItem = asyncHandler(async (req, res) => {
  const { incluido } = marcarItemSchema.parse(req.body);
  res.json({ cuadre: await marcarItem(req.usuario, req.params.id, req.params.itemId, incluido) });
});

export const deleteCuadre = asyncHandler(async (req, res) => {
  await descartarCuadre(req.usuario, req.params.id);
  res.status(204).send();
});

export const postConfirmarCuadre = asyncHandler(async (req, res) => {
  res.json({ cuadre: await confirmarCuadre(req.usuario, req.params.id) });
});

export const getSaldo = asyncHandler(async (req, res) => {
  res.json(await obtenerSaldo(req.usuario));
});

export const getResumenHogar = asyncHandler(async (req, res) => {
  res.json(await obtenerResumenHogar(req.usuario));
});
