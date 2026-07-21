import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getPeriodoActual, patchInstancia } from './gastosRecurrentes.controller.js';

export const gastosRecurrentesRouter = Router();

gastosRecurrentesRouter.use(requireAuth);
gastosRecurrentesRouter.get('/periodo-actual', getPeriodoActual);
gastosRecurrentesRouter.patch('/instancias/:id', patchInstancia);
