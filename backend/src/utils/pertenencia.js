import { prisma } from '../config/prisma.js';
import { HttpError } from '../middleware/errorHandler.js';

/**
 * Verifica que la cuenta (metodoPagoId / metodoPagoIdDefault) y la categoría
 * (categoriaId) que vienen en `data` sean del usuario. Sin esto, con el id de
 * una cuenta ajena se podía crear un movimiento que la mostrara completa y
 * bloquearle a su dueño el borrarla. Solo revisa los campos presentes.
 */
export async function validarReferenciasPropias(usuarioId, data) {
  const metodos = [data.metodoPagoId, data.metodoPagoIdDefault].filter(Boolean);
  for (const id of metodos) {
    const metodo = await prisma.metodoPagoPersonal.findUnique({ where: { id }, select: { usuarioId: true } });
    if (!metodo || metodo.usuarioId !== usuarioId) throw new HttpError(400, 'Método de pago no encontrado');
  }
  if (data.categoriaId) {
    const categoria = await prisma.categoriaPersonal.findUnique({ where: { id: data.categoriaId }, select: { usuarioId: true } });
    if (!categoria || categoria.usuarioId !== usuarioId) throw new HttpError(400, 'Categoría no encontrada');
  }
}

/** Una cuenta solo puede quedar en un movimiento de su dueño; si no, se descarta. */
export async function metodoSiEsDe(client, usuarioId, metodoPagoId) {
  if (!metodoPagoId) return null;
  const metodo = await client.metodoPagoPersonal.findUnique({ where: { id: metodoPagoId }, select: { usuarioId: true } });
  return metodo?.usuarioId === usuarioId ? metodoPagoId : null;
}
