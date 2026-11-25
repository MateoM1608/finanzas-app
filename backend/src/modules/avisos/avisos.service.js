import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { hoyUTC } from '../../utils/fechas.js';
import { asegurarCuotasHogar } from '../../utils/cuentasFijas.js';
import { notificar, TIPOS_VENCIMIENTO } from '../../utils/notificaciones.js';
import { calcularDeudaTarjetas } from '../metodosPagoPersonales/metodosPagoPersonales.service.js';

/**
 * Avisos de lo que hay que pagar (entrega E2): lo atrasado, lo de hoy y lo de
 * los próximos DIAS_AVISO días. Se calculan en vivo (no se guardan) y, de paso,
 * dejan una notificación en la bandeja de quien tiene que pagar cada cosa:
 * una cuando se acerca, otra el día que vence y otra si queda atrasada.
 * Cuando algo se paga, sus notificaciones pendientes se marcan leídas solas.
 */

export const DIAS_AVISO = 3;
const DIA = 24 * 60 * 60 * 1000;

const pesos = (n) => `$${Math.round(n).toLocaleString('es-CO')}`;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaCorta = (f) => {
  const d = new Date(f);
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
};

function estadoDe(fecha, hoy) {
  const dias = Math.round((new Date(fecha) - hoy) / DIA);
  return { dias, estado: dias < 0 ? 'atrasado' : dias === 0 ? 'hoy' : 'proximo' };
}

function aviso(base, fecha, hoy) {
  return { ...base, fecha, ...estadoDe(fecha, hoy) };
}

function enMes(anio, mes, dia) {
  const a = anio + Math.floor(mes / 12);
  const m = ((mes % 12) + 12) % 12;
  const ultimo = new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(a, m, Math.min(dia, ultimo)));
}

/**
 * Avisos que ve el usuario: `personales` (lo suyo) y `hogar` (todo lo del
 * hogar por pagar; `paraMi` marca lo que le toca: es el responsable o quien
 * paga, o la cuenta no tiene responsable).
 */
