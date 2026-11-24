import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getCompras, getSugerirPrimeraCuota, postCompra, patchCompra, deleteCompra } from './comprasCuotasPersonales.controller.js';

export const comprasCuotasPersonalesRouter = Router();

comprasCuotasPersonalesRouter.use(requireAuth);
comprasCuotasPersonalesRouter.get('/', getCompras);
comprasCuotasPersonalesRouter.get('/sugerir-primera-cuota', getSugerirPrimeraCuota);
comprasCuotasPersonalesRouter.post('/', postCompra);
comprasCuotasPersonalesRouter.patch('/:id', patchCompra);
comprasCuotasPersonalesRouter.delete('/:id', deleteCompra);
