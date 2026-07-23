import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getResumenPersonal } from './resumenPersonal.controller.js';

export const resumenPersonalRouter = Router();

resumenPersonalRouter.use(requireAuth);
resumenPersonalRouter.get('/', getResumenPersonal);
