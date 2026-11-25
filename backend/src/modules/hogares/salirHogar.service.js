import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { hoyUTC } from '../../utils/fechas.js';
import { registrarActividad } from '../../utils/actividadHogar.js';

/**
 * Salir del hogar (cualquier miembro) o quitar a un miembro (solo el admin).
 * Desde ese momento la persona deja de ver todo lo del hogar: requireAuth lee
 * al usuario de la base en cada petición, así que el corte es inmediato.
 *
 * Para no dejar cuentas a medias, solo se puede cuando la persona no está en
 * nada del hogar sin cuadrar: ningún gasto o cuota (de cualquier fecha) que
 * haya pagado o que le toque en el reparto y no esté cuadrado, y ningún cuadre
 * en curso. Lo ya cuadrado queda en el historial con su nombre. Su panel
 * personal (incluidos los movimientos de caja de lo que pagó) sigue siendo suyo.
 *
 * Al salir: deja de ser responsable de las cuentas fijas, sus invitaciones sin
 * usar se anulan, pierde los permisos, y el reparto vigente se recalcula entre
 * los que quedan (proporcional a lo que tenían) desde hoy.
 */

/** Lo del hogar sin cuadrar que involucra a la persona (pagó o le toca). */
async function pendientesDe(hogarId, usuarioId) {
  const meInvolucra = {
    OR: [{ pagoUsuarioId: usuarioId }, { repartos: { some: { usuarioId, monto: { gt: 0 } } } }],
  };
  const [variables, cuotas, cuadreAbierto] = await Promise.all([
    prisma.gastoVariablePareja.count({ where: { hogarId, estado: { not: 'cuadrado' }, ...meInvolucra } }),
    // Una cuota de cuenta fija que nadie ha pagado no genera deuda: no bloquea.
    prisma.gastoRecurrenteInstancia.count({
      where: { concepto: { hogarId }, estado: { in: ['pagado', 'en_cuadre'] }, ...meInvolucra },
    }),
    prisma.cuadre.count({ where: { hogarId, estado: 'abierto' } }),
  ]);
  return { variables, cuotas, cuadreAbierto };
}

function mensajePendientes(nombre, { variables, cuotas, cuadreAbierto }, propio) {
  if (cuadreAbierto) {
    return 'Hay un cuadre de cuentas en curso: confírmenlo o descártenlo primero.';
  }
  const total = variables + cuotas;
  const quien = propio ? 'Todavía tienes' : `${nombre} todavía tiene`;
  return (
    `${quien} ${total} ${total === 1 ? 'gasto o cuota' : 'gastos o cuotas'} del hogar sin cuadrar ` +
    '(pagados o con reparto, también compras a cuotas o préstamos con cuotas futuras). ' +
    'Cuadren cuentas o cambien quién paga y el reparto antes de salir.'
  );
}

/** Reparto vigente redistribuido entre los que quedan, desde hoy. */
async function recalcularSplit(tx, hogarId, saliente, restantes) {
  const hoy = hoyUTC();
  for (const contexto of ['general', 'gastos_variables']) {
    const ultimo = await tx.splitPorcentajeMiembro.findFirst({
      where: { hogarId, contexto, periodoInicio: { lte: hoy } },
      orderBy: { periodoInicio: 'desc' },
    });
    if (!ultimo) continue;
    const vigente = await tx.splitPorcentajeMiembro.findMany({
      where: { hogarId, contexto, periodoInicio: ultimo.periodoInicio },
    });
    if (!vigente.some((s) => s.usuarioId === saliente)) continue;
    await tx.splitPorcentajeMiembro.deleteMany({ where: { hogarId, contexto, periodoInicio: hoy } });
    if (!restantes.length) continue;
    const quedan = vigente.filter((s) => s.usuarioId !== saliente && restantes.includes(s.usuarioId));
    const suma = quedan.reduce((a, s) => a + s.porcentaje, 0);
    const nuevos = suma > 0
      ? quedan.map((s) => ({ usuarioId: s.usuarioId, porcentaje: (s.porcentaje / suma) * 100 }))
      : restantes.map((id) => ({ usuarioId: id, porcentaje: 100 / restantes.length }));
    await tx.splitPorcentajeMiembro.createMany({
      data: nuevos.map((s) => ({ hogarId, contexto, periodoInicio: hoy, usuarioId: s.usuarioId, porcentaje: s.porcentaje })),
    });
  }
}

async function retirar(usuarioActual, miembro, { porAdmin }) {
  const hogarId = usuarioActual.hogarId;
  const pendientes = await pendientesDe(hogarId, miembro.id);
  if (pendientes.variables || pendientes.cuotas || pendientes.cuadreAbierto) {
    throw new HttpError(409, mensajePendientes(miembro.nombre.split(' ')[0], pendientes, !porAdmin));
  }

  const restantes = (
    await prisma.usuario.findMany({ where: { hogarId, id: { not: miembro.id } }, select: { id: true } })
  ).map((u) => u.id);

  // La actividad se registra mientras la persona todavía es del hogar.
  const nombre = miembro.nombre.split(' ')[0];
  if (restantes.length) {
    await registrarActividad(usuarioActual, {
      tipo: 'miembro',
      descripcion: porAdmin ? `quitó a ${nombre} del hogar` : 'salió del hogar',
      enlace: '/settings',
    });
  }

  await prisma.$transaction(async (tx) => {
    await recalcularSplit(tx, hogarId, miembro.id, restantes);
    await tx.conceptoRecurrentePareja.updateMany({
      where: { hogarId, responsableUsuarioId: miembro.id },
      data: { responsableUsuarioId: null },
    });
    await tx.invitacionHogar.updateMany({
      where: { hogarId, creadoPorUsuarioId: miembro.id, usado: false },
      data: { usado: true },
    });
    await tx.usuario.update({
      where: { id: miembro.id },
      data: { hogarId: null, esAdmin: false, puedeEditarGastos: false, puedeInvitar: false },
    });
  });
}

export async function salirDelHogar(usuarioActual) {
  if (!usuarioActual.hogarId) throw new HttpError(409, 'No perteneces a ningún hogar');
  const otros = await prisma.usuario.count({ where: { hogarId: usuarioActual.hogarId, id: { not: usuarioActual.id } } });
  if (usuarioActual.esAdmin && otros) {
    throw new HttpError(409, 'Eres el administrador: pásale la administración a otro miembro antes de salir');
  }
  await retirar(usuarioActual, usuarioActual, { porAdmin: false });
}

export async function quitarMiembro(usuarioActual, miembroId) {
  if (!usuarioActual.hogarId) throw new HttpError(409, 'No perteneces a ningún hogar');
  if (!usuarioActual.esAdmin) throw new HttpError(403, 'Solo el administrador del hogar puede quitar miembros');
  if (miembroId === usuarioActual.id) throw new HttpError(400, 'Para irte tú, usa "Salir del hogar"');
  const miembro = await prisma.usuario.findUnique({ where: { id: miembroId } });
  if (!miembro || miembro.hogarId !== usuarioActual.hogarId) throw new HttpError(404, 'Ese usuario no pertenece a tu hogar');
  await retirar(usuarioActual, miembro, { porAdmin: true });
}
