import { prisma } from '../config/prisma.js';
import { HttpError } from './errorHandler.js';
import { SESSION_COOKIE_NAME, verifySessionToken } from '../utils/jwt.js';
import { asyncHandler } from './asyncHandler.js';

export const requireAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (!token) {
    throw new HttpError(401, 'No autenticado');
  }

  let payload;
  try {
    payload = verifySessionToken(token);
  } catch {
    throw new HttpError(401, 'Sesión inválida o expirada');
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: payload.sub } });
  if (!usuario) {
    throw new HttpError(401, 'Sesión inválida');
  }

  req.usuario = usuario;
  next();
});
