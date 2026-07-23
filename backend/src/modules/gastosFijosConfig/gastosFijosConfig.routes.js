import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  getGastosFijos,
  postGastoFijo,
  patchGastoFijo,
  deleteGastoFijo,
} from './gastosFijosConfig.controller.js';

export const gastosFijosConfigRouter = Router();

gastosFijosConfigRouter.use(requireAuth);
gastosFijosConfigRouter.get('/', getGastosFijos);
gastosFijosConfigRouter.post('/', postGastoFijo);
gastosFijosConfigRouter.patch('/:id', patchGastoFijo);
gastosFijosConfigRouter.delete('/:id', deleteGastoFijo);
