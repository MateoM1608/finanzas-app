import { asyncHandler } from '../../middleware/asyncHandler.js';
import { obtenerDashboardPersonal, obtenerDashboardHogar } from './dashboard.service.js';

export const getDashboardPersonal = asyncHandler(async (req, res) => {
  const data = await obtenerDashboardPersonal(req.usuario.id);
  res.json(data);
});

export const getDashboardHogar = asyncHandler(async (req, res) => {
  const data = await obtenerDashboardHogar(req.usuario);
  res.json(data);
});
