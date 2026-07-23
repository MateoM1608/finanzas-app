import { prisma } from '../../config/prisma.js';

export function obtenerCicloPersonal(usuarioActual) {
  return { frecuenciaCicloPersonal: usuarioActual.frecuenciaCicloPersonal };
}

export async function actualizarCicloPersonal(usuarioActual, frecuenciaCicloPersonal) {
  await prisma.usuario.update({
    where: { id: usuarioActual.id },
    data: { frecuenciaCicloPersonal },
  });
  return { frecuenciaCicloPersonal };
}
