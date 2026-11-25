import { getActividad } from './actividad.controller.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { salirDelHogar, quitarMiembro } from './salirHogar.service.js';
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  postHogar,
  postInvitacion,
  postJoin,
  getHogarActual,
  patchHogar,
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
hogaresRouter.get('/miembros', getMiembros);
hogaresRouter.get('/actividad', getActividad);
hogaresRouter.patch('/miembros/:id/permisos', patchMiembroPermisos);
hogaresRouter.post('/transferir-admin', postTransferirAdmin);
hogaresRouter.post(
  '/salir',
  asyncHandler(async (req, res) => {
    await salirDelHogar(req.usuario);
    res.status(204).send();
  }),
);
hogaresRouter.delete(
  '/miembros/:id',
  asyncHandler(async (req, res) => {
    await quitarMiembro(req.usuario, req.params.id);
    res.status(204).send();
  }),
);
