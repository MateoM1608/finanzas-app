import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { crearGastoVariable, eliminarGastoVariable } from '../gastosVariables/gastosVariables.service.js';
import { crearCompra as crearCompraHogar, eliminarCompra as eliminarCompraHogar } from '../comprasCuotasHogar/comprasCuotasHogar.service.js';
import { crearGastoPersonal, eliminarGastoPersonal, requireGastoEliminable } from '../gastosPersonales/gastosPersonales.service.js';
import {
  crearCompra as crearCompraPersonal,
  eliminarCompra as eliminarCompraPersonal,
} from '../comprasCuotasPersonales/comprasCuotasPersonales.service.js';

/**
 * Editar un gasto cambiando su tipo: un gasto suelto que pasa a compra a
 * cuotas o una compra que vuelve a ser un gasto de un solo pago. Se crea lo
 * nuevo y se borra lo viejo. Antes de crear se revisa que lo viejo se pueda
 * borrar (así no quedan los dos ni avisos de más); si aun así el borrado
 * falla, se deshace lo creado.
 */

async function crearYReemplazar(crear, borrar, deshacer) {
  const nuevo = await crear();
  try {
    await borrar();
  } catch (e) {
    await deshacer(nuevo).catch(() => {});
    throw e;
  }
  return nuevo;
}

// --- Hogar ---

export async function gastoHogarACompra(usuarioActual, gastoId, data) {
  const gasto = await prisma.gastoVariablePareja.findUnique({ where: { id: gastoId } });
  if (!gasto || gasto.hogarId !== usuarioActual.hogarId) throw new HttpError(404, 'Gasto no encontrado');
  if (gasto.compraId || gasto.prestamoId || gasto.abonoPrestamoId) throw new HttpError(409, 'Este gasto no es un gasto suelto');
  if (gasto.estado !== 'pagado') {
    throw new HttpError(409, 'Este gasto ya está en un cuadre: solo se puede cambiar el nombre o la categoría');
  }
  return crearYReemplazar(
    () => crearCompraHogar(usuarioActual, data),
    () => eliminarGastoVariable(usuarioActual, gastoId),
    (compra) => eliminarCompraHogar(usuarioActual, compra.id),
  );
}

export async function compraHogarAGasto(usuarioActual, compraId, data) {
  const compra = await prisma.compraCuotasHogar.findUnique({ where: { id: compraId } });
  if (!compra || compra.hogarId !== usuarioActual.hogarId) throw new HttpError(404, 'Compra no encontrada');
  const bloqueadas = await prisma.gastoVariablePareja.count({
    where: {
      compraId,
      OR: [{ estado: 'cuadrado' }, ...(compra.modoCobro === 'manual' ? [{ estado: { in: ['pagado', 'en_cuadre'] } }] : [])],
    },
  });
  if (bloqueadas) {
    throw new HttpError(409, 'Esta compra ya tiene cuotas cuadradas o pagadas a mano: solo se puede cambiar el nombre o la categoría');
  }
  return crearYReemplazar(
    () => crearGastoVariable(usuarioActual, data),
    () => eliminarCompraHogar(usuarioActual, compraId),
    (gasto) => eliminarGastoVariable(usuarioActual, gasto.id),
  );
}

// --- Personal ---

export async function gastoPersonalACompra(usuarioActual, gastoId, data) {
  await requireGastoEliminable(usuarioActual.id, gastoId);
  return crearYReemplazar(
    () => crearCompraPersonal(usuarioActual, data),
    () => eliminarGastoPersonal(usuarioActual.id, gastoId),
    (compra) => eliminarCompraPersonal(usuarioActual, compra.id),
  );
}

export async function compraPersonalAGasto(usuarioActual, compraId, data) {
  const compra = await prisma.compraCuotasPersonal.findUnique({ where: { id: compraId } });
  if (!compra || compra.usuarioId !== usuarioActual.id) throw new HttpError(404, 'Compra no encontrada');
  if (compra.modoCobro === 'manual' && (await prisma.gastoPersonal.count({ where: { compraId, estado: 'pagado' } }))) {
    throw new HttpError(409, 'Ya marcaste cuotas de esta compra como pagadas: solo se puede cambiar la descripción, la categoría o la cuenta');
  }
  return crearYReemplazar(
    () => crearGastoPersonal(usuarioActual.id, data),
    () => eliminarCompraPersonal(usuarioActual, compraId),
    (gasto) => eliminarGastoPersonal(usuarioActual.id, gasto.id),
  );
}
