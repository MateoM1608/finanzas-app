import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { generateInvitationCode } from '../../utils/invitationCode.js';

const INVITACION_VIGENCIA_DIAS = 7;

// Puntos de corte por defecto según la frecuencia elegida (la "referencia" es editable
// luego en Settings; diaMes/diaSemana son estructurales y los usa el cálculo de fechas).
function puntosCorteDefault(frecuenciaCorte) {
  if (frecuenciaCorte === 'semanal') {
    return [{ orden: 1, referencia: 'lunes', diaSemana: 1 }];
  }
  if (frecuenciaCorte === 'quincenal') {
    return [
      { orden: 1, referencia: 'dia_15', diaMes: 15 },
      { orden: 2, referencia: 'fin_de_mes', diaMes: null },
    ];
  }
  return [{ orden: 1, referencia: 'fin_de_mes', diaMes: null }]; // mensual
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

export async function obtenerHogarActual(usuarioActual) {
  const hogarId = requireHogarId(usuarioActual);
  const hogar = await prisma.hogar.findUnique({ where: { id: hogarId } });
  const puntosCorte = await prisma.puntoCorteHogar.findMany({
    where: { hogarId },
    orderBy: { orden: 'asc' },
  });
  return { hogar, puntosCorte };
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

export async function actualizarHogar(usuarioActual, { nombre, frecuenciaCorte }) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);

  const hogarActual = await prisma.hogar.findUnique({ where: { id: hogarId } });
  const cambiaFrecuencia = frecuenciaCorte && frecuenciaCorte !== hogarActual.frecuenciaCorte;

  return prisma.$transaction(async (tx) => {
    if (cambiaFrecuencia) {
      const puntosExistentes = await tx.puntoCorteHogar.findMany({ where: { hogarId } });
      const puntoIds = puntosExistentes.map((p) => p.id);
      await tx.conceptoPuntoCorte.deleteMany({ where: { puntoCorteId: { in: puntoIds } } });
      await tx.puntoCorteHogar.deleteMany({ where: { hogarId } });
      await tx.puntoCorteHogar.createMany({
        data: puntosCorteDefault(frecuenciaCorte).map((p) => ({ ...p, hogarId })),
      });
    }

    const hogar = await tx.hogar.update({
      where: { id: hogarId },
      data: {
        nombre: nombre ?? undefined,
        frecuenciaCorte: frecuenciaCorte ?? undefined,
      },
    });

    const puntosCorte = await tx.puntoCorteHogar.findMany({
      where: { hogarId },
      orderBy: { orden: 'asc' },
    });

    return { hogar, puntosCorte };
  });
}

export async function actualizarPuntosCorte(usuarioActual, puntos) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);

  const existentes = await prisma.puntoCorteHogar.findMany({ where: { hogarId } });
  const existentesIds = new Set(existentes.map((p) => p.id));

  for (const punto of puntos) {
    if (!existentesIds.has(punto.id)) {
      throw new HttpError(400, 'Uno de los puntos de corte no pertenece a tu hogar');
    }
  }

  await prisma.$transaction(
    puntos.map((punto) =>
      prisma.puntoCorteHogar.update({
        where: { id: punto.id },
        data: { referencia: punto.referencia },
      }),
    ),
  );

  return prisma.puntoCorteHogar.findMany({ where: { hogarId }, orderBy: { orden: 'asc' } });
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
