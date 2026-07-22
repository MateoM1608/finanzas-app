import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { hashPassword, comparePassword } from '../../utils/password.js';
import { puntosCorteDefault } from '../../utils/puntosCorteDefault.js';

const FRECUENCIA_CORTE_PERSONAL_DEFAULT = 'mensual';

export async function registerUsuario({ nombre, usuario, password }) {
  const existente = await prisma.usuario.findUnique({ where: { usuario } });
  if (existente) {
    throw new HttpError(409, 'Ese nombre de usuario ya está en uso');
  }

  const passwordHash = await hashPassword(password);
  return prisma.usuario.create({
    data: {
      nombre,
      usuario,
      passwordHash,
      frecuenciaCortePersonal: FRECUENCIA_CORTE_PERSONAL_DEFAULT,
      puntosCortePersonales: {
        create: puntosCorteDefault(FRECUENCIA_CORTE_PERSONAL_DEFAULT),
      },
    },
  });
}

export async function authenticateUsuario({ usuario, password }) {
  const encontrado = await prisma.usuario.findUnique({ where: { usuario } });
  if (!encontrado) {
    throw new HttpError(401, 'Usuario o contraseña incorrectos');
  }

  const valido = await comparePassword(password, encontrado.passwordHash);
  if (!valido) {
    throw new HttpError(401, 'Usuario o contraseña incorrectos');
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
