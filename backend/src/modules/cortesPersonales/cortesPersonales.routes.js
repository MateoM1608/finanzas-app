import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  getCortes,
  getCorteAbierto,
  getCorteDetalle,
  postCorte,
  patchCorteItem,
  postConfirmarCorte,
} from './cortesPersonales.controller.js';

export const cortesPersonalesRouter = Router();

cortesPersonalesRouter.use(requireAuth);
cortesPersonalesRouter.get('/', getCortes);
cortesPersonalesRouter.get('/actual', getCorteAbierto);
cortesPersonalesRouter.post('/', postCorte);
cortesPersonalesRouter.get('/:id', getCorteDetalle);
cortesPersonalesRouter.patch('/:id/items/:itemId', patchCorteItem);
cortesPersonalesRouter.post('/:id/confirmar', postConfirmarCorte);
