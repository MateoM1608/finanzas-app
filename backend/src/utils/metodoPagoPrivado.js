import { prisma } from '../config/prisma.js';
import { HttpError } from '../middleware/errorHandler.js';

/**
 * El método de pago con que se pagó un gasto del hogar es dato personal de
 * quien pagó: solo él lo puede poner y solo él lo ve.
 */
export async function validarMetodoDelPagador(usuarioActual, pagoUsuarioId, metodoPagoId) {
  if (!metodoPagoId) return null;
  if (pagoUsuarioId !== usuarioActual.id) {
    throw new HttpError(400, 'Solo quien pagó puede indicar con qué método de pago lo hizo');
  }
  const metodo = await prisma.metodoPagoPersonal.findUnique({ where: { id: metodoPagoId } });
  if (!metodo || metodo.usuarioId !== usuarioActual.id) {
    throw new HttpError(400, 'Método de pago no encontrado');
  }
  return metodoPagoId;
}

/** Quita el método de pago de un gasto del hogar si quien consulta no es quien pagó. */
export function ocultarMetodoAjeno(gasto, usuarioActual) {
  if (!gasto || gasto.pagoUsuarioId === usuarioActual.id) return gasto;
  return { ...gasto, metodoPago: null, metodoPagoId: null };
}
