import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getCuentasHogar, postPagarCuota, postDeshacerPago } from './cuentasHogar.controller.js';

export const cuentasHogarRouter = Router();

cuentasHogarRouter.use(requireAuth);
cuentasHogarRouter.get('/', getCuentasHogar);
cuentasHogarRouter.post('/:id/pagar', postPagarCuota);
cuentasHogarRouter.post('/:id/deshacer-pago', postDeshacerPago);
