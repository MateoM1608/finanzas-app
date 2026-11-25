import { prisma } from '../config/prisma.js';
import { hoyUTC } from './fechas.js';
import { asegurarCuotasHogar } from './cuentasFijas.js';
import { notificar } from './notificaciones.js';

/**
 * Gasto del hogar por categoría y topes mensuales (entrega E4).
 *
 * Qué cuenta como gasto de un mes: lo PAGADO (pagado, en cuadre o cuadrado)
 * con fecha dentro del mes calendario, sin importar quién pagó ni si ya se
 * cuadró:
 *   - cuotas de cuentas fijas → categoría de la cuenta;
 *   - gastos variables y cuotas de compras → su categoría;
 *   - cuotas de préstamos del hogar → "Préstamos" (clave especial).
 * Los abonos extra a capital no son gasto (bajan la deuda) y no cuentan.
 * Una cuota automática con fecha de este mes pero posterior a hoy todavía no
 * se ha cobrado: va en "por pagar", junto con lo que nadie ha marcado pagado.
 */
export const CLAVE_PRESTAMOS = 'prestamos';
export const CLAVE_SIN_CATEGORIA = 'sin_categoria';
const PAGADOS = ['pagado', 'en_cuadre', 'cuadrado'];
export const UMBRAL_AVISO = 0.8;

export function inicioDeMes(fecha) {
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), 1));
}
export function finDeMes(inicio) {
  return new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, 0));
}
export function claveDeMes(inicio) {
  return inicio.toISOString().slice(0, 7);
}

function claveCategoria(categoriaId, prestamoId) {
  if (prestamoId) return CLAVE_PRESTAMOS;
  return categoriaId ?? CLAVE_SIN_CATEGORIA;
}

/**
 * Suma por categoría lo gastado en [desde, hasta] (y, si se pide, lo que falta
 * por pagar del mismo rango). Devuelve Maps clave → monto.
 */
export async function gastoPorCategoria(hogarId, desde, hasta, { conPendiente = false, hoy = hoyUTC() } = {}) {
  const corteGastado = hasta < hoy ? hasta : hoy;
  const [cuotas, variables] = await Promise.all([
    prisma.gastoRecurrenteInstancia.findMany({
      where: { concepto: { hogarId }, fecha: { gte: desde, lte: hasta } },
      select: { fecha: true, monto: true, estado: true, concepto: { select: { categoriaId: true, montoDefault: true } } },
    }),
    prisma.gastoVariablePareja.findMany({
      where: { hogarId, abonoPrestamoId: null, fecha: { gte: desde, lte: hasta } },
      select: { fecha: true, valorTotal: true, estado: true, categoriaId: true, prestamoId: true },
    }),
  ]);
  const gastado = new Map();
  const pendiente = new Map();
  const sumar = (mapa, clave, monto) => mapa.set(clave, (mapa.get(clave) ?? 0) + monto);

  for (const c of cuotas) {
    const clave = claveCategoria(c.concepto.categoriaId, null);
    if (PAGADOS.includes(c.estado) && c.fecha <= corteGastado) sumar(gastado, clave, c.monto ?? 0);
    else if (conPendiente) sumar(pendiente, clave, c.monto ?? c.concepto.montoDefault ?? 0);
  }
  for (const v of variables) {
    const clave = claveCategoria(v.categoriaId, v.prestamoId);
    if (PAGADOS.includes(v.estado) && v.fecha <= corteGastado) sumar(gastado, clave, v.valorTotal);
    else if (conPendiente) sumar(pendiente, clave, v.valorTotal);
  }
  return { gastado, pendiente };
}

function totalDe(mapa) {
  let t = 0;
  for (const v of mapa.values()) t += v;
  return t;
}

/** Lo gastado (y pendiente) que le corresponde a un tope en los mapas dados. */
function montoDeTope(tope, mapa) {
  return tope.categoriaId ? (mapa.get(tope.categoriaId) ?? 0) : totalDe(mapa);
}

function estadoDe(gastado, monto) {
  if (gastado > monto) return 'excedido';
  if (gastado >= monto * UMBRAL_AVISO) return 'cerca';
  return 'dentro';
}

/**
 * Resumen de los topes del hogar: el mes actual en vivo y el mes pasado con
 * su foto (se guarda la primera vez que se consulta, solo para topes que ya
 * existían ese mes). También deja las notificaciones de 80 % y excedido.
 */
