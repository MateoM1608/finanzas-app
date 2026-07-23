import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  getIngresosFijos,
  postIngresoFijo,
  patchIngresoFijo,
  deleteIngresoFijo,
} from './ingresosFijosConfig.controller.js';

export const ingresosFijosConfigRouter = Router();

ingresosFijosConfigRouter.use(requireAuth);
ingresosFijosConfigRouter.get('/', getIngresosFijos);
ingresosFijosConfigRouter.post('/', postIngresoFijo);
ingresosFijosConfigRouter.patch('/:id', patchIngresoFijo);
ingresosFijosConfigRouter.delete('/:id', deleteIngresoFijo);
