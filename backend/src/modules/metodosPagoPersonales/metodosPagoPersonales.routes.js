import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  getMetodosPago,
  postMetodoPago,
  patchMetodoPago,
  deleteMetodoPago,
} from './metodosPagoPersonales.controller.js';

export const metodosPagoPersonalesRouter = Router();

metodosPagoPersonalesRouter.use(requireAuth);
metodosPagoPersonalesRouter.get('/', getMetodosPago);
metodosPagoPersonalesRouter.post('/', postMetodoPago);
metodosPagoPersonalesRouter.patch('/:id', patchMetodoPago);
metodosPagoPersonalesRouter.delete('/:id', deleteMetodoPago);
