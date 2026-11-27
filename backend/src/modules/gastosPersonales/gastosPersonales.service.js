import { validarReferenciasPropias } from '../../utils/pertenencia.js';
import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { asegurarGastosFijos, asegurarPagosAutomaticosHogar } from '../../utils/instanciasFijasPersonales.js';
import { evaluarPeriodoSiCorresponde } from '../../utils/evaluacionAhorro.js';
import { requireTarjetaParaDolares } from '../../utils/dolares.js';

const INCLUDE_GASTO = {
  metodoPago: true,
  categoria: true,
  compra: { select: { id: true, numeroCuotas: true, modoCobro: true } },
  registradoPor: { select: { id: true, nombre: true } },
};

/**
 * Dispara la evaluación de Ahorros del período que contiene la fecha de este
 * gasto, cuando queda pagado y es obligatorio — ver
 * Modulo_Panel_Personal_Ajustes.md sección 6.4. Es idempotente (no hace nada
 * si ese período ya fue evaluado), así que no importa si se llama de más.
 */
async function evaluarSiObligatorioPagado(gasto) {
  if (gasto.esObligatorio && gasto.estado === 'pagado') {
    await evaluarPeriodoSiCorresponde(gasto.usuarioId, gasto.fecha);
  }
}

/**
 * Los movimientos de caja del hogar (el pago de un gasto del hogar, el
 * reintegro o pago de un cuadre) se manejan desde Hogar/Cuadres: editarlos
 * aquí los desincronizaría de su origen.
 */
function requireNoEsDelHogar(gasto) {
  if (gasto.origen === 'saldo_inicial') {
    throw new HttpError(409, 'Este es el saldo inicial de una cuenta: cámbialo en Personal → Configuración → Métodos de pago');
  }
  if (gasto.origen === 'pago_hogar') {
    throw new HttpError(409, 'Este movimiento es el pago de un gasto del hogar: cámbialo desde Hogar');
  }
  if (gasto.origen === 'liquidacion_hogar') {
    throw new HttpError(409, 'Este movimiento es el pago de un cuadre del hogar y no se puede cambiar');
  }
  if (gasto.prestamoId || gasto.origen === 'abono_prestamo') {
    throw new HttpError(409, 'Este movimiento es de un préstamo: manéjalo desde Préstamos');
  }
  if (['aporte_inversion', 'aporte_meta_hogar', 'aporte_ahorro'].includes(gasto.origen)) {
    throw new HttpError(409, 'Este movimiento es un aporte a un ahorro, inversión o meta: quítalo desde allí');
  }
}

/**
 * Dólares de un gasto: solo con una tarjeta de crédito y con su tasa. Sin
 * dólares, la tasa se limpia. `actual` es el gasto antes de editarlo.
 */
async function validarDolares(usuarioId, data, actual = null) {
  const montoUsd = data.montoUsd !== undefined ? data.montoUsd : actual?.montoUsd ?? null;
  const metodoPagoId = data.metodoPagoId !== undefined ? data.metodoPagoId : actual?.metodoPagoId ?? null;
  if (!montoUsd) {
    if (data.montoUsd === null) data.trm = null;
    else delete data.trm;
    return;
  }
  const trm = data.trm !== undefined ? data.trm : actual?.trm ?? null;
  if (!trm) throw new HttpError(400, 'Escribe la tasa de cambio de la compra en dólares');
  await requireTarjetaParaDolares(usuarioId, metodoPagoId);
}

export async function listarGastosPersonales(usuarioId) {
  await asegurarGastosFijos(usuarioId);
  await asegurarPagosAutomaticosHogar(usuarioId);
  return prisma.gastoPersonal.findMany({
    where: { usuarioId },
    include: INCLUDE_GASTO,
    orderBy: { fecha: 'desc' },
  });
}

export async function crearGastoPersonal(usuarioId, data) {
  await validarReferenciasPropias(usuarioId, data);
  await validarDolares(usuarioId, data);
  const gasto = await prisma.gastoPersonal.create({
    data: { ...data, usuarioId },
    include: INCLUDE_GASTO,
  });
  await evaluarSiObligatorioPagado(gasto);
  return gasto;
}

