import { z } from 'zod';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { obtenerProyeccion } from './proyeccionPersonal.service.js';

const querySchema = z.object({ meses: z.coerce.number().int().min(1).max(12).default(6) });

export const getProyeccion = asyncHandler(async (req, res) => {
  const { meses } = querySchema.parse(req.query);
  res.json(await obtenerProyeccion(req.usuario, meses));
});
