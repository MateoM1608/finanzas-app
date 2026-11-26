import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { HttpError } from '../middleware/errorHandler.js';

/**
 * Compras en dólares con tarjeta de crédito. Los dólares se guardan en
 * centavos (enteros, US$ 12,34 = 1234) y la tasa (pesos por dólar) como
 * número con decimales. El valor en pesos de una compra es su consumo; la
 * deuda de la tarjeta lleva aparte los dólares.
 */

// 20 millones de dólares: cabe en la columna (Int) y sobra para cualquier compra.
export const USD_MAX_CENTAVOS = 2_000_000_000;

export const centavosUsd = z.number().int().positive().max(USD_MAX_CENTAVOS);
export const tasaCambio = z.number().positive().max(100_000);

/** Pesos de unos centavos de dólar a una tasa. */
export function aPesos(centavos, trm) {
  return Math.round(((centavos ?? 0) * trm) / 100);
}

/**
 * Valida que el gasto en dólares vaya con una tarjeta de crédito propia
 * (los dólares solo existen en la deuda de una tarjeta).
 */
export async function requireTarjetaParaDolares(usuarioId, metodoPagoId) {
  if (!metodoPagoId) throw new HttpError(400, 'Una compra en dólares necesita una tarjeta de crédito');
  const metodo = await prisma.metodoPagoPersonal.findUnique({ where: { id: metodoPagoId } });
  if (!metodo || metodo.usuarioId !== usuarioId) throw new HttpError(400, 'Método de pago no encontrado');
  if (metodo.tipo !== 'tarjeta_credito') throw new HttpError(400, 'Solo las tarjetas de crédito llevan compras en dólares');
  return metodo;
}

/*
 * TRM oficial (Superintendencia Financiera, publicada en datos.gov.co). Solo
 * es una sugerencia: el usuario la puede cambiar. Se guarda en memoria unas
 * horas por fecha para no consultar en cada pantalla. No se envía ningún dato
 * del usuario.
 */
const FUENTE = 'https://www.datos.gov.co/resource/32sa-8pi3.json';
const CACHE_MS = 6 * 60 * 60 * 1000;
const cache = new Map();

async function consultarTrm(fechaISO) {
  if (fechaISO && !/^\d{4}-\d{2}-\d{2}$/.test(fechaISO)) throw new Error('Fecha inválida');
  const params = new URLSearchParams({ $order: 'vigenciadesde DESC', $limit: '1' });
  if (fechaISO) params.set('$where', `vigenciadesde <= '${fechaISO}T00:00:00'`);
  const resp = await fetch(`${FUENTE}?${params}`, { signal: AbortSignal.timeout(5000) });
  if (!resp.ok) throw new Error(`TRM ${resp.status}`);
  const [fila] = await resp.json();
  const valor = Number(fila?.valor);
  if (!Number.isFinite(valor) || valor <= 0) throw new Error('TRM sin valor');
  return { valor, vigencia: fila.vigenciadesde?.slice(0, 10) ?? null };
}

/**
 * TRM de una fecha (YYYY-MM-DD) o de hoy. Si la consulta falla, devuelve la
 * última tasa que el usuario usó (o null): la app sigue funcionando y la tasa
 * se escribe a mano.
 */
export async function obtenerTrm(usuarioId, fechaISO = null) {
  const clave = fechaISO ?? 'hoy';
  const guardada = cache.get(clave);
  if (guardada && Date.now() - guardada.en < CACHE_MS) return { ...guardada.dato, fuente: 'oficial' };
  try {
    const dato = await consultarTrm(fechaISO);
    cache.set(clave, { dato, en: Date.now() });
    return { ...dato, fuente: 'oficial' };
  } catch {
    if (!usuarioId) return null;
    const ultima = await prisma.gastoPersonal.findFirst({
      where: { usuarioId, trm: { not: null } },
      orderBy: { creadoEn: 'desc' },
      select: { trm: true, fecha: true },
    });
    return ultima ? { valor: ultima.trm, vigencia: ultima.fecha.toISOString().slice(0, 10), fuente: 'ultima_usada' } : null;
  }
}

/** Tasa para valorar en pesos la deuda en dólares de hoy (patrimonio, cupo). */
export async function trmParaDeuda(usuarioId) {
  return (await obtenerTrm(usuarioId))?.valor ?? null;
}
