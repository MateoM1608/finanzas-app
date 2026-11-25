import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as c from './categoriasHogar.controller.js';

export const categoriasHogarRouter = Router();
categoriasHogarRouter.use(requireAuth);
categoriasHogarRouter.get('/', c.getCategorias);
categoriasHogarRouter.get('/gasto', c.getGastoPorCategoria);
categoriasHogarRouter.post('/', c.postCategoria);
categoriasHogarRouter.post('/basicas', c.postCategoriasBasicas);
categoriasHogarRouter.patch('/:id', c.patchCategoria);
categoriasHogarRouter.delete('/:id', c.deleteCategoria);

export const topesHogarRouter = Router();
topesHogarRouter.use(requireAuth);
topesHogarRouter.get('/', c.getTopes);
topesHogarRouter.get('/resumen', c.getResumenTopes);
topesHogarRouter.post('/', c.postTope);
topesHogarRouter.patch('/:id', c.patchTope);
topesHogarRouter.delete('/:id', c.deleteTope);
