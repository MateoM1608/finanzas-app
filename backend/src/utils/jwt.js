import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function signSessionToken(usuarioId) {
  return jwt.sign({ sub: usuarioId }, env.jwtSecret, { expiresIn: ONE_YEAR_SECONDS });
}

export function verifySessionToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

export const SESSION_COOKIE_NAME = 'finanzas_session';
export const SESSION_COOKIE_MAX_AGE_MS = ONE_YEAR_SECONDS * 1000;
