import { Router } from 'express';
import { postCompraPersonalAGasto } from '../conversiones/conversiones.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { getCompras, getSugerirPrimeraCuota, postCompra, patchCompra, deleteCompra } from './comprasCuotasPersonales.controller.js';

export const comprasCuotasPersonalesRouter = Router();

comprasCuotasPersonalesRouter.use(requireAuth);
comprasCuotasPersonalesRouter.get('/', getCompras);
comprasCuotasPersonalesRouter.get('/sugerir-primera-cuota', getSugerirPrimeraCuota);
comprasCuotasPersonalesRouter.post('/', postCompra);
comprasCuotasPersonalesRouter.patch('/:id', patchCompra);
comprasCuotasPersonalesRouter.delete('/:id', deleteCompra);
// Editar cambiando el tipo (gasto suelto ↔ compra a cuotas): crea lo nuevo y borra lo viejo.
comprasCuotasPersonalesRouter.post('/:id/convertir-a-gasto', postCompraPersonalAGasto);