export async function calcularAvisos(usuarioActual) {
  const usuarioId = usuarioActual.id;
  const hoy = hoyUTC();
  const limite = new Date(hoy.getTime() + DIAS_AVISO * DIA);

  // --- Personales: gastos pendientes que se pagan a mano ---
  const pendientes = await prisma.gastoPersonal.findMany({
    where: {
      usuarioId,
      estado: 'pendiente',
      fecha: { lte: limite },
      origen: { not: 'pago_hogar' },
      AND: [
        { OR: [{ compraId: null }, { compra: { modoCobro: 'manual' } }] },
        { OR: [{ prestamoId: null }, { prestamo: { modoCobro: 'manual' } }] },
      ],
    },
    include: { categoria: { select: { nombre: true } }, compra: { select: { descripcion: true, numeroCuotas: true } }, prestamo: { select: { nombre: true, numeroCuotas: true } } },
    orderBy: { fecha: 'asc' },
  });
  const personales = pendientes.map((g) => {
    const plan = g.compra ?? g.prestamo;
    const nombre = g.descripcion || g.categoria?.nombre || 'Gasto';
    return aviso(
      {
        id: `gasto:${g.id}`,
        tipo: g.prestamoId ? 'cuota_prestamo' : g.compraId ? 'cuota_compra' : 'gasto',
        ambito: 'personal',
        titulo: plan && g.numeroCuota ? `${nombre} (cuota ${g.numeroCuota}/${plan.numeroCuotas})` : nombre,
        monto: g.monto,
        enlace: g.prestamoId ? '/patrimonio' : '/personal',
        paraMi: true,
      },
      g.fecha,
      hoy,
    );
  });

  // --- Tarjetas: el pago se acerca y hay deuda sin pagar este ciclo ---
  const tarjetas = await prisma.metodoPagoPersonal.findMany({
    where: { usuarioId, tipo: 'tarjeta_credito', diaPago: { not: null } },
  });
  if (tarjetas.length) {
    const deudas = await calcularDeudaTarjetas(usuarioId);
    for (const t of tarjetas) {
      const deuda = deudas.get(t.id) ?? 0;
      if (deuda <= 0) continue;
      let pago = enMes(hoy.getUTCFullYear(), hoy.getUTCMonth(), t.diaPago);
      if (pago < hoy) pago = enMes(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, t.diaPago);
      if (pago > limite) continue;
      // Si ya registró un pago de esa tarjeta en las últimas semanas, se da por pagada.
      const pagoReciente = await prisma.gastoPersonal.count({
        where: { usuarioId, origen: 'pago_tarjeta', tarjetaPagadaId: t.id, fecha: { gte: new Date(pago.getTime() - 25 * DIA) } },
      });
      if (pagoReciente) continue;
      personales.push(
        aviso(
          { id: `tarjeta:${t.id}:${pago.toISOString().slice(0, 10)}`, tipo: 'tarjeta', ambito: 'personal', titulo: `Pago de ${t.nombre}`, monto: deuda, enlace: `/personal/tarjetas?metodo=${t.id}`, paraMi: true },
          pago,
          hoy,
        ),
      );
    }
  }

  // --- Hogar: cuentas fijas y cuotas manuales sin pagar ---
  const hogar = [];
  if (usuarioActual.hogarId) {
    const hogarId = usuarioActual.hogarId;
    await asegurarCuotasHogar(hogarId, hoy);
    const [cuentas, cuotas, miembros] = await Promise.all([
      prisma.gastoRecurrenteInstancia.findMany({
        where: { estado: 'por_pagar', fecha: { lte: limite }, concepto: { hogarId, activo: true } },
        include: { concepto: { select: { nombre: true, montoDefault: true, responsableUsuarioId: true } } },
        orderBy: { fecha: 'asc' },
      }),
      prisma.gastoVariablePareja.findMany({
        where: { hogarId, estado: 'por_pagar', fecha: { lte: limite }, OR: [{ compraId: { not: null } }, { prestamoId: { not: null } }] },
        include: { compra: { select: { numeroCuotas: true } }, prestamo: { select: { numeroCuotas: true } } },
        orderBy: { fecha: 'asc' },
      }),
      prisma.usuario.findMany({ where: { hogarId }, select: { id: true, nombre: true } }),
    ]);
    const nombre = new Map(miembros.map((m) => [m.id, m.nombre]));
    for (const c of cuentas) {
      const responsable = c.concepto.responsableUsuarioId;
      hogar.push(
        aviso(
          {
            id: `cuenta_hogar:${c.id}`,
            tipo: 'cuenta_hogar',
            ambito: 'hogar',
            titulo: c.concepto.nombre,
            monto: c.monto ?? c.concepto.montoDefault ?? null,
            enlace: '/hogar',
            responsable: responsable ? (nombre.get(responsable) ?? null) : null,
            paraMi: !responsable || responsable === usuarioId,
          },
          c.fecha,
          hoy,
        ),
      );
    }
    for (const q of cuotas) {
      const plan = q.compra ?? q.prestamo;
      hogar.push(
        aviso(
          {
            id: `cuota_hogar:${q.id}`,
            tipo: q.prestamoId ? 'cuota_prestamo' : 'cuota_compra',
            ambito: 'hogar',
            titulo: `${q.item} (cuota ${q.numeroCuota}/${plan?.numeroCuotas ?? '?'})`,
            monto: q.valorTotal,
            enlace: q.prestamoId ? '/patrimonio' : '/hogar',
            responsable: nombre.get(q.pagoUsuarioId) ?? null,
            paraMi: q.pagoUsuarioId === usuarioId,
          },
          q.fecha,
          hoy,
        ),
      );
    }
  }

  const porFecha = (a, b) => new Date(a.fecha) - new Date(b.fecha);
  return { personales: personales.sort(porFecha), hogar: hogar.sort(porFecha), diasAviso: DIAS_AVISO };
}

const FASE = { proximo: 'vence_pronto', hoy: 'vence_hoy', atrasado: 'atrasado' };

function textoNotificacion(a) {
  const monto = a.monto != null ? ` · ${pesos(a.monto)}` : '';
  if (a.estado === 'atrasado') {
    return { titulo: `${a.titulo} está atrasado`, mensaje: `Venció el ${fechaCorta(a.fecha)}${monto}. Márcalo cuando lo pagues.` };
  }
  if (a.estado === 'hoy') return { titulo: `${a.titulo} vence hoy`, mensaje: `Vence hoy${monto}.` };
  return {
    titulo: `${a.titulo} vence en ${a.dias} día${a.dias === 1 ? '' : 's'}`,
    mensaje: `Vence el ${fechaCorta(a.fecha)}${monto}.`,
  };
}

