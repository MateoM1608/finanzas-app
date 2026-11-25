import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getExportar } from './exportar.controller.js';

export const exportarRouter = Router();

exportarRouter.use(requireAuth);
exportarRouter.get('/', getExportar);
