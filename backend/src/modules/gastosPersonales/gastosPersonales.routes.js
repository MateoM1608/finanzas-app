import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getGastos, postGasto, patchGasto, deleteGasto } from './gastosPersonales.controller.js';

export const gastosPersonalesRouter = Router();

gastosPersonalesRouter.use(requireAuth);
gastosPersonalesRouter.get('/', getGastos);
gastosPersonalesRouter.post('/', postGasto);
gastosPersonalesRouter.patch('/:id', patchGasto);
gastosPersonalesRouter.delete('/:id', deleteGasto);
