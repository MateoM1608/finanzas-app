import { asyncHandler } from '../../middleware/asyncHandler.js';
import {
  crearCategoriaSchema,
  actualizarCategoriaSchema,
  crearTopeSchema,
  actualizarTopeSchema,
} from './categoriasHogar.schema.js';
import * as servicio from './categoriasHogar.service.js';

export const getCategorias = asyncHandler(async (req, res) => {
  res.json({ categorias: await servicio.listarCategorias(req.usuario) });
});
export const postCategoria = asyncHandler(async (req, res) => {
  const categoria = await servicio.crearCategoria(req.usuario, crearCategoriaSchema.parse(req.body));
  res.status(201).json({ categoria });
});
export const postCategoriasBasicas = asyncHandler(async (req, res) => {
  res.status(201).json({ categorias: await servicio.crearCategoriasBasicas(req.usuario) });
});
export const patchCategoria = asyncHandler(async (req, res) => {
  const categoria = await servicio.actualizarCategoria(req.usuario, req.params.id, actualizarCategoriaSchema.parse(req.body));
  res.json({ categoria });
});
export const deleteCategoria = asyncHandler(async (req, res) => {
  await servicio.eliminarCategoria(req.usuario, req.params.id);
  res.status(204).send();
});
export const getGastoPorCategoria = asyncHandler(async (req, res) => {
  const mes = typeof req.query.mes === 'string' && /^\d{4}-\d{2}$/.test(req.query.mes) ? req.query.mes : undefined;
  res.json(await servicio.obtenerGastoPorCategoria(req.usuario, mes));
});

export const getTopes = asyncHandler(async (req, res) => {
  res.json({ topes: await servicio.listarTopes(req.usuario) });
});
export const getResumenTopes = asyncHandler(async (req, res) => {
  res.json(await servicio.obtenerResumenTopes(req.usuario));
});
export const postTope = asyncHandler(async (req, res) => {
  const tope = await servicio.crearTope(req.usuario, crearTopeSchema.parse(req.body));
  res.status(201).json({ tope });
});
export const patchTope = asyncHandler(async (req, res) => {
  const tope = await servicio.actualizarTope(req.usuario, req.params.id, actualizarTopeSchema.parse(req.body));
  res.json({ tope });
});
export const deleteTope = asyncHandler(async (req, res) => {
  await servicio.eliminarTope(req.usuario, req.params.id);
  res.status(204).send();
});
