import { prisma } from '../config/prisma.js';
import { enviarPush } from './canalPush.js';

/**
 * Punto único para notificar a un usuario: guarda la notificación en su
 * bandeja (una sola vez por `clave`) y la ofrece al canal push. Cualquier
 * módulo que quiera avisar algo (vencimientos hoy; actividad del hogar
 * después) usa esta función.
 */
export async function notificar(usuarioId, { tipo, titulo, mensaje, enlace = null, clave }) {
  try {
    const creada = await prisma.notificacion.create({ data: { usuarioId, tipo, titulo, mensaje, enlace, clave } });
    const enviada = await enviarPush(creada).catch(() => false);
    if (enviada) await prisma.notificacion.update({ where: { id: creada.id }, data: { enviadaPushEn: new Date() } });
    return creada;
  } catch (error) {
    // Ya existía (misma clave): no se repite.
    if (error?.code === 'P2002') return null;
    throw error;
  }
}

export const TIPOS_VENCIMIENTO = ['vence_pronto', 'vence_hoy', 'atrasado'];
