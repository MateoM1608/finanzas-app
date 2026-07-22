import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  getConceptos,
  postConcepto,
  patchConcepto,
  deleteConcepto,
  putPuntosCorteConcepto,
} from './conceptosRecurrentesPersonales.controller.js';

export const conceptosRecurrentesPersonalesRouter = Router();

conceptosRecurrentesPersonalesRouter.use(requireAuth);
conceptosRecurrentesPersonalesRouter.get('/', getConceptos);
conceptosRecurrentesPersonalesRouter.post('/', postConcepto);
conceptosRecurrentesPersonalesRouter.patch('/:id', patchConcepto);
conceptosRecurrentesPersonalesRouter.delete('/:id', deleteConcepto);
conceptosRecurrentesPersonalesRouter.put('/:id/puntos-corte', putPuntosCorteConcepto);
