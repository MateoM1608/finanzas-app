import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getProyeccion } from './proyeccionPersonal.controller.js';

export const proyeccionPersonalRouter = Router();

proyeccionPersonalRouter.use(requireAuth);
proyeccionPersonalRouter.get('/', getProyeccion);
