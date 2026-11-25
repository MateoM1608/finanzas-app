import { asyncHandler } from '../../middleware/asyncHandler.js';
import { listarActividad } from '../../utils/actividadHogar.js';

export const getActividad = asyncHandler(async (req, res) => {
  const limite = Math.min(100, Math.max(1, Number.parseInt(req.query.limite, 10) || 40));
  res.json({ actividad: await listarActividad(req.usuario, limite) });
});
