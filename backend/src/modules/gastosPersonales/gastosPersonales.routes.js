import { Router } from 'express';
import { postGastoPersonalACompra } from '../conversiones/conversiones.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { getGastos, postGasto, patchGasto, patchMetodoGasto, deleteGasto } from './gastosPersonales.controller.js';

export const gastosPersonalesRouter = Router();

gastosPersonalesRouter.use(requireAuth);
gastosPersonalesRouter.get('/', getGastos);
gastosPersonalesRouter.post('/', postGasto);
gastosPersonalesRouter.patch('/:id', patchGasto);
gastosPersonalesRouter.patch('/:id/metodo', patchMetodoGasto);
gastosPersonalesRouter.delete('/:id', deleteGasto);
// Editar cambiando el tipo (gasto suelto ↔ compra a cuotas): crea lo nuevo y borra lo viejo.
gastosPersonalesRouter.post('/:id/convertir-a-compra', postGastoPersonalACompra);
