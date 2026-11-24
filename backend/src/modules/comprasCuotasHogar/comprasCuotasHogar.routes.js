import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getCompras, postCompra, deleteCompra } from './comprasCuotasHogar.controller.js';

export const comprasCuotasHogarRouter = Router();

comprasCuotasHogarRouter.use(requireAuth);
comprasCuotasHogarRouter.get('/', getCompras);
comprasCuotasHogarRouter.post('/', postCompra);
comprasCuotasHogarRouter.delete('/:id', deleteCompra);
