import { Router } from 'express';
import { postCompraHogarAGasto } from '../conversiones/conversiones.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { getCompras, postCompra, patchCompra, deleteCompra } from './comprasCuotasHogar.controller.js';

export const comprasCuotasHogarRouter = Router();

comprasCuotasHogarRouter.use(requireAuth);
comprasCuotasHogarRouter.get('/', getCompras);
comprasCuotasHogarRouter.post('/', postCompra);
comprasCuotasHogarRouter.patch('/:id', patchCompra);
comprasCuotasHogarRouter.delete('/:id', deleteCompra);
// Editar cambiando el tipo (gasto suelto ↔ compra a cuotas): crea lo nuevo y borra lo viejo.
comprasCuotasHogarRouter.post('/:id/convertir-a-gasto', postCompraHogarAGasto);
