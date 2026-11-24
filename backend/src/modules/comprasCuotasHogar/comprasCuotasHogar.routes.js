import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getCompras, postCompra, patchCompra, deleteCompra } from './comprasCuotasHogar.controller.js';

export const comprasCuotasHogarRouter = Router();

comprasCuotasHogarRouter.use(requireAuth);
comprasCuotasHogarRouter.get('/', getCompras);
comprasCuotasHogarRouter.post('/', postCompra);
comprasCuotasHogarRouter.patch('/:id', patchCompra);
comprasCuotasHogarRouter.delete('/:id', deleteCompra);
