import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  getAhorros,
  getResumenAhorros,
  postAhorro,
  patchAhorro,
  deleteAhorro,
  postTransaccion,
  deleteTransaccion,
} from './ahorrosPersonales.controller.js';

export const ahorrosPersonalesRouter = Router();

ahorrosPersonalesRouter.use(requireAuth);
ahorrosPersonalesRouter.get('/', getAhorros);
ahorrosPersonalesRouter.get('/resumen', getResumenAhorros);
ahorrosPersonalesRouter.post('/', postAhorro);
ahorrosPersonalesRouter.patch('/:id', patchAhorro);
ahorrosPersonalesRouter.delete('/:id', deleteAhorro);
ahorrosPersonalesRouter.post('/:id/transacciones', postTransaccion);
ahorrosPersonalesRouter.delete('/:id/transacciones/:transaccionId', deleteTransaccion);
