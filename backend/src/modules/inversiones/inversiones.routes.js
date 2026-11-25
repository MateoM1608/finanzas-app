import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  getInversiones,
  postInversion,
  patchInversion,
  deleteInversion,
  postMovimiento,
  deleteMovimiento,
  postValoracion,
  deleteValoracion,
} from './inversiones.controller.js';

export const inversionesRouter = Router();

inversionesRouter.use(requireAuth);
inversionesRouter.get('/', getInversiones);
inversionesRouter.post('/', postInversion);
inversionesRouter.patch('/:id', patchInversion);
inversionesRouter.delete('/:id', deleteInversion);
inversionesRouter.post('/:id/movimientos', postMovimiento);
inversionesRouter.delete('/:id/movimientos/:movId', deleteMovimiento);
inversionesRouter.post('/:id/valoraciones', postValoracion);
inversionesRouter.delete('/:id/valoraciones/:valId', deleteValoracion);
