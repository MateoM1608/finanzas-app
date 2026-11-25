import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { hashPassword, comparePassword } from '../../utils/password.js';
import { revisarBloqueo, sumarIntento, limpiarIntentos } from '../../utils/limiteIntentos.js';
import { notificar } from '../../utils/notificaciones.js';

/**
 * Códigos de recuperación (2026-12-06): cambiar la contraseña sin haber
 * iniciado sesión, sin correo ni servicios externos.
 *
 * - Cada usuario genera 8 códigos de un solo uso (XXXX-XXXX, 40 bits) desde
 *   "Tu cuenta", confirmando su contraseña. Se muestran una sola vez; se
 *   guardan con bcrypt. Generar unos nuevos borra los anteriores.
 * - Con usuario + un código + contraseña nueva se cambia la contraseña: el
 *   código se gasta, todas las sesiones se cierran (sube sesionVersion), se
 *   inicia sesión en ese navegador y queda una notificación.
 * - Límites por conexión: 5 códigos errados para un usuario bloquean esa
 *   conexión 15 min; 10 errados en una hora (a cualquier usuario), una hora.
 */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CANTIDAD = 8;
const COSTO = 10; // bcrypt: más rápido que el de la contraseña porque se comparan hasta 8
const REC_USUARIO = { max: 5, ventanaMin: 15, bloqueoMin: 15 };
const REC_IP = { max: 10, ventanaMin: 60, bloqueoMin: 60 };

function generarCodigo() {
  // 256 es múltiplo de 32: sin sesgo de módulo.
  const bytes = crypto.randomBytes(8);
  const letras = [...bytes].map((b) => ALFABETO[b % ALFABETO.length]).join('');
  return `${letras.slice(0, 4)}-${letras.slice(4)}`;
}

/** Mayúsculas, sin espacios ni guiones (el alfabeto no tiene 0/O ni 1/I, que se confunden). */
export function normalizarCodigo(texto) {
  return String(texto ?? '')
    .toUpperCase()
    .replace(/[\s-]/g, '');
}

export async function estadoCodigos(usuarioActual) {
  const codigos = await prisma.codigoRecuperacion.findMany({
    where: { usuarioId: usuarioActual.id },
    select: { usadoEn: true, creadoEn: true },
  });
  return {
    total: codigos.length,
    disponibles: codigos.filter((c) => !c.usadoEn).length,
    creadosEn: codigos[0]?.creadoEn ?? null,
  };
}

/** Genera 8 códigos nuevos (borra los anteriores). Pide la contraseña actual. */
export async function generarCodigos(usuarioActual, { password }, ip = 'desconocida') {
  // Mismo límite que el login: una sesión robada no sirve para adivinar la contraseña.
  const clave = `login:u:${usuarioActual.usuario}:${ip}`;
  await revisarBloqueo(clave);
  const valido = await comparePassword(password, usuarioActual.passwordHash);
  if (!valido) {
    const bloqueado = await sumarIntento(clave, { max: 5, ventanaMin: 15, bloqueoMin: 15 });
    throw new HttpError(bloqueado ? 429 : 400, bloqueado ? 'Demasiados intentos. Intenta de nuevo en 15 minutos.' : 'La contraseña no es correcta');
  }
  await limpiarIntentos(clave);
  const codigos = Array.from({ length: CANTIDAD }, generarCodigo);
  const hashes = await Promise.all(codigos.map((c) => bcrypt.hash(normalizarCodigo(c), COSTO)));
  await prisma.$transaction([
    prisma.codigoRecuperacion.deleteMany({ where: { usuarioId: usuarioActual.id } }),
    prisma.codigoRecuperacion.createMany({ data: hashes.map((codigoHash) => ({ usuarioId: usuarioActual.id, codigoHash })) }),
  ]);
  return codigos;
}

// Hash de relleno: si el usuario no existe o no tiene códigos, se compara
// igual para que la respuesta tarde parecido y no delate nada.
let hashRelleno = null;

/** Cambia la contraseña con un código. Devuelve el usuario actualizado (para iniciar sesión). */
export async function recuperarConCodigo({ usuario, codigo, nueva }, ip = 'desconocida') {
  const claveUsuario = `recuperar:u:${usuario}:${ip}`;
  const claveIp = `recuperar:ip:${ip}`;
  await revisarBloqueo(claveIp);
  await revisarBloqueo(claveUsuario);

  const normal = normalizarCodigo(codigo);
  const encontrado = await prisma.usuario.findUnique({ where: { usuario } });
  const codigos = encontrado
    ? await prisma.codigoRecuperacion.findMany({ where: { usuarioId: encontrado.id, usadoEn: null } })
    : [];
  let acierto = null;
  for (const c of codigos) {
    if (await bcrypt.compare(normal, c.codigoHash)) {
      acierto = c;
      break;
    }
  }
  if (!codigos.length) {
    hashRelleno ??= await bcrypt.hash('relleno-recuperacion', COSTO);
    await bcrypt.compare(normal, hashRelleno);
  }
  if (!acierto) {
    const bloqueado = await sumarIntento(claveUsuario, REC_USUARIO);
    await sumarIntento(claveIp, REC_IP);
    throw new HttpError(
      bloqueado ? 429 : 400,
      bloqueado
        ? `Demasiados intentos. Intenta de nuevo en ${REC_USUARIO.bloqueoMin} minutos.`
        : 'El usuario o el código de recuperación no son correctos (cada código sirve una sola vez)',
    );
  }

  // Gastar el código de forma condicional: si dos peticiones usan el mismo a la vez, solo una gana.
  const gastado = await prisma.codigoRecuperacion.updateMany({
    where: { id: acierto.id, usadoEn: null },
    data: { usadoEn: new Date() },
  });
  if (gastado.count !== 1) throw new HttpError(400, 'Ese código ya se usó');

  const actualizado = await prisma.usuario.update({
    where: { id: encontrado.id },
    data: { passwordHash: await hashPassword(nueva), sesionVersion: { increment: 1 } },
  });
  await limpiarIntentos(claveUsuario);
  // También se levanta el bloqueo por contraseñas erradas de esta conexión.
  await limpiarIntentos(`login:u:${usuario}:${ip}`);

  const quedan = codigos.length - 1;
  await notificar(encontrado.id, {
    tipo: 'seguridad',
    titulo: 'Cambiaste tu contraseña con un código de recuperación',
    mensaje:
      quedan > 0
        ? `Se cerraron tus demás sesiones. Te quedan ${quedan} ${quedan === 1 ? 'código' : 'códigos'}. Si no fuiste tú, cambia la contraseña y genera códigos nuevos.`
        : 'Se cerraron tus demás sesiones. Ya no te quedan códigos: genera unos nuevos en Tu cuenta.',
    enlace: '/settings?tab=cuenta',
    clave: `recuperacion:${acierto.id}`,
  }).catch(() => null);
  return actualizado;
}
