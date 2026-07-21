import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  getCortes,
  getCorteAbierto,
  getCorteDetalle,
  postCorte,
  patchCorteItem,
  postConfirmarCorte,
} from './cortes.controller.js';

export const cortesRouter = Router();

cortesRouter.use(requireAuth);
cortesRouter.get('/', getCortes);
cortesRouter.get('/actual', getCorteAbierto);
cortesRouter.post('/', postCorte);
cortesRouter.get('/:id', getCorteDetalle);
cortesRouter.patch('/:id/items/:itemId', patchCorteItem);
cortesRouter.post('/:id/confirmar', postConfirmarCorte);
