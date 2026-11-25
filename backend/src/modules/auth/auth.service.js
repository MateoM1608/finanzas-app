import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { hashPassword, comparePassword } from '../../utils/password.js';

export async function registerUsuario({ nombre, usuario, password }) {
  const existente = await prisma.usuario.findUnique({ where: { usuario } });
  if (existente) {
    throw new HttpError(409, 'Ese nombre de usuario ya está en uso');
  }

  const passwordHash = await hashPassword(password);
  return prisma.usuario.create({
    data: { nombre, usuario, passwordHash },
  });
}

// Tras 5 contraseñas erradas seguidas, la cuenta queda bloqueada 15 minutos.
const MAX_INTENTOS = 5;
const MINUTOS_BLOQUEO = 15;
// Hash de relleno: si el usuario no existe se compara igual, para que la
// respuesta tarde lo mismo y no delate qué usuarios existen.
let hashRelleno = null;

export async function authenticateUsuario({ usuario, password }) {
  const encontrado = await prisma.usuario.findUnique({ where: { usuario } });
  if (!encontrado) {
    hashRelleno ??= await hashPassword('contraseña-de-relleno');
    await comparePassword(password, hashRelleno);
    throw new HttpError(401, 'Usuario o contraseña incorrectos');
  }

  const ahora = new Date();
  if (encontrado.bloqueadoHasta && encontrado.bloqueadoHasta > ahora) {
    const minutos = Math.ceil((encontrado.bloqueadoHasta - ahora) / 60000);
    throw new HttpError(429, `Demasiados intentos fallidos. Intenta de nuevo en ${minutos} minuto${minutos === 1 ? '' : 's'}.`);
  }

  const valido = await comparePassword(password, encontrado.passwordHash);
  if (!valido) {
    const intentos = encontrado.intentosFallidos + 1;
    const bloquear = intentos >= MAX_INTENTOS;
    await prisma.usuario.update({
      where: { id: encontrado.id },
      data: bloquear
        ? { intentosFallidos: 0, bloqueadoHasta: new Date(ahora.getTime() + MINUTOS_BLOQUEO * 60000) }
        : { intentosFallidos: intentos },
    });
    throw new HttpError(
      bloquear ? 429 : 401,
      bloquear
        ? `Demasiados intentos fallidos. Intenta de nuevo en ${MINUTOS_BLOQUEO} minutos.`
        : 'Usuario o contraseña incorrectos',
    );
  }

  if (encontrado.intentosFallidos || encontrado.bloqueadoHasta) {
    await prisma.usuario.update({ where: { id: encontrado.id }, data: { intentosFallidos: 0, bloqueadoHasta: null } });
  }
  return encontrado;
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
