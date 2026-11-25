import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// `v` = Usuario.sesionVersion al firmar: si después sube (cambio de contraseña
// o "cerrar las demás sesiones"), requireAuth rechaza el token.
export function signSessionToken(usuarioId, version = 0) {
  return jwt.sign({ sub: usuarioId, v: version }, env.jwtSecret, { expiresIn: ONE_YEAR_SECONDS, algorithm: 'HS256' });
}

export function verifySessionToken(token) {
  return jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
}

export const SESSION_COOKIE_NAME = 'finanzas_session';
export const SESSION_COOKIE_MAX_AGE_MS = ONE_YEAR_SECONDS * 1000;
