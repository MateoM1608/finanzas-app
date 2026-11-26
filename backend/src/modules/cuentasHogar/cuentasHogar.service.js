import { registrarActividad, registrarPago } from '../../utils/actividadHogar.js';
import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { asegurarCuotasHogar, seVaAPagarSola } from '../../utils/cuentasFijas.js';
import { obtenerSplitVigente, calcularReparto } from '../../utils/reparto.js';
import { hoyUTC } from '../../utils/fechas.js';
import { sincronizarPagoCuota, sincronizarPagoGasto } from '../../utils/movimientosHogar.js';
import { validarMetodoDelPagador, ocultarMetodoAjeno } from '../../utils/metodoPagoPrivado.js';

/**
 * Cuotas de las cuentas fijas del hogar (GastoRecurrenteInstancia). Una
 * cuota solo cuenta para el saldo y los cuadres cuando alguien la marca como
 * pagada: lo que nadie ha pagado no genera deuda entre los miembros.
 */

const INCLUDE_CUOTA = {
  concepto: {
    select: {
      id: true,
      nombre: true,
      tipoMonto: true,
      frecuencia: true,
      pagoAutomatico: true,
      pagoAutomaticoDesde: true,
      responsableUsuarioId: true,
      responsable: { select: { id: true, nombre: true } },
    },
  },
  pagador: { select: { id: true, nombre: true } },
  metodoPago: { select: { id: true, nombre: true } },
  repartos: { include: { usuario: { select: { id: true, nombre: true } } } },
};

function requireHogarId(usuarioActual) {
  if (!usuarioActual.hogarId) {
    throw new HttpError(409, 'No perteneces a ningún hogar todavía');
  }
  return usuarioActual.hogarId;
}

function requirePermisoEdicion(usuarioActual) {
  if (!usuarioActual.esAdmin && !usuarioActual.puedeEditarGastos) {
    throw new HttpError(403, 'No tienes permiso para editar los gastos del hogar');
  }
}

async function requireCuotaDelHogar(hogarId, cuotaId) {
  const cuota = await prisma.gastoRecurrenteInstancia.findUnique({
    where: { id: cuotaId },
    include: { concepto: true },
  });
  if (!cuota || cuota.concepto.hogarId !== hogarId) {
    throw new HttpError(404, 'Cuota no encontrada');
  }
  return cuota;
}

/**
 * Vista de las cuentas fijas para Panel del hogar:
 * - porPagar: cuotas con fecha ≤ hoy que nadie ha pagado (`atrasada` si ya pasó su día).
 * - proximas: la siguiente cuota sin pagar de cada cuenta, con fecha futura.
 * - pagadasSinCuadrar: pagadas que todavía no entran a un cuadre cerrado.
 */
export async function obtenerCuentasHogar(usuarioActual) {
  const hogarId = requireHogarId(usuarioActual);
  const hoy = hoyUTC();
  await asegurarCuotasHogar(hogarId, hoy);

  const cuotas = await prisma.gastoRecurrenteInstancia.findMany({
    where: {
      concepto: { hogarId },
      estado: { in: ['por_pagar', 'pagado', 'en_cuadre'] },
    },
    include: INCLUDE_CUOTA,
    orderBy: { fecha: 'asc' },
  });

  const porPagar = [];
  const proximas = [];
  const pagadasSinCuadrar = [];
  const conProxima = new Set();

  for (const cuotaCompleta of cuotas) {
    const cuota = {
      ...ocultarMetodoAjeno(cuotaCompleta, usuarioActual),
      seVaAPagarSola: cuotaCompleta.estado === 'por_pagar' && seVaAPagarSola(cuotaCompleta.concepto, cuotaCompleta),
    };
    if (cuota.estado !== 'por_pagar') {
      pagadasSinCuadrar.push(cuota);
    } else if (cuota.fecha <= hoy) {
      porPagar.push({ ...cuota, atrasada: cuota.fecha < hoy });
    } else if (!conProxima.has(cuota.conceptoId)) {
      conProxima.add(cuota.conceptoId);
      proximas.push(cuota);
    }
  }

  return { porPagar, proximas, pagadasSinCuadrar };
}

