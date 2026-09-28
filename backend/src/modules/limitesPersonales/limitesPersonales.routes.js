import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getLimites, getResumenLimites, postLimite, patchLimite, deleteLimite } from './limitesPersonales.controller.js';

export const limitesPersonalesRouter = Router();

limitesPersonalesRouter.use(requireAuth);
limitesPersonalesRouter.get('/', getLimites);
limitesPersonalesRouter.get('/resumen', getResumenLimites);
limitesPersonalesRouter.post('/', postLimite);
limitesPersonalesRouter.patch('/:id', patchLimite);
limitesPersonalesRouter.delete('/:id', deleteLimite);
