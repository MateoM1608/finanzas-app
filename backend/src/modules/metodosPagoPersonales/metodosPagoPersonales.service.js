import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';

async function requireMetodoDelUsuario(usuarioId, id) {
  const metodo = await prisma.metodoPagoPersonal.findUnique({ where: { id } });
  if (!metodo || metodo.usuarioId !== usuarioId) {
    throw new HttpError(404, 'Método de pago no encontrado');
  }
  return metodo;
}

/**
 * Deuda de cada tarjeta de crédito = lo que se ha cargado (gastos pagados con
 * ella: compras, cuotas, pagos del hogar) − los pagos registrados a la
 * tarjeta. Las compras con tarjeta no bajan el Disponible hasta pagarla.
 */
export async function calcularDeudaTarjetas(usuarioId) {
  const [cargos, pagos] = await Promise.all([
    prisma.gastoPersonal.groupBy({
      by: ['metodoPagoId'],
      where: { usuarioId, estado: 'pagado', metodoPago: { tipo: 'tarjeta_credito' } },
      _sum: { monto: true },
    }),
    prisma.gastoPersonal.groupBy({
      by: ['tarjetaPagadaId'],
      where: { usuarioId, estado: 'pagado', origen: 'pago_tarjeta', tarjetaPagadaId: { not: null } },
      _sum: { monto: true },
    }),
  ]);
  const deuda = new Map();
  for (const c of cargos) deuda.set(c.metodoPagoId, (deuda.get(c.metodoPagoId) ?? 0) + (c._sum.monto ?? 0));
  for (const p of pagos) deuda.set(p.tarjetaPagadaId, (deuda.get(p.tarjetaPagadaId) ?? 0) - (p._sum.monto ?? 0));
  return deuda;
}

export async function listarMetodosPago(usuarioActual) {
  const [metodos, deuda] = await Promise.all([
    prisma.metodoPagoPersonal.findMany({ where: { usuarioId: usuarioActual.id }, orderBy: { nombre: 'asc' } }),
    calcularDeudaTarjetas(usuarioActual.id),
  ]);
  return metodos.map((m) => (m.tipo === 'tarjeta_credito' ? { ...m, deuda: deuda.get(m.id) ?? 0 } : m));
}

/**
 * Registra el pago de una tarjeta de crédito: un movimiento (origen
 * pago_tarjeta) que SÍ baja el Disponible, desde la cuenta con que se pagó.
 * No es consumo (las compras ya contaron al hacerse).
 */
export async function registrarPagoTarjeta(usuarioActual, tarjetaId, data) {
  const tarjeta = await requireMetodoDelUsuario(usuarioActual.id, tarjetaId);
  if (tarjeta.tipo !== 'tarjeta_credito') {
    throw new HttpError(400, 'Solo se registran pagos de una tarjeta de crédito');
  }
  if (data.metodoPagoId) {
    const desde = await requireMetodoDelUsuario(usuarioActual.id, data.metodoPagoId);
    if (desde.tipo === 'tarjeta_credito') {
      throw new HttpError(400, 'Una tarjeta de crédito no se paga con otra tarjeta de crédito');
    }
  }
  return prisma.gastoPersonal.create({
    data: {
      usuarioId: usuarioActual.id,
      monto: data.monto,
      fecha: data.fecha,
      descripcion: `Pago de ${tarjeta.nombre}`,
      estado: 'pagado',
      esObligatorio: false,
      metodoPagoId: data.metodoPagoId ?? null,
      tarjetaPagadaId: tarjetaId,
      origen: 'pago_tarjeta',
    },
  });
}

/**
 * Los datos de tarjeta (corte, pago, cupo, últimos 4) solo aplican a tarjeta
 * de crédito y crédito de almacén; para los demás tipos se limpian.
 */
function datosMetodo(data, actual = {}) {
  const tipo = data.tipo ?? actual.tipo ?? 'otro';
  const esCredito = tipo === 'tarjeta_credito' || tipo === 'credito_almacen';
  const valor = (campo) => (data[campo] === undefined ? (actual[campo] ?? null) : data[campo]);
  return {
    nombre: data.nombre ?? actual.nombre,
    tipo,
    ultimos4: tipo === 'tarjeta_credito' || tipo === 'debito' ? valor('ultimos4') : null,
    diaCorte: tipo === 'tarjeta_credito' ? valor('diaCorte') : null,
    diaPago: esCredito ? valor('diaPago') : null,
    cupo: esCredito ? valor('cupo') : null,
    tasaMensual: esCredito ? (data.tasaMensual ?? actual.tasaMensual ?? 0) : 0,
    sistemaInteres: data.sistemaInteres ?? actual.sistemaInteres ?? 'capital_fijo',
  };
}

export function crearMetodoPago(usuarioActual, data) {
  return prisma.metodoPagoPersonal.create({
    data: { usuarioId: usuarioActual.id, ...datosMetodo(data) },
  });
}

export async function actualizarMetodoPago(usuarioActual, id, data) {
  const actual = await requireMetodoDelUsuario(usuarioActual.id, id);
  return prisma.metodoPagoPersonal.update({ where: { id }, data: datosMetodo(data, actual) });
}

export async function eliminarMetodoPago(usuarioActual, id) {
  await requireMetodoDelUsuario(usuarioActual.id, id);

  const [gastos, ingresos, gastosFijos, compras, comprasHogar] = await Promise.all([
    prisma.gastoPersonal.count({ where: { metodoPagoId: id } }),
    prisma.ingresoPersonal.count({ where: { metodoPagoId: id } }),
    prisma.gastoFijoConfig.count({ where: { metodoPagoIdDefault: id } }),
    prisma.compraCuotasPersonal.count({ where: { metodoPagoId: id } }),
    prisma.compraCuotasHogar.count({ where: { metodoPagoId: id } }),
  ]);
  if (gastos || ingresos || gastosFijos || compras || comprasHogar) {
    throw new HttpError(409, 'Este método de pago ya está en uso — no se puede eliminar');
  }

  await prisma.metodoPagoPersonal.delete({ where: { id } });
}