/** Deja en la bandeja las notificaciones de los avisos que le tocan al usuario. */
export async function generarNotificaciones(usuarioActual, avisos = null) {
  const { personales, hogar } = avisos ?? (await calcularAvisos(usuarioActual));
  const mios = [...personales, ...hogar.filter((a) => a.paraMi)];
  for (const a of mios) {
    const { titulo, mensaje } = textoNotificacion(a);
    await notificar(usuarioActual.id, { tipo: FASE[a.estado], titulo, mensaje, enlace: a.enlace, clave: `${a.id}:${FASE[a.estado]}` });
  }
  // Lo que ya se pagó (o dejó de tocarle) no se queda como pendiente sin leer.
  const vigentes = new Set(mios.map((a) => a.id));
  const sinLeer = await prisma.notificacion.findMany({
    where: { usuarioId: usuarioActual.id, leida: false, tipo: { in: TIPOS_VENCIMIENTO } },
    select: { id: true, clave: true },
  });
  const resueltas = sinLeer.filter((n) => !vigentes.has(n.clave.slice(0, n.clave.lastIndexOf(':')))).map((n) => n.id);
  if (resueltas.length) await prisma.notificacion.updateMany({ where: { id: { in: resueltas } }, data: { leida: true } });
}

// Para no recalcular en cada cambio de pantalla: una vez cada pocos minutos
// por usuario e instancia (no hay cron todavía; ver generarParaTodos).
const ultimaGeneracion = new Map();
const CADA_MS = 5 * 60 * 1000;

async function generarSiHaceFalta(usuarioActual, forzar = false) {
  const ultima = ultimaGeneracion.get(usuarioActual.id) ?? 0;
  if (!forzar && Date.now() - ultima < CADA_MS) return;
  ultimaGeneracion.set(usuarioActual.id, Date.now());
  await generarNotificaciones(usuarioActual);
}

/** GET /api/avisos: los avisos en vivo (y, de paso, sus notificaciones). */
export async function obtenerAvisos(usuarioActual) {
  const avisos = await calcularAvisos(usuarioActual);
  ultimaGeneracion.set(usuarioActual.id, Date.now());
  await generarNotificaciones(usuarioActual, avisos);
  return avisos;
}

export async function listarNotificaciones(usuarioActual) {
  await generarSiHaceFalta(usuarioActual);
  const [notificaciones, noLeidas] = await Promise.all([
    prisma.notificacion.findMany({ where: { usuarioId: usuarioActual.id }, orderBy: { creadaEn: 'desc' }, take: 60 }),
    prisma.notificacion.count({ where: { usuarioId: usuarioActual.id, leida: false } }),
  ]);
  return { notificaciones, noLeidas };
}

export async function contarNoLeidas(usuarioActual) {
  await generarSiHaceFalta(usuarioActual);
  return { noLeidas: await prisma.notificacion.count({ where: { usuarioId: usuarioActual.id, leida: false } }) };
}

export async function marcarLeida(usuarioActual, id, leida) {
  const n = await prisma.notificacion.findUnique({ where: { id } });
  if (!n || n.usuarioId !== usuarioActual.id) throw new HttpError(404, 'Notificación no encontrada');
  return prisma.notificacion.update({ where: { id }, data: { leida } });
}

export async function marcarTodasLeidas(usuarioActual) {
  await prisma.notificacion.updateMany({ where: { usuarioId: usuarioActual.id, leida: false }, data: { leida: true } });
}

/** La APK registra el token de Firebase del teléfono (uno por dispositivo). */
export async function registrarDispositivo(usuarioActual, { token, plataforma }) {
  return prisma.dispositivoNotificacion.upsert({
    where: { token },
    create: { usuarioId: usuarioActual.id, token, plataforma: plataforma ?? 'android' },
    update: { usuarioId: usuarioActual.id, plataforma: plataforma ?? 'android', ultimoUsoEn: new Date() },
  });
}

export async function eliminarDispositivo(usuarioActual, token) {
  await prisma.dispositivoNotificacion.deleteMany({ where: { token, usuarioId: usuarioActual.id } });
}

/**
 * Para un cron diario (Vercel Cron, cuando haya push): genera las
 * notificaciones de todos los usuarios con hogar o movimientos.
 */
export async function generarParaTodos() {
  const usuarios = await prisma.usuario.findMany();
  let total = 0;
  for (const u of usuarios) {
    await generarNotificaciones(u);
    total += 1;
  }
  return { usuarios: total };
}