export async function pagarCuota(usuarioActual, cuotaId, data) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);
  const cuota = await requireCuotaDelHogar(hogarId, cuotaId);
  if (cuota.estado !== 'por_pagar') {
    throw new HttpError(409, 'Esta cuota ya está marcada como pagada');
  }

  const pagoUsuarioId = data.pagoUsuarioId ?? cuota.concepto.responsableUsuarioId ?? usuarioActual.id;
  const pertenece = await prisma.usuario.count({ where: { id: pagoUsuarioId, hogarId } });
  if (!pertenece) {
    throw new HttpError(400, 'Quien pagó debe ser un miembro de tu hogar');
  }

  const metodoPagoId = await validarMetodoDelPagador(usuarioActual, pagoUsuarioId, data.metodoPagoId);
  const monto = cuota.concepto.tipoMonto === 'variable' ? data.monto : (data.monto ?? cuota.monto);
  if (monto == null) {
    throw new HttpError(400, 'Indica cuánto se pagó: es una cuenta de monto variable');
  }

  // Se reparte con el split vigente en la FECHA de la cuota, no el de hoy.
  const split = await obtenerSplitVigente(hogarId, 'general', prisma, cuota.fecha);
  if (!split.length) {
    throw new HttpError(409, 'Configura primero el porcentaje de reparto del hogar en Hogar → Configuración → Reparto');
  }

  const pagada = await prisma.$transaction(async (tx) => {
    await tx.gastoRecurrenteInstanciaReparto.deleteMany({ where: { instanciaId: cuotaId } });
    await tx.gastoRecurrenteInstanciaReparto.createMany({
      data: calcularReparto(monto, split).map((r) => ({ instanciaId: cuotaId, ...r })),
    });
    await tx.gastoRecurrenteInstancia.update({
      where: { id: cuotaId },
      data: {
        monto,
        pagoUsuarioId,
        fechaPago: data.fechaPago ?? hoyUTC(),
        metodoPagoId,
        estado: 'pagado',
        pagoRegistradoPorId: usuarioActual.id,
        pagoAutomatico: false,
      },
    });
    // El 100 % sale de la plata de quien pagó: queda en sus movimientos.
    await sincronizarPagoCuota(tx, cuotaId);
    return tx.gastoRecurrenteInstancia.findUnique({ where: { id: cuotaId }, include: INCLUDE_CUOTA });
  });
  await registrarPago(usuarioActual, pagoUsuarioId, { tipo: 'cuenta_fija', item: cuota.concepto.nombre, monto });
  return ocultarMetodoAjeno(pagada, usuarioActual);
}

export async function deshacerPagoCuota(usuarioActual, cuotaId) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);
  const cuota = await requireCuotaDelHogar(hogarId, cuotaId);
  if (cuota.estado === 'en_cuadre') {
    throw new HttpError(409, 'Esta cuota está en el cuadre en curso — desmárcala del cuadre primero');
  }
  if (cuota.estado === 'cuadrado') {
    throw new HttpError(409, 'Esta cuota ya se cuadró y no se puede modificar');
  }
  if (cuota.estado !== 'pagado') {
    throw new HttpError(409, 'Esta cuota no está marcada como pagada');
  }

  // Si la cuenta es automática y la cuota ya llegó a su fecha, deshacer la
  // deja por pagar a mano (ej. el cobro falló): no se vuelve a pagar sola.
  const yaVencio = cuota.fecha <= hoyUTC();
  const sinPagoAutomatico = cuota.sinPagoAutomatico || (yaVencio && seVaAPagarSola(cuota.concepto, cuota));

  return prisma.$transaction(async (tx) => {
    await tx.gastoRecurrenteInstanciaReparto.deleteMany({ where: { instanciaId: cuotaId } });
    await tx.gastoRecurrenteInstancia.update({
      where: { id: cuotaId },
      data: {
        estado: 'por_pagar',
        pagoAutomatico: false,
        sinPagoAutomatico,
        pagoUsuarioId: null,
        fechaPago: null,
        metodoPagoId: null,
        pagoRegistradoPorId: null,
        monto: cuota.concepto.tipoMonto === 'fijo' ? cuota.concepto.montoDefault : null,
      },
    });
    await sincronizarPagoCuota(tx, cuotaId);
    return tx.gastoRecurrenteInstancia.findUnique({ where: { id: cuotaId }, include: INCLUDE_CUOTA });
  }).then(async (r) => {
    await registrarActividad(usuarioActual, { tipo: 'cuenta_fija', descripcion: `deshizo el pago de ${cuota.concepto.nombre}`, avisar: 'nadie' });
    return r;
  });
}