export async function resumenTopes(hogarId, hoy = hoyUTC()) {
  await asegurarCuotasHogar(hogarId, hoy);
  const mes = inicioDeMes(hoy);
  const fin = finDeMes(mes);
  const mesAnterior = new Date(Date.UTC(mes.getUTCFullYear(), mes.getUTCMonth() - 1, 1));
  const finAnterior = finDeMes(mesAnterior);

  const topes = await prisma.topeHogar.findMany({
    where: { hogarId, activo: true },
    include: { categoria: { select: { id: true, nombre: true } }, meses: { where: { mes: mesAnterior } } },
    orderBy: { creadoEn: 'asc' },
  });
  if (!topes.length) return { mes: claveDeMes(mes), mesAnterior: claveDeMes(mesAnterior), topes: [] };

  const actual = await gastoPorCategoria(hogarId, mes, fin, { conPendiente: true, hoy });
  const faltaFoto = topes.some((t) => !t.meses.length && t.creadoEn <= finAnteriorFinDelDia(finAnterior));
  const anterior = faltaFoto ? await gastoPorCategoria(hogarId, mesAnterior, finAnterior, { hoy }) : null;

  const resultado = [];
  for (const t of topes) {
    let foto = t.meses[0] ?? null;
    if (!foto && anterior && t.creadoEn <= finAnteriorFinDelDia(finAnterior)) {
      foto = await prisma.topeHogarMes.upsert({
        where: { topeId_mes: { topeId: t.id, mes: mesAnterior } },
        create: { topeId: t.id, mes: mesAnterior, montoTope: t.montoMensual, montoGastado: montoDeTope(t, anterior.gastado) },
        update: {},
      });
    }
    const gastado = montoDeTope(t, actual.gastado);
    const porPagar = montoDeTope(t, actual.pendiente);
    resultado.push({
      id: t.id,
      nombre: t.categoria?.nombre ?? 'Total del hogar',
      categoriaId: t.categoriaId,
      montoMensual: t.montoMensual,
      gastado,
      porPagar,
      restante: t.montoMensual - gastado,
      porcentaje: t.montoMensual ? Math.round((gastado / t.montoMensual) * 100) : 0,
      estado: estadoDe(gastado, t.montoMensual),
      mesAnterior: foto
        ? { montoTope: foto.montoTope, gastado: foto.montoGastado, estado: foto.montoGastado > foto.montoTope ? 'excedido' : 'dentro' }
        : null,
    });
  }
  await avisarTopes(hogarId, claveDeMes(mes), resultado);
  return { mes: claveDeMes(mes), mesAnterior: claveDeMes(mesAnterior), topes: resultado };
}

// creadoEn tiene hora; el fin de mes es medianoche del último día.
function finAnteriorFinDelDia(finAnterior) {
  return new Date(finAnterior.getTime() + 24 * 60 * 60 * 1000 - 1);
}

const pesos = (n) => `$${Math.round(n).toLocaleString('es-CO')}`;

/** Una notificación por tope, mes y nivel (80 % / excedido), a todos los miembros. */
async function avisarTopes(hogarId, mesClave, topes) {
  const avisos = topes.filter((t) => t.estado !== 'dentro');
  if (!avisos.length) return;
  const miembros = await prisma.usuario.findMany({ where: { hogarId }, select: { id: true } });
  for (const t of avisos) {
    const nivel = t.estado === 'excedido' ? 'excedido' : '80';
    const titulo =
      nivel === 'excedido'
        ? `Se pasaron del tope de ${t.nombre}`
        : `Van en el ${t.porcentaje} % del tope de ${t.nombre}`;
    const mensaje =
      nivel === 'excedido'
        ? `${pesos(t.gastado)} de ${pesos(t.montoMensual)} este mes (${pesos(-t.restante)} por encima).`
        : `${pesos(t.gastado)} de ${pesos(t.montoMensual)} este mes. Quedan ${pesos(t.restante)}.`;
    for (const m of miembros) {
      await notificar(m.id, { tipo: 'tope_hogar', titulo, mensaje, enlace: '/hogar', clave: `tope:${t.id}:${mesClave}:${nivel}` });
    }
  }
}

/** Revisa los topes después de un cambio en el hogar (sin romper nada si falla). */
export async function revisarTopesHogar(hogarId) {
  if (!hogarId) return;
  try {
    const hay = await prisma.topeHogar.count({ where: { hogarId, activo: true } });
    if (hay) await resumenTopes(hogarId);
  } catch (error) {
    console.error('No se pudieron revisar los topes del hogar', error);
  }
}
