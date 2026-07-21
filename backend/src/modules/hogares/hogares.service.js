import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { generateInvitationCode } from '../../utils/invitationCode.js';

const INVITACION_VIGENCIA_DIAS = 7;

// Puntos de corte por defecto según la frecuencia elegida (editables luego en Settings del hogar).
function puntosCorteDefault(frecuenciaCorte) {
  if (frecuenciaCorte === 'semanal') {
    return [{ orden: 1, referencia: 'lunes' }];
  }
  if (frecuenciaCorte === 'quincenal') {
    return [
      { orden: 1, referencia: 'dia_15' },
      { orden: 2, referencia: 'fin_de_mes' },
    ];
  }
  return [{ orden: 1, referencia: 'fin_de_mes' }]; // mensual
}

export async function crearHogar(usuarioActual, { nombre, frecuenciaCorte }) {
  if (usuarioActual.hogarId) {
    throw new HttpError(409, 'Ya perteneces a un hogar');
  }

  return prisma.$transaction(async (tx) => {
    const hogar = await tx.hogar.create({
      data: {
        nombre,
        frecuenciaCorte,
        puntosCorte: { create: puntosCorteDefault(frecuenciaCorte) },
      },
    });

    const usuario = await tx.usuario.update({
      where: { id: usuarioActual.id },
      data: {
        hogarId: hogar.id,
        esAdmin: true,
        puedeEditarGastos: true,
        puedeInvitar: true,
      },
    });

    return { hogar, usuario };
  });
}

export async function generarInvitacion(usuarioActual) {
  if (!usuarioActual.hogarId) {
    throw new HttpError(409, 'No perteneces a ningún hogar todavía');
  }
  if (!usuarioActual.esAdmin && !usuarioActual.puedeInvitar) {
    throw new HttpError(403, 'No tienes permiso para invitar miembros');
  }

  const codigo = generateInvitationCode();
  const expiraEn = new Date(Date.now() + INVITACION_VIGENCIA_DIAS * 24 * 60 * 60 * 1000);

  return prisma.invitacionHogar.create({
    data: {
      hogarId: usuarioActual.hogarId,
      codigo,
      creadoPorUsuarioId: usuarioActual.id,
      expiraEn,
    },
  });
}

export async function unirseHogar(usuarioActual, codigo) {
  if (usuarioActual.hogarId) {
    throw new HttpError(409, 'Ya perteneces a un hogar');
  }

  return prisma.$transaction(async (tx) => {
    const invitacion = await tx.invitacionHogar.findUnique({ where: { codigo } });

    if (!invitacion) {
      throw new HttpError(404, 'Código de invitación inválido');
    }
    if (invitacion.usado) {
      throw new HttpError(410, 'Ese código de invitación ya fue usado');
    }
    if (invitacion.expiraEn < new Date()) {
      throw new HttpError(410, 'Ese código de invitación expiró');
    }

    await tx.invitacionHogar.update({
      where: { id: invitacion.id },
      data: { usado: true },
    });

    const usuario = await tx.usuario.update({
      where: { id: usuarioActual.id },
      data: { hogarId: invitacion.hogarId },
    });

    const hogar = await tx.hogar.findUnique({ where: { id: invitacion.hogarId } });

    return { hogar, usuario };
  });
}
