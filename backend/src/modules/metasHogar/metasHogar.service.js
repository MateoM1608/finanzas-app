import { registrarActividad } from '../../utils/actividadHogar.js';
import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { hoyUTC } from '../../utils/fechas.js';
import { calcularMeta } from '../../utils/inversiones.js';
import { validarMovimiento, crearCaja } from '../../utils/movimientosAhorro.js';

/**
 * Metas de ahorro en pareja (entrega D2): fondo de emergencia, viaje, cuota
 * inicial… Cada miembro aporta (o retira) con su plata: el movimiento queda
 * en su caja (aporte_meta_hogar / retiro_meta_hogar), fuera del consumo y de
 * los ingresos reales. Crear, editar y eliminar piden permiso de edición del
 * hogar; aportar, no.
 */

const ORIGENES = { aporte: 'aporte_meta_hogar', retiro: 'retiro_meta_hogar' };

function requireHogarId(usuarioActual) {
  if (!usuarioActual.hogarId) throw new HttpError(409, 'No perteneces a ningún hogar todavía');
  return usuarioActual.hogarId;
}

function requirePermisoEdicion(usuarioActual) {
  if (!usuarioActual.esAdmin && !usuarioActual.puedeEditarGastos) {
    throw new HttpError(403, 'No tienes permiso para editar las finanzas del hogar');
  }
}

async function requireMeta(usuarioActual, id) {
  const hogarId = requireHogarId(usuarioActual);
  const meta = await prisma.metaHogar.findUnique({ where: { id } });
  if (!meta || meta.hogarId !== hogarId) throw new HttpError(404, 'Meta no encontrada');
  return meta;
}

const INCLUDE = {
  movimientos: { orderBy: { fecha: 'asc' }, include: { gasto: { select: { id: true } }, ingreso: { select: { id: true } } } },
};

function vista(meta, usuarioActual, hoy) {
  const calculo = calcularMeta(meta, meta.movimientos, hoy);
  return {
    ...meta,
    ...calculo,
    miAporte: calculo.porMiembro.find((p) => p.usuarioId === usuarioActual.id)?.monto ?? 0,
    // enCaja (si tocó el Disponible) también es solo de quien lo hizo.
    movimientos: meta.movimientos.map(({ gasto, ingreso, ...m }) =>
      m.usuarioId === usuarioActual.id ? { ...m, enCaja: Boolean(gasto || ingreso) } : { ...m, metodoPagoId: null, enCaja: null },
    ),
  };
}

export async function listarMetas(usuarioActual) {
  const hogarId = requireHogarId(usuarioActual);
  const hoy = hoyUTC();
  const metas = await prisma.metaHogar.findMany({ where: { hogarId }, include: INCLUDE, orderBy: { creadoEn: 'asc' } });
  return metas.map((m) => vista(m, usuarioActual, hoy));
}

/** Para el patrimonio: lo que el usuario tiene puesto en metas del hogar (activas o no: la plata sigue ahí). */
export async function misAportesEnMetas(usuarioActual) {
  if (!usuarioActual.hogarId) return 0;
  const movimientos = await prisma.metaHogarMovimiento.findMany({
    where: { usuarioId: usuarioActual.id, meta: { hogarId: usuarioActual.hogarId } },
    select: { tipo: true, monto: true },
  });
  return movimientos.reduce((a, m) => a + (m.tipo === 'aporte' ? m.monto : -m.monto), 0);
}

async function obtener(usuarioActual, id) {
  const meta = await prisma.metaHogar.findUnique({ where: { id }, include: INCLUDE });
  return vista(meta, usuarioActual, hoyUTC());
}

export async function crearMeta(usuarioActual, data) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);
  const meta = await prisma.metaHogar.create({
    data: {
      hogarId,
      creadoPorId: usuarioActual.id,
      nombre: data.nombre,
      montoMeta: data.montoMeta,
      fechaMeta: data.fechaMeta ?? null,
    },
  });
  await registrarActividad(usuarioActual, { tipo: 'meta', descripcion: `creó la meta ${data.nombre}`, monto: data.montoMeta });
  return obtener(usuarioActual, meta.id);
}

export async function actualizarMeta(usuarioActual, id, data) {
  await requireMeta(usuarioActual, id);
  requirePermisoEdicion(usuarioActual);
  await prisma.metaHogar.update({
    where: { id },
    data: {
      ...(data.nombre !== undefined && { nombre: data.nombre }),
      ...(data.montoMeta !== undefined && { montoMeta: data.montoMeta }),
      ...(data.fechaMeta !== undefined && { fechaMeta: data.fechaMeta }),
      ...(data.activa !== undefined && { activa: data.activa }),
    },
  });
  return obtener(usuarioActual, id);
}

export async function eliminarMeta(usuarioActual, id) {
  await requireMeta(usuarioActual, id);
  requirePermisoEdicion(usuarioActual);
  const movimientos = await prisma.metaHogarMovimiento.count({ where: { metaId: id } });
  if (movimientos) throw new HttpError(409, 'Esta meta ya tiene aportes: desactívala en vez de eliminarla');
  await prisma.metaHogar.delete({ where: { id } });
}

const pesosTexto = (n) => `$${Math.round(n).toLocaleString('es-CO')}`;

/** Aporte o retiro de quien lo registra. Un retiro no puede pasar de lo que esa persona ha aportado. */
export async function registrarMovimiento(usuarioActual, id, data) {
  const meta = await requireMeta(usuarioActual, id);
  await validarMovimiento(usuarioActual.id, data);
  if (data.tipo === 'retiro') {
    // Cada uno retira solo lo que ha puesto (sus aportes menos sus retiros).
    const actual = await obtener(usuarioActual, id);
    const tope = Math.min(actual.ahorrado, actual.miAporte);
    if (data.monto > tope) {
      throw new HttpError(400, `No puedes retirar más de lo que has aportado a esta meta (${pesosTexto(tope)})`);
    }
  }
  await prisma.$transaction(
    async (tx) => {
      const mov = await tx.metaHogarMovimiento.create({
        data: {
          metaId: id,
          usuarioId: usuarioActual.id,
          tipo: data.tipo,
          monto: data.monto,
          fecha: data.fecha ?? hoyUTC(),
          metodoPagoId: data.enCaja === false ? null : (data.metodoPagoId ?? null),
        },
      });
      // Sin caja: la plata vino de otra fuente (o el retiro no llegó a una cuenta).
      if (data.enCaja === false) return;
      await crearCaja(tx, mov, {
        enlace: { metaHogarMovId: mov.id },
        origenes: ORIGENES,
        descripcion: `${data.tipo === 'aporte' ? 'Aporte a' : 'Retiro de'} ${meta.nombre} (hogar)`,
      });
    },
    { timeout: 120000, maxWait: 20000 },
  );
  await registrarActividad(usuarioActual, {
    tipo: 'meta',
    descripcion: `${data.tipo === 'aporte' ? 'aportó a' : 'retiró de'} la meta ${meta.nombre}`,
    monto: data.monto,
  });
  return obtener(usuarioActual, id);
}

export async function eliminarMovimiento(usuarioActual, id, movId) {
  await requireMeta(usuarioActual, id);
  const mov = await prisma.metaHogarMovimiento.findUnique({ where: { id: movId } });
  if (!mov || mov.metaId !== id) throw new HttpError(404, 'Movimiento no encontrado');
  if (mov.usuarioId !== usuarioActual.id) throw new HttpError(403, 'Solo quien hizo el movimiento puede quitarlo');
  await prisma.metaHogarMovimiento.delete({ where: { id: movId } });
  return obtener(usuarioActual, id);
}
