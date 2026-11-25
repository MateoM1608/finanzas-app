import { asyncHandler } from '../../middleware/asyncHandler.js';
import { registerSchema, loginSchema, cambiarPasswordSchema } from './auth.schema.js';
import {
  registerUsuario,
  authenticateUsuario,
  serializeUsuario,
  cambiarPassword,
  cerrarOtrasSesiones,
} from './auth.service.js';
import { signSessionToken, SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE_MS } from '../../utils/jwt.js';
import { ipDe } from '../../utils/limiteIntentos.js';
import { env } from '../../config/env.js';

const opcionesCookie = () => ({
  httpOnly: true,
  secure: env.nodeEnv === 'production',
  sameSite: 'lax',
});

function setSessionCookie(res, usuario) {
  const token = signSessionToken(usuario.id, usuario.sesionVersion ?? 0);
  res.cookie(SESSION_COOKIE_NAME, token, { ...opcionesCookie(), maxAge: SESSION_COOKIE_MAX_AGE_MS });
}

export const register = asyncHandler(async (req, res) => {
  const data = registerSchema.parse(req.body);
  const usuario = await registerUsuario(data, ipDe(req));
  setSessionCookie(res, usuario);
  res.status(201).json({ usuario: serializeUsuario(usuario) });
});

export const login = asyncHandler(async (req, res) => {
  const data = loginSchema.parse(req.body);
  const usuario = await authenticateUsuario(data, ipDe(req));
  setSessionCookie(res, usuario);
  res.json({ usuario: serializeUsuario(usuario) });
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME, opcionesCookie());
  res.status(204).send();
});

export const me = asyncHandler(async (req, res) => {
  res.json({ usuario: serializeUsuario(req.usuario) });
});

// Las dos sacan a las demás sesiones y le dan a esta un token nuevo.
export const postCambiarPassword = asyncHandler(async (req, res) => {
  const data = cambiarPasswordSchema.parse(req.body);
  const usuario = await cambiarPassword(req.usuario, data, ipDe(req));
  setSessionCookie(res, usuario);
  res.status(204).send();
});

export const postCerrarOtrasSesiones = asyncHandler(async (req, res) => {
  const usuario = await cerrarOtrasSesiones(req.usuario);
  setSessionCookie(res, usuario);
  res.status(204).send();
});
