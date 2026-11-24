import { asyncHandler } from '../../middleware/asyncHandler.js';
import { pagarCuotaSchema } from './cuentasHogar.schema.js';
import { obtenerCuentasHogar, pagarCuota, deshacerPagoCuota } from './cuentasHogar.service.js';

export const getCuentasHogar = asyncHandler(async (req, res) => {
  res.json(await obtenerCuentasHogar(req.usuario));
});

export const postPagarCuota = asyncHandler(async (req, res) => {
  const data = pagarCuotaSchema.parse(req.body ?? {});
  const cuota = await pagarCuota(req.usuario, req.params.id, data);
  res.json({ cuota });
});

export const postDeshacerPago = asyncHandler(async (req, res) => {
  const cuota = await deshacerPagoCuota(req.usuario, req.params.id);
  res.json({ cuota });
});
