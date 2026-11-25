import { prisma } from '../config/prisma.js';

/**
 * Canal push (notificaciones al teléfono). Hoy no envía nada: queda listo para
 * cuando exista la APK (Capacitor) con Firebase Cloud Messaging.
 *
 * Para activarlo:
 * 1. En Firebase, crear el proyecto y una cuenta de servicio; cargar su JSON
 *    en Vercel como FIREBASE_SERVICE_ACCOUNT (la carga el usuario, nunca por chat).
 * 2. `npm install firebase-admin` y, en `enviarPush`, inicializar la app con
 *    esa credencial y llamar a `getMessaging().sendEachForMulticast({ tokens,
 *    notification: { title, body }, data: { enlace } })`.
 * 3. Borrar de DispositivoNotificacion los tokens que FCM responda como
 *    inválidos (`messaging/registration-token-not-registered`).
 * La APK registra su token con POST /api/notificaciones/dispositivos.
 */

export function pushConfigurado() {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT);
}

/** Envía una notificación a los teléfonos del usuario. Devuelve si se envió. */
export async function enviarPush(notificacion) {
  if (!pushConfigurado()) return false;
  const dispositivos = await prisma.dispositivoNotificacion.findMany({
    where: { usuarioId: notificacion.usuarioId },
    select: { token: true },
  });
  if (!dispositivos.length) return false;
  // Pendiente de la APK: enviar con firebase-admin (ver arriba) y, si salió,
  // marcar `enviadaPushEn`.
  return false;
}
