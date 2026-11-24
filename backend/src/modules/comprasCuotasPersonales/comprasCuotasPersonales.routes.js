import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getCompras, getSugerirPrimeraCuota, postCompra, deleteCompra } from './comprasCuotasPersonales.controller.js';

export const comprasCuotasPersonalesRouter = Router();

comprasCuotasPersonalesRouter.use(requireAuth);
comprasCuotasPersonalesRouter.get('/', getCompras);
comprasCuotasPersonalesRouter.get('/sugerir-primera-cuota', getSugerirPrimeraCuota);
comprasCuotasPersonalesRouter.post('/', postCompra);
comprasCuotasPersonalesRouter.delete('/:id', deleteCompra);
