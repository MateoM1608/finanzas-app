import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { hashPassword, comparePassword } from '../../utils/password.js';
import { revisarBloqueo, sumarIntento, limpiarIntentos, contarIntento, limpiarIntentosViejos } from '../../utils/limiteIntentos.js';

/**
 * Límites (seguridad, 2026-12-06), guardados en IntentoAcceso:
 * - Contraseña errada: 5 seguidas desde la misma conexión (IP) bloquean ESE
 *   usuario en ESA conexión 15 minutos. Desde otra conexión se puede seguir
 *   entrando, así que nadie puede dejarte la cuenta bloqueada a propósito.
 * - Por conexión: 30 contraseñas erradas en 15 minutos (a cualquier usuario)
 *   bloquean esa conexión 15 minutos.
 * - Registro: 10 cuentas por conexión por hora.
 */
const LOGIN_USUARIO = { max: 5, ventanaMin: 15, bloqueoMin: 15 };
const LOGIN_IP = { max: 30, ventanaMin: 15, bloqueoMin: 15 };
const REGISTRO_IP = { max: 10, ventanaMin: 60, bloqueoMin: 60 };

const claveUsuario = (usuario, ip) => `login:u:${usuario}:${ip}`;
const claveIp = (ip) => `login:ip:${ip}`;

export async function registerUsuario({ nombre, usuario, password }, ip = 'desconocida') {
  await contarIntento(`registro:ip:${ip}`, REGISTRO_IP);
  const existente = await prisma.usuario.findUnique({ where: { usuario } });
  if (existente) {
    throw new HttpError(409, 'Ese nombre de usuario ya está en uso');
  }

  const passwordHash = await hashPassword(password);
  return prisma.usuario.create({
    data: { nombre, usuario, passwordHash },
  });
}

// Hash de relleno: si el usuario no existe se compara igual, para que la
// respuesta tarde lo mismo y no delate qué usuarios existen.
let hashRelleno = null;

/** Comprueba la contraseña de `usuario` con los límites de intentos. Devuelve el usuario o lanza 401/429. */
async function verificarConLimites(usuario, password, ip) {
  await revisarBloqueo(claveIp(ip));
  await revisarBloqueo(claveUsuario(usuario, ip));

  const encontrado = await prisma.usuario.findUnique({ where: { usuario } });
  let valido = false;
  if (encontrado) {
    valido = await comparePassword(password, encontrado.passwordHash);
  } else {
    hashRelleno ??= await hashPassword('contraseña-de-relleno');
    await comparePassword(password, hashRelleno);
  }
  if (!valido) {
    const bloqueado = await sumarIntento(claveUsuario(usuario, ip), LOGIN_USUARIO);
    await sumarIntento(claveIp(ip), LOGIN_IP);
    throw new HttpError(
      bloqueado ? 429 : 401,
      bloqueado
        ? `Demasiados intentos fallidos. Intenta de nuevo en ${LOGIN_USUARIO.bloqueoMin} minutos.`
        : 'Usuario o contraseña incorrectos',
    );
  }
  await limpiarIntentos(claveUsuario(usuario, ip));
  return encontrado;
}

export async function authenticateUsuario({ usuario, password }, ip = 'desconocida') {
  const encontrado = await verificarConLimites(usuario, password, ip);
  limpiarIntentosViejos().catch(() => {});
  return encontrado;
}

/**
 * Cambia la contraseña (pide la actual, con los mismos límites del login) y
 * sube la versión de sesión: todas las demás sesiones abiertas se cierran.
 */
export async function cambiarPassword(usuarioActual, { actual, nueva }, ip = 'desconocida') {
  try {
    await verificarConLimites(usuarioActual.usuario, actual, ip);
  } catch (error) {
    // 401 en la app significa "sesión terminada": aquí es solo la contraseña actual.
    if (error.status === 401) throw new HttpError(400, 'La contraseña actual no es correcta');
    throw error;
  }
  if (actual === nueva) throw new HttpError(400, 'La contraseña nueva debe ser distinta de la actual');
  return prisma.usuario.update({
    where: { id: usuarioActual.id },
    data: { passwordHash: await hashPassword(nueva), sesionVersion: { increment: 1 } },
  });
}

/** Cierra todas las demás sesiones (otros navegadores o teléfonos). */
export function cerrarOtrasSesiones(usuarioActual) {
  return prisma.usuario.update({ where: { id: usuarioActual.id }, data: { sesionVersion: { increment: 1 } } });
}

export function serializeUsuario(usuario) {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    usuario: usuario.usuario,
    hogarId: usuario.hogarId,
    esAdmin: usuario.esAdmin,
    puedeEditarGastos: usuario.puedeEditarGastos,
    puedeInvitar: usuario.puedeInvitar,
  };
}
