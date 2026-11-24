import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  getCuadres,
  getCuadreAbierto,
  getCuadreDetalle,
  postCuadre,
  patchCuadreItem,
  deleteCuadre,
  postConfirmarCuadre,
  getSaldo,
  getResumenHogar,
} from './cuadres.controller.js';

export const cuadresRouter = Router();

cuadresRouter.use(requireAuth);
cuadresRouter.get('/', getCuadres);
cuadresRouter.get('/actual', getCuadreAbierto);
cuadresRouter.get('/saldo', getSaldo);
cuadresRouter.get('/resumen', getResumenHogar);
cuadresRouter.post('/', postCuadre);
cuadresRouter.get('/:id', getCuadreDetalle);
cuadresRouter.patch('/:id/items/:itemId', patchCuadreItem);
cuadresRouter.delete('/:id', deleteCuadre);
cuadresRouter.post('/:id/confirmar', postConfirmarCuadre);
