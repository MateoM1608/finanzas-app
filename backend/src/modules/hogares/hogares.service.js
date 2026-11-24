import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { generateInvitationCode } from '../../utils/invitationCode.js';

const INVITACION_VIGENCIA_DIAS = 7;

export async function crearHogar(usuarioActual, { nombre }) {
  if (usuarioActual.hogarId) {
    throw new HttpError(409, 'Ya perteneces a un hogar');
  }

  return prisma.$transaction(async (tx) => {
    const hogar = await tx.hogar.create({
      data: { nombre },
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

export async function obtenerHogarActual(usuarioActual) {
  const hogarId = requireHogarId(usuarioActual);
  return prisma.hogar.findUnique({ where: { id: hogarId } });
}

function requireHogarId(usuarioActual) {
  if (!usuarioActual.hogarId) {
    throw new HttpError(409, 'No perteneces a ningún hogar todavía');
  }
  return usuarioActual.hogarId;
}

function requirePermisoEdicion(usuarioActual) {
  if (!usuarioActual.esAdmin && !usuarioActual.puedeEditarGastos) {
    throw new HttpError(403, 'No tienes permiso para editar la configuración del hogar');
  }
}

function requireAdmin(usuarioActual) {
  if (!usuarioActual.esAdmin) {
    throw new HttpError(403, 'Solo el administrador del hogar puede hacer esto');
  }
}

export async function actualizarHogar(usuarioActual, { nombre }) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);
  return prisma.hogar.update({ where: { id: hogarId }, data: { nombre: nombre ?? undefined } });
}

export async function listarMiembros(usuarioActual) {
  const hogarId = requireHogarId(usuarioActual);

  return prisma.usuario.findMany({
    where: { hogarId },
    select: {
      id: true,
      nombre: true,
      usuario: true,
      esAdmin: true,
      puedeEditarGastos: true,
      puedeInvitar: true,
    },
    orderBy: { creadoEn: 'asc' },
  });
}

export async function actualizarPermisosMiembro(usuarioActual, miembroId, permisos) {
  const hogarId = requireHogarId(usuarioActual);
  requireAdmin(usuarioActual);

  const miembro = await prisma.usuario.findUnique({ where: { id: miembroId } });
  if (!miembro || miembro.hogarId !== hogarId) {
    throw new HttpError(404, 'Ese usuario no pertenece a tu hogar');
  }

  return prisma.usuario.update({
    where: { id: miembroId },
    data: {
      puedeEditarGastos: permisos.puedeEditarGastos ?? undefined,
      puedeInvitar: permisos.puedeInvitar ?? undefined,
    },
    select: {
      id: true,
      nombre: true,
      usuario: true,
      esAdmin: true,
      puedeEditarGastos: true,
      puedeInvitar: true,
    },
  });
}

export async function transferirAdmin(usuarioActual, nuevoAdminId) {
  const hogarId = requireHogarId(usuarioActual);
  requireAdmin(usuarioActual);

  if (nuevoAdminId === usuarioActual.id) {
    throw new HttpError(400, 'Ya eres el administrador');
  }

  const nuevoAdmin = await prisma.usuario.findUnique({ where: { id: nuevoAdminId } });
  if (!nuevoAdmin || nuevoAdmin.hogarId !== hogarId) {
    throw new HttpError(404, 'Ese usuario no pertenece a tu hogar');
  }

  await prisma.$transaction([
    prisma.usuario.update({ where: { id: usuarioActual.id }, data: { esAdmin: false } }),
    prisma.usuario.update({
      where: { id: nuevoAdminId },
      data: { esAdmin: true, puedeEditarGastos: true, puedeInvitar: true },
    }),
    prisma.logTransferenciaAdmin.create({
      data: {
        hogarId,
        usuarioAnteriorId: usuarioActual.id,
        usuarioNuevoId: nuevoAdminId,
      },
    }),
  ]);

  return listarMiembros({ hogarId });
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
