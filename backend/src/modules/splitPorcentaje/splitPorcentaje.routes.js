import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getSplit, putSplit } from './splitPorcentaje.controller.js';

export const splitPorcentajeRouter = Router();

splitPorcentajeRouter.use(requireAuth);
splitPorcentajeRouter.get('/', getSplit);
splitPorcentajeRouter.put('/', putSplit);
