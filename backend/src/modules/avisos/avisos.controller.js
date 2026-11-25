import crypto from 'node:crypto';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { HttpError } from '../../middleware/errorHandler.js';
import {
  obtenerAvisos,
  listarNotificaciones,
  contarNoLeidas,
  marcarLeida,
  marcarTodasLeidas,
  registrarDispositivo,
  eliminarDispositivo,
  generarParaTodos,
} from './avisos.service.js';

const leidaSchema = z.object({ leida: z.boolean() });
const dispositivoSchema = z.object({
  token: z.string().trim().min(10).max(4096),
  plataforma: z.enum(['android', 'ios', 'web']).optional(),
});

export const getAvisos = asyncHandler(async (req, res) => {
  res.json(await obtenerAvisos(req.usuario));
});
export const getNotificaciones = asyncHandler(async (req, res) => {
  res.json(await listarNotificaciones(req.usuario));
});
export const getResumenNotificaciones = asyncHandler(async (req, res) => {
  res.json(await contarNoLeidas(req.usuario));
});
export const patchNotificacion = asyncHandler(async (req, res) => {
  const { leida } = leidaSchema.parse(req.body);
  res.json({ notificacion: await marcarLeida(req.usuario, req.params.id, leida) });
});
export const postLeerTodas = asyncHandler(async (req, res) => {
  await marcarTodasLeidas(req.usuario);
  res.status(204).send();
});
export const postDispositivo = asyncHandler(async (req, res) => {
  const data = dispositivoSchema.parse(req.body);
  await registrarDispositivo(req.usuario, data);
  res.status(204).send();
});
export const deleteDispositivo = asyncHandler(async (req, res) => {
  const { token } = dispositivoSchema.pick({ token: true }).parse(req.body);
  await eliminarDispositivo(req.usuario, token);
  res.status(204).send();
});

/**
 * Cron (a futuro): POST /api/notificaciones/generar con
 * `Authorization: Bearer <CRON_SECRET>`. Sin CRON_SECRET configurado no existe.
 */
export const postGenerarTodas = asyncHandler(async (req, res) => {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) throw new HttpError(404, 'Ruta no encontrada');
  const enviado = Buffer.from(req.get('authorization') ?? '');
  const esperado = Buffer.from(`Bearer ${secreto}`);
  if (enviado.length !== esperado.length || !crypto.timingSafeEqual(enviado, esperado)) {
    throw new HttpError(401, 'No autorizado');
  }
  res.json(await generarParaTodos());
});
