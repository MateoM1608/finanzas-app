import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  postHogar,
  postInvitacion,
  postJoin,
  getHogarActual,
  patchHogar,
  putPuntosCorte,
  getMiembros,
  patchMiembroPermisos,
  postTransferirAdmin,
} from './hogares.controller.js';

export const hogaresRouter = Router();

hogaresRouter.use(requireAuth);
hogaresRouter.post('/', postHogar);
hogaresRouter.get('/actual', getHogarActual);
hogaresRouter.patch('/', patchHogar);
hogaresRouter.post('/join', postJoin);
hogaresRouter.post('/invitaciones', postInvitacion);
hogaresRouter.put('/puntos-corte', putPuntosCorte);
hogaresRouter.get('/miembros', getMiembros);
hogaresRouter.patch('/miembros/:id/permisos', patchMiembroPermisos);
hogaresRouter.post('/transferir-admin', postTransferirAdmin);
