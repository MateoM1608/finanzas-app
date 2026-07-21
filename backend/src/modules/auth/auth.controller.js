import { asyncHandler } from '../../middleware/asyncHandler.js';
import { registerSchema, loginSchema } from './auth.schema.js';
import { registerUsuario, authenticateUsuario, serializeUsuario } from './auth.service.js';
import { signSessionToken, SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE_MS } from '../../utils/jwt.js';
import { env } from '../../config/env.js';

function setSessionCookie(res, usuarioId) {
  const token = signSessionToken(usuarioId);
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: SESSION_COOKIE_MAX_AGE_MS,
  });
}

export const register = asyncHandler(async (req, res) => {
  const data = registerSchema.parse(req.body);
  const usuario = await registerUsuario(data);
  setSessionCookie(res, usuario.id);
  res.status(201).json({ usuario: serializeUsuario(usuario) });
});

export const login = asyncHandler(async (req, res) => {
  const data = loginSchema.parse(req.body);
  const usuario = await authenticateUsuario(data);
  setSessionCookie(res, usuario.id);
  res.json({ usuario: serializeUsuario(usuario) });
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME);
  res.status(204).send();
});

export const me = asyncHandler(async (req, res) => {
  res.json({ usuario: serializeUsuario(req.usuario) });
});
