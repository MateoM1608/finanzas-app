import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getGastos, postGasto, deleteGasto } from './gastosPersonales.controller.js';

export const gastosPersonalesRouter = Router();

gastosPersonalesRouter.use(requireAuth);
gastosPersonalesRouter.get('/', getGastos);
gastosPersonalesRouter.post('/', postGasto);
gastosPersonalesRouter.delete('/:id', deleteGasto);
