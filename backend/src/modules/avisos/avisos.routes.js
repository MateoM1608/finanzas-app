import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  getAvisos,
  getNotificaciones,
  getResumenNotificaciones,
  patchNotificacion,
  postLeerTodas,
  postDispositivo,
  deleteDispositivo,
  postGenerarTodas,
} from './avisos.controller.js';

export const avisosRouter = Router();
avisosRouter.use(requireAuth);
avisosRouter.get('/', getAvisos);

export const notificacionesRouter = Router();
// El cron no tiene sesión: se autoriza con CRON_SECRET.
notificacionesRouter.post('/generar', postGenerarTodas);
notificacionesRouter.use(requireAuth);
notificacionesRouter.get('/', getNotificaciones);
notificacionesRouter.get('/resumen', getResumenNotificaciones);
notificacionesRouter.post('/leer-todas', postLeerTodas);
notificacionesRouter.post('/dispositivos', postDispositivo);
notificacionesRouter.delete('/dispositivos', deleteDispositivo);
notificacionesRouter.patch('/:id', patchNotificacion);
