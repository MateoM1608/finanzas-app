import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  getConceptos,
  postConcepto,
  patchConcepto,
  deleteConcepto,
} from './conceptosRecurrentes.controller.js';

export const conceptosRecurrentesRouter = Router();

conceptosRecurrentesRouter.use(requireAuth);
conceptosRecurrentesRouter.get('/', getConceptos);
conceptosRecurrentesRouter.post('/', postConcepto);
conceptosRecurrentesRouter.patch('/:id', patchConcepto);
conceptosRecurrentesRouter.delete('/:id', deleteConcepto);
