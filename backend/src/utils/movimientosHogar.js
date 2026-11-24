import { prisma } from '../config/prisma.js';
import { hoyUTC } from './fechas.js';

/**
 * Movimientos de CAJA del hogar en el panel personal (origen `pago_hogar`):
 * cuando un miembro paga un gasto del hogar, en sus movimientos aparece el
 * 100 % con su método y fecha de pago (esa plata salió de su bolsillo). Su
 * parte de CONSUMO no sale de aquí: se calcula desde el hogar (consumo.js).
 *
 * El movimiento sigue al gasto del hogar: se crea al pagarlo, se actualiza
 * si cambia y desaparece si se deshace el pago (o se borra el gasto, por el
 * onDelete: Cascade de la relación).
 */

/** Sincroniza el movimiento de una cuota de cuenta fija (GastoRecurrenteInstancia). */
export async function sincronizarPagoCuota(tx, cuotaId) {
  const cuota = await tx.gastoRecurrenteInstancia.findUnique({
    where: { id: cuotaId },
    include: { concepto: { select: { nombre: true } } },
  });
  if (!cuota || cuota.estado === 'por_pagar' || !cuota.pagoUsuarioId || cuota.monto == null) {
    await tx.gastoPersonal.deleteMany({ where: { pagoCuotaHogarId: cuotaId } });
    return;
  }
  const fecha = cuota.fechaPago ?? cuota.fecha;
  await guardar(tx, { pagoCuotaHogarId: cuotaId }, {
    usuarioId: cuota.pagoUsuarioId,
    monto: cuota.monto,
    fecha,
    descripcion: `Hogar · ${cuota.concepto.nombre}`,
    metodoPagoId: cuota.metodoPagoId,
  });
}

/** Sincroniza el movimiento de un gasto variable o una cuota de compra del hogar (GastoVariablePareja). */
export async function sincronizarPagoGasto(tx, gastoId) {
  const gasto = await tx.gastoVariablePareja.findUnique({
    where: { id: gastoId },
    include: { compra: { select: { numeroCuotas: true, metodoPagoId: true } } },
  });
  if (!gasto || gasto.estado === 'por_pagar') {
    await tx.gastoPersonal.deleteMany({ where: { pagoGastoHogarId: gastoId } });
    return;
  }
  const nombre = gasto.compra ? `${gasto.item} (cuota ${gasto.numeroCuota}/${gasto.compra.numeroCuotas})` : gasto.item;
  await guardar(tx, { pagoGastoHogarId: gastoId }, {
    usuarioId: gasto.pagoUsuarioId,
    monto: gasto.valorTotal,
    fecha: gasto.fechaPago ?? gasto.fecha,
    descripcion: `Hogar · ${nombre}`,
    metodoPagoId: gasto.metodoPagoId ?? gasto.compra?.metodoPagoId ?? null,
    capital: gasto.capital,
    interes: gasto.interes,
  });
}

async function guardar(tx, enlace, datos) {
  // Una cuota automática con fecha futura todavía no ha salido: queda
  // pendiente y pasa a pagada sola en su fecha (pagarMovimientosVencidos).
  const estado = new Date(datos.fecha) <= hoyUTC() ? 'pagado' : 'pendiente';
  const existente = await tx.gastoPersonal.findFirst({ where: enlace, select: { id: true, usuarioId: true } });
  const data = { ...datos, estado, esObligatorio: false, origen: 'pago_hogar' };
  if (existente) {
    await tx.gastoPersonal.update({ where: { id: existente.id }, data });
  } else {
    await tx.gastoPersonal.create({ data: { ...data, ...enlace } });
  }
}

/** Sincroniza todos los pagos de un hogar (para backfill o tras regenerar cuotas). */
export async function sincronizarPagosHogar(hogarId, client = prisma) {
  const [cuotas, gastos] = await Promise.all([
    client.gastoRecurrenteInstancia.findMany({ where: { concepto: { hogarId } }, select: { id: true } }),
    client.gastoVariablePareja.findMany({ where: { hogarId }, select: { id: true } }),
  ]);
  for (const c of cuotas) await sincronizarPagoCuota(client, c.id);
  for (const g of gastos) await sincronizarPagoGasto(client, g.id);
}
