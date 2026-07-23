import { asyncHandler } from '../../middleware/asyncHandler.js';
import { crearCategoriaSchema, actualizarCategoriaSchema } from './categoriasPersonales.schema.js';
import {
  listarCategorias,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
} from './categoriasPersonales.service.js';

export const getCategorias = asyncHandler(async (req, res) => {
  const categorias = await listarCategorias(req.usuario);
  res.json({ categorias });
});

export const postCategoria = asyncHandler(async (req, res) => {
  const data = crearCategoriaSchema.parse(req.body);
  const categoria = await crearCategoria(req.usuario, data);
  res.status(201).json({ categoria });
});

export const patchCategoria = asyncHandler(async (req, res) => {
  const data = actualizarCategoriaSchema.parse(req.body);
  const categoria = await actualizarCategoria(req.usuario, req.params.id, data);
  res.json({ categoria });
});

export const deleteCategoria = asyncHandler(async (req, res) => {
  await eliminarCategoria(req.usuario, req.params.id);
  res.status(204).send();
});
