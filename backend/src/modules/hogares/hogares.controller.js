import { asyncHandler } from '../../middleware/asyncHandler.js';
import {
  crearHogarSchema,
  joinHogarSchema,
  actualizarHogarSchema,
  actualizarPuntosCorteSchema,
  actualizarPermisosMiembroSchema,
  transferirAdminSchema,
} from './hogares.schema.js';
import {
  crearHogar,
  generarInvitacion,
  unirseHogar,
  obtenerHogarActual,
  actualizarHogar,
  actualizarPuntosCorte,
  listarMiembros,
  actualizarPermisosMiembro,
  transferirAdmin,
} from './hogares.service.js';
import { serializeUsuario } from '../auth/auth.service.js';

export const postHogar = asyncHandler(async (req, res) => {
  const data = crearHogarSchema.parse(req.body);
  const { hogar, usuario } = await crearHogar(req.usuario, data);
  res.status(201).json({ hogar, usuario: serializeUsuario(usuario) });
});

export const postInvitacion = asyncHandler(async (req, res) => {
  const invitacion = await generarInvitacion(req.usuario);
  res.status(201).json({ invitacion });
});

export const postJoin = asyncHandler(async (req, res) => {
  const { codigo } = joinHogarSchema.parse(req.body);
  const { hogar, usuario } = await unirseHogar(req.usuario, codigo);
  res.json({ hogar, usuario: serializeUsuario(usuario) });
});

export const getHogarActual = asyncHandler(async (req, res) => {
  const { hogar, puntosCorte } = await obtenerHogarActual(req.usuario);
  res.json({ hogar, puntosCorte });
});

export const patchHogar = asyncHandler(async (req, res) => {
  const data = actualizarHogarSchema.parse(req.body);
  const { hogar, puntosCorte } = await actualizarHogar(req.usuario, data);
  res.json({ hogar, puntosCorte });
});

export const putPuntosCorte = asyncHandler(async (req, res) => {
  const { puntos } = actualizarPuntosCorteSchema.parse(req.body);
  const puntosCorte = await actualizarPuntosCorte(req.usuario, puntos);
  res.json({ puntosCorte });
});

export const getMiembros = asyncHandler(async (req, res) => {
  const miembros = await listarMiembros(req.usuario);
  res.json({ miembros });
});

export const patchMiembroPermisos = asyncHandler(async (req, res) => {
  const data = actualizarPermisosMiembroSchema.parse(req.body);
  const miembro = await actualizarPermisosMiembro(req.usuario, req.params.id, data);
  res.json({ miembro });
});

export const postTransferirAdmin = asyncHandler(async (req, res) => {
  const { nuevoAdminId } = transferirAdminSchema.parse(req.body);
  const miembros = await transferirAdmin(req.usuario, nuevoAdminId);
  res.json({ miembros });
});