export async function actualizarGastoPersonal(usuarioId, gastoId, data) {
  await validarReferenciasPropias(usuarioId, data);
  const gasto = await prisma.gastoPersonal.findUnique({ where: { id: gastoId } });
  if (!gasto || gasto.usuarioId !== usuarioId) {
    throw new HttpError(404, 'Gasto no encontrado');
  }
  requireNoEsDelHogar(gasto);
  if (gasto.origen === 'pago_tarjeta' && (data.montoUsd !== undefined || data.trm !== undefined)) {
    throw new HttpError(409, 'Un pago de tarjeta no cambia sus dólares: bórralo y regístralo de nuevo');
  }
  await validarDolares(usuarioId, data, gasto);

  const actualizado = await prisma.gastoPersonal.update({
    where: { id: gastoId },
    data,
    include: INCLUDE_GASTO,
  });
  await evaluarSiObligatorioPagado(actualizado);
  return actualizado;
}

/** Un gasto suelto que se puede borrar (o convertir en compra a cuotas): si no, 404/409. */
export async function requireGastoEliminable(usuarioId, gastoId) {
  const gasto = await prisma.gastoPersonal.findUnique({ where: { id: gastoId } });
  if (!gasto || gasto.usuarioId !== usuarioId) {
    throw new HttpError(404, 'Gasto no encontrado');
  }
  requireNoEsDelHogar(gasto);
  if (gasto.origenConfigId) {
    throw new HttpError(
      409,
      'Este gasto viene de un concepto fijo — desactiva el concepto en vez de eliminar esta ocurrencia (si no, volvería a generarse)',
    );
  }
  if (gasto.compraId) {
    throw new HttpError(409, 'Esta es una cuota de una compra a cuotas — elimina la compra completa');
  }
  if (gasto.origenCuadreId) {
    throw new HttpError(409, 'Este gasto viene de un cuadre del hogar ya cerrado — no se puede eliminar');
  }
  const deExtracto = await prisma.extractoAjuste.count({ where: { gastoId, tipo: { in: ['cargo', 'no_reconocido'] } } });
  if (deExtracto) {
    throw new HttpError(409, 'Este cargo viene de la revisión de un extracto — quítalo desde Tarjetas → Extractos');
  }
  return gasto;
}

export async function eliminarGastoPersonal(usuarioId, gastoId) {
  await requireGastoEliminable(usuarioId, gastoId);
  await prisma.gastoPersonal.delete({ where: { id: gastoId } });
}

async function requireMetodoPropio(usuarioId, metodoPagoId) {
  if (!metodoPagoId) return null;
  const metodo = await prisma.metodoPagoPersonal.findUnique({ where: { id: metodoPagoId } });
  if (!metodo || metodo.usuarioId !== usuarioId) {
    throw new HttpError(400, 'Método de pago no encontrado');
  }
  return metodoPagoId;
}

/**
 * Cambia SOLO el método de pago de un movimiento propio. Es la única
 * edición permitida en los movimientos del hogar (pago al 100 % o pago de un
 * cuadre): el monto y la fecha vienen del hogar, pero con qué se pagó es
 * dato de cada quien y se puede definir después (ej. el otro miembro confirmó
 * el cuadre o marcó el pago). En un pago del hogar, el método queda también
 * en el gasto del hogar, para que el movimiento siga sincronizado.
 */
export async function cambiarMetodoGastoPersonal(usuarioId, gastoId, metodoPagoId) {
  const gasto = await prisma.gastoPersonal.findUnique({ where: { id: gastoId } });
  if (!gasto || gasto.usuarioId !== usuarioId) {
    throw new HttpError(404, 'Gasto no encontrado');
  }
  if (gasto.origen === 'saldo_inicial') {
    throw new HttpError(409, 'Este es el saldo inicial de una cuenta: cámbialo en Personal → Configuración → Métodos de pago');
  }
  const metodo = await requireMetodoPropio(usuarioId, metodoPagoId);
  if (gasto.montoUsd && gasto.origen !== 'pago_tarjeta') await requireTarjetaParaDolares(usuarioId, metodo);
  return prisma.$transaction(async (tx) => {
    if (gasto.pagoCuotaHogarId) {
      await tx.gastoRecurrenteInstancia.update({ where: { id: gasto.pagoCuotaHogarId }, data: { metodoPagoId: metodo } });
    } else if (gasto.pagoGastoHogarId) {
      await tx.gastoVariablePareja.update({ where: { id: gasto.pagoGastoHogarId }, data: { metodoPagoId: metodo } });
    }
    return tx.gastoPersonal.update({ where: { id: gastoId }, data: { metodoPagoId: metodo }, include: INCLUDE_GASTO });
  });
}
