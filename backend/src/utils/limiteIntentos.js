import { prisma } from '../config/prisma.js';
import { HttpError } from '../middleware/errorHandler.js';

/**
 * Límite de intentos guardado en la base (IntentoAcceso), porque en Vercel
 * cada petición puede caer en una instancia distinta y un contador en memoria
 * no serviría. Cada clave cuenta intentos dentro de una ventana; al llegar al
 * máximo queda bloqueada `bloqueoMin` minutos.
 *
 *   await revisarBloqueo(clave)                  → 429 si está bloqueada
 *   await sumarIntento(clave, { max, ventanaMin, bloqueoMin })
 *   await limpiarIntentos(clave)                 → al acertar
 */

/** IP del cliente. Vercel pone la real en x-real-ip / x-forwarded-for (y reemplaza lo que mande el cliente). */
export function ipDe(req) {
  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real) return real.trim();
  const reenviada = req.headers['x-forwarded-for'];
  if (typeof reenviada === 'string' && reenviada) return reenviada.split(',')[0].trim();
  return req.ip ?? 'desconocida';
}

function mensaje(hasta, ahora) {
  const minutos = Math.max(1, Math.ceil((hasta - ahora) / 60000));
  return `Demasiados intentos. Intenta de nuevo en ${minutos} minuto${minutos === 1 ? '' : 's'}.`;
}

export async function revisarBloqueo(clave) {
  const fila = await prisma.intentoAcceso.findUnique({ where: { clave } });
  const ahora = new Date();
  if (fila?.bloqueadoHasta && fila.bloqueadoHasta > ahora) {
    throw new HttpError(429, mensaje(fila.bloqueadoHasta, ahora));
  }
}

/** Suma un intento; devuelve true si con este quedó bloqueada. */
export async function sumarIntento(clave, { max, ventanaMin, bloqueoMin }) {
  const ahora = new Date();
  const fila = await prisma.intentoAcceso.findUnique({ where: { clave } });
  const ventanaVencida = !fila || ahora - fila.ventanaInicio > ventanaMin * 60000;
  const conteo = ventanaVencida ? 1 : fila.conteo + 1;
  const bloquear = conteo >= max;
  const data = {
    conteo: bloquear ? 0 : conteo,
    ventanaInicio: ventanaVencida || bloquear ? ahora : fila.ventanaInicio,
    bloqueadoHasta: bloquear ? new Date(ahora.getTime() + bloqueoMin * 60000) : (fila?.bloqueadoHasta ?? null),
  };
  await prisma.intentoAcceso.upsert({ where: { clave }, create: { clave, ...data }, update: data });
  return bloquear;
}

export async function limpiarIntentos(clave) {
  await prisma.intentoAcceso.deleteMany({ where: { clave } });
}

/** Revisa y suma de una vez (para lo que se limita por cantidad, no por fallos). */
export async function contarIntento(clave, opciones) {
  await revisarBloqueo(clave);
  await sumarIntento(clave, opciones);
}

/** Borra contadores viejos (sin bloqueo vigente y con la ventana ya vencida hace un día). */
export async function limpiarIntentosViejos() {
  const haceUnDia = new Date(Date.now() - 24 * 60 * 60000);
  await prisma.intentoAcceso.deleteMany({
    where: { ventanaInicio: { lt: haceUnDia }, OR: [{ bloqueadoHasta: null }, { bloqueadoHasta: { lt: new Date() } }] },
  });
}
