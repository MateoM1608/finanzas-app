import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getIngresos, postIngreso, patchIngreso, patchMetodoIngreso, deleteIngreso } from './ingresosPersonales.controller.js';

export const ingresosPersonalesRouter = Router();

ingresosPersonalesRouter.use(requireAuth);
ingresosPersonalesRouter.get('/', getIngresos);
ingresosPersonalesRouter.post('/', postIngreso);
ingresosPersonalesRouter.patch('/:id', patchIngreso);
ingresosPersonalesRouter.patch('/:id/metodo', patchMetodoIngreso);
ingresosPersonalesRouter.delete('/:id', deleteIngreso);
