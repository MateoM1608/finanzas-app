import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getCiclo, patchCiclo } from './cicloPersonal.controller.js';

export const cicloPersonalRouter = Router();

cicloPersonalRouter.use(requireAuth);
cicloPersonalRouter.get('/', getCiclo);
cicloPersonalRouter.patch('/', patchCiclo);
