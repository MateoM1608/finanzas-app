import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getConfiguracion, patchConfiguracion, putPuntosCorte } from './configuracionPersonal.controller.js';

export const configuracionPersonalRouter = Router();

configuracionPersonalRouter.use(requireAuth);
configuracionPersonalRouter.get('/', getConfiguracion);
configuracionPersonalRouter.patch('/', patchConfiguracion);
configuracionPersonalRouter.put('/puntos-corte', putPuntosCorte);
