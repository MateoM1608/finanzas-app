import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  postPagarCuota,
  postDeshacerPagoCuota,
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
gastosVariablesRouter.post('/:id/pagar', postPagarCuota);
gastosVariablesRouter.post('/:id/deshacer-pago', postDeshacerPagoCuota);
