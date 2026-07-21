import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { postHogar, postInvitacion, postJoin } from './hogares.controller.js';

export const hogaresRouter = Router();

hogaresRouter.use(requireAuth);
hogaresRouter.post('/', postHogar);
hogaresRouter.post('/join', postJoin);
hogaresRouter.post('/invitaciones', postInvitacion);
