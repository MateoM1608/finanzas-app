import { asyncHandler } from '../../middleware/asyncHandler.js';
import { crearHogarSchema, joinHogarSchema } from './hogares.schema.js';
import { crearHogar, generarInvitacion, unirseHogar } from './hogares.service.js';
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
