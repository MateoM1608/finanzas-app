import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { asegurarGastosFijos } from '../../utils/instanciasFijasPersonales.js';
import { evaluarPeriodoSiCorresponde } from '../../utils/evaluacionAhorro.js';

const INCLUDE_GASTO = {
  metodoPago: true,
  categoria: true,
  compra: { select: { id: true, numeroCuotas: true, modoCobro: true } },
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
  if (gasto.origen === 'pago_hogar') {
    throw new HttpError(409, 'Este movimiento es el pago de un gasto del hogar: cámbialo desde Hogar');
  }
  if (gasto.origen === 'liquidacion_hogar') {
    throw new HttpError(409, 'Este movimiento es el pago de un cuadre del hogar y no se puede cambiar');
  }
  if (gasto.prestamoId || gasto.origen === 'abono_prestamo') {
    throw new HttpError(409, 'Este movimiento es de un préstamo: manéjalo desde Préstamos');
  }
  if (gasto.origen === 'aporte_inversion' || gasto.origen === 'aporte_meta_hogar') {
    throw new HttpError(409, 'Este movimiento es un aporte a una inversión o meta: quítalo desde allí');
  }
}

export async function listarGastosPersonales(usuarioId) {
  await asegurarGastosFijos(usuarioId);
  return prisma.gastoPersonal.findMany({
    where: { usuarioId },
    include: INCLUDE_GASTO,
    orderBy: { fecha: 'desc' },
  });
}

export async function crearGastoPersonal(usuarioId, data) {
  const gasto = await prisma.gastoPersonal.create({
    data: { ...data, usuarioId },
    include: INCLUDE_GASTO,
  });
  await evaluarSiObligatorioPagado(gasto);
  return gasto;
}

export async function actualizarGastoPersonal(usuarioId, gastoId, data) {
  const gasto = await prisma.gastoPersonal.findUnique({ where: { id: gastoId } });
  if (!gasto || gasto.usuarioId !== usuarioId) {
    throw new HttpError(404, 'Gasto no encontrado');
  }
  requireNoEsDelHogar(gasto);

  const actualizado = await prisma.gastoPersonal.update({
    where: { id: gastoId },
    data,
    include: INCLUDE_GASTO,
  });
  await evaluarSiObligatorioPagado(actualizado);
  return actualizado;
}

export async function eliminarGastoPersonal(usuarioId, gastoId) {
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
  const metodo = await requireMetodoPropio(usuarioId, metodoPagoId);
  return prisma.$transaction(async (tx) => {
    if (gasto.pagoCuotaHogarId) {
      await tx.gastoRecurrenteInstancia.update({ where: { id: gasto.pagoCuotaHogarId }, data: { metodoPagoId: metodo } });
    } else if (gasto.pagoGastoHogarId) {
      await tx.gastoVariablePareja.update({ where: { id: gasto.pagoGastoHogarId }, data: { metodoPagoId: metodo } });
    }
    return tx.gastoPersonal.update({ where: { id: gastoId }, data: { metodoPagoId: metodo }, include: INCLUDE_GASTO });
  });
}
