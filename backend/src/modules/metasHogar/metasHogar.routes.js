import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getMetas, postMeta, patchMeta, deleteMeta, postMovimiento, deleteMovimiento } from './metasHogar.controller.js';

export const metasHogarRouter = Router();

metasHogarRouter.use(requireAuth);
metasHogarRouter.get('/', getMetas);
metasHogarRouter.post('/', postMeta);
metasHogarRouter.patch('/:id', patchMeta);
metasHogarRouter.delete('/:id', deleteMeta);
metasHogarRouter.post('/:id/movimientos', postMovimiento);
metasHogarRouter.delete('/:id/movimientos/:movId', deleteMovimiento);
