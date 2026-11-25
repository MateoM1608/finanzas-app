import { prisma } from '../config/prisma.js';
import { HttpError } from '../middleware/errorHandler.js';
import { hoyUTC } from './fechas.js';

/**
 * Caja de los aportes y retiros a inversiones y metas del hogar (D2): un
 * aporte es un GastoPersonal (baja el Disponible, no es consumo) y un retiro
 * un IngresoPersonal (lo sube, no es ingreso real) de quien lo hace, con su
 * cuenta. El movimiento sigue al aporte/retiro (onDelete: Cascade).
 */

export async function validarMovimiento(usuarioId, data) {
  if (data.fecha && data.fecha > hoyUTC()) throw new HttpError(400, 'La fecha no puede ser futura');
  if (data.metodoPagoId) {
    const metodo = await prisma.metodoPagoPersonal.findUnique({ where: { id: data.metodoPagoId } });
    if (!metodo || metodo.usuarioId !== usuarioId) throw new HttpError(400, 'Método de pago no encontrado');
  }
}

/**
 * Crea el movimiento de caja. `enlace`: { inversionMovId } o { metaHogarMovId };
 * `origenes`: { aporte, retiro } (valores de OrigenGasto).
 */
export function crearCaja(tx, mov, { enlace, origenes, descripcion }) {
  const base = {
    usuarioId: mov.usuarioId,
    monto: mov.monto,
    fecha: mov.fecha,
    descripcion,
    metodoPagoId: mov.metodoPagoId ?? null,
    ...enlace,
  };
  if (mov.tipo === 'aporte') {
    return tx.gastoPersonal.create({
      data: { ...base, estado: 'pagado', esObligatorio: false, origen: origenes.aporte },
    });
  }
  return tx.ingresoPersonal.create({ data: { ...base, estado: 'recibido', origen: origenes.retiro } });
}
