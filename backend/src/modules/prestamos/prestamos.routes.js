import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  getPrestamos,
  getPrestamo,
  postPrestamo,
  patchPrestamo,
  deletePrestamo,
  postPagarCuota,
  postDeshacerPago,
  postAbono,
  deleteAbono,
} from './prestamos.controller.js';

export const prestamosRouter = Router();

prestamosRouter.use(requireAuth);
prestamosRouter.get('/', getPrestamos);
prestamosRouter.post('/', postPrestamo);
prestamosRouter.get('/:id', getPrestamo);
prestamosRouter.patch('/:id', patchPrestamo);
prestamosRouter.delete('/:id', deletePrestamo);
prestamosRouter.post('/:id/cuotas/:numero/pagar', postPagarCuota);
prestamosRouter.post('/:id/cuotas/:numero/deshacer-pago', postDeshacerPago);
prestamosRouter.post('/:id/abonos', postAbono);
prestamosRouter.delete('/:id/abonos/:abonoId', deleteAbono);
