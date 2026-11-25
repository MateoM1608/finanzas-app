import { prisma } from '../config/prisma.js';
import { notificar } from './notificaciones.js';

/**
 * Actividad del hogar (entrega E3): deja constancia de quién hizo qué y avisa
 * con notificar() a los demás miembros (o solo a quien se indique). Se llama
 * DESPUÉS de guardar el cambio; si falla, no deshace nada (es informativa).
 *
 *   registrarActividad(usuarioActual, {
 *     tipo: 'gasto_variable', descripcion: 'agregó Mercado', monto: 120000,
 *     enlace: '/hogar', avisar: 'otros' | 'nadie' | [usuarioId, ...],
 *   })
 */
const pesos = (n) => `$${Math.round(n).toLocaleString('es-CO')}`;

export async function registrarActividad(
  usuarioActual,
  { tipo, descripcion, monto = null, enlace = '/hogar', avisar = 'otros', notificacion = null },
) {
  const hogarId = usuarioActual.hogarId;
  if (!hogarId) return null;
  try {
    const actividad = await prisma.actividadHogar.create({
      data: { hogarId, usuarioId: usuarioActual.id, tipo, descripcion, monto, enlace },
    });
    let destinatarios = [];
    if (avisar === 'otros') {
      const miembros = await prisma.usuario.findMany({ where: { hogarId, id: { not: usuarioActual.id } }, select: { id: true } });
      destinatarios = miembros.map((m) => m.id);
    } else if (Array.isArray(avisar)) {
      destinatarios = avisar.filter((id) => id && id !== usuarioActual.id);
    }
    const nombre = usuarioActual.nombre?.split(' ')[0] ?? 'Alguien';
    for (const usuarioId of destinatarios) {
      await notificar(usuarioId, {
        tipo: 'actividad',
        titulo: notificacion?.titulo ?? `${nombre} ${descripcion}`,
        mensaje: notificacion?.mensaje ?? (monto != null ? pesos(monto) : 'En el hogar'),
        enlace: notificacion?.enlace ?? enlace,
        clave: `actividad:${actividad.id}`,
      });
    }
    return actividad;
  } catch (error) {
    console.error('No se pudo registrar la actividad del hogar', error);
    return null;
  }
}

/**
 * Un pago del hogar registrado a nombre de otro miembro: queda en la
 * actividad y le avisa a esa persona (le llega a sus movimientos sin cuenta,
 * para que la elija). Si el pagador es quien registra, avisa a los demás.
 */
export async function registrarPago(usuarioActual, pagoUsuarioId, { tipo, item, monto, enlace = '/hogar' }) {
  if (pagoUsuarioId && pagoUsuarioId !== usuarioActual.id) {
    const pagador = await prisma.usuario.findUnique({ where: { id: pagoUsuarioId }, select: { nombre: true } });
    const nombre = usuarioActual.nombre?.split(' ')[0] ?? 'Alguien';
    return registrarActividad(usuarioActual, {
      tipo,
      descripcion: `registró que ${pagador?.nombre?.split(' ')[0] ?? 'otro miembro'} pagó ${item}`,
      monto,
      enlace,
      avisar: [pagoUsuarioId],
      notificacion: {
        titulo: `${nombre} registró que pagaste ${item}`,
        mensaje: `${monto != null ? `${pesos(monto)} · ` : ''}Elige con qué cuenta pagaste en tus movimientos.`,
        enlace: '/personal',
      },
    });
  }
  return registrarActividad(usuarioActual, { tipo, descripcion: `pagó ${item}`, monto, enlace });
}

export async function listarActividad(usuarioActual, limite = 40) {
  if (!usuarioActual.hogarId) return [];
  return prisma.actividadHogar.findMany({
    where: { hogarId: usuarioActual.hogarId },
    include: { usuario: { select: { id: true, nombre: true } } },
    orderBy: { creadoEn: 'desc' },
    take: limite,
  });
}
