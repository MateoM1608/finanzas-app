import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getInforme } from './informeMetodos.controller.js';

export const informeMetodosRouter = Router();

informeMetodosRouter.use(requireAuth);
informeMetodosRouter.get('/:metodoId', getInforme);
