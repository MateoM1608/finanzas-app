import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  getGastosVariables,
  postGastoVariable,
  patchGastoVariable,
  deleteGastoVariable,
} from './gastosVariables.controller.js';

export const gastosVariablesRouter = Router();

gastosVariablesRouter.use(requireAuth);
gastosVariablesRouter.get('/', getGastosVariables);
gastosVariablesRouter.post('/', postGastoVariable);
gastosVariablesRouter.patch('/:id', patchGastoVariable);
gastosVariablesRouter.delete('/:id', deleteGastoVariable);
