import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getCiclos, getCiclo, putExtracto, postRevisar, postAjuste, patchReclamo, deleteAjuste } from './extractosTarjeta.controller.js';

export const extractosTarjetaRouter = Router();

extractosTarjetaRouter.use(requireAuth);
extractosTarjetaRouter.patch('/ajustes/:id', patchReclamo);
extractosTarjetaRouter.delete('/ajustes/:id', deleteAjuste);
extractosTarjetaRouter.get('/:metodoId', getCiclos);
extractosTarjetaRouter.get('/:metodoId/ciclos/:fecha', getCiclo);
extractosTarjetaRouter.put('/:metodoId/ciclos/:fecha', putExtracto);
extractosTarjetaRouter.post('/:metodoId/ciclos/:fecha/revisar', postRevisar);
extractosTarjetaRouter.post('/:metodoId/ciclos/:fecha/ajustes', postAjuste);
