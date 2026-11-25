import { asyncHandler } from '../../middleware/asyncHandler.js';
import {
  crearHogarSchema,
  joinHogarSchema,
  actualizarHogarSchema,
  actualizarPermisosMiembroSchema,
  transferirAdminSchema,
} from './hogares.schema.js';
import {
  crearHogar,
  generarInvitacion,
  unirseHogar,
  obtenerHogarActual,
  actualizarHogar,
  listarMiembros,
  actualizarPermisosMiembro,
  transferirAdmin,
} from './hogares.service.js';
import { serializeUsuario } from '../auth/auth.service.js';
import { ipDe, revisarBloqueo, sumarIntento } from '../../utils/limiteIntentos.js';

export const postHogar = asyncHandler(async (req, res) => {
  const data = crearHogarSchema.parse(req.body);
  const { hogar, usuario } = await crearHogar(req.usuario, data);
  res.status(201).json({ hogar, usuario: serializeUsuario(usuario) });
});

export const postInvitacion = asyncHandler(async (req, res) => {
  const invitacion = await generarInvitacion(req.usuario);
  res.status(201).json({ invitacion });
});

// 10 códigos errados por conexión en una hora bloquean esa conexión una hora.
const JOIN_IP = { max: 10, ventanaMin: 60, bloqueoMin: 60 };

export const postJoin = asyncHandler(async (req, res) => {
  const { codigo } = joinHogarSchema.parse(req.body);
  const clave = `join:ip:${ipDe(req)}`;
  await revisarBloqueo(clave);
  let resultado;
  try {
    resultado = await unirseHogar(req.usuario, codigo);
  } catch (error) {
    if (error.status === 404 || error.status === 410) await sumarIntento(clave, JOIN_IP);
    throw error;
  }
  const { hogar, usuario } = resultado;
  res.json({ hogar, usuario: serializeUsuario(usuario) });
});

export const getHogarActual = asyncHandler(async (req, res) => {
  const hogar = await obtenerHogarActual(req.usuario);
  res.json({ hogar });
});

export const patchHogar = asyncHandler(async (req, res) => {
  const data = actualizarHogarSchema.parse(req.body);
  const hogar = await actualizarHogar(req.usuario, data);
  res.json({ hogar });
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
