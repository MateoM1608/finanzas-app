import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  getCategorias,
  postCategoria,
  patchCategoria,
  deleteCategoria,
} from './categoriasPersonales.controller.js';

export const categoriasPersonalesRouter = Router();

categoriasPersonalesRouter.use(requireAuth);
categoriasPersonalesRouter.get('/', getCategorias);
categoriasPersonalesRouter.post('/', postCategoria);
categoriasPersonalesRouter.patch('/:id', patchCategoria);
categoriasPersonalesRouter.delete('/:id', deleteCategoria);
