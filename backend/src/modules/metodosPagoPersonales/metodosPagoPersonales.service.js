import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';

async function requireMetodoDelUsuario(usuarioId, id) {
  const metodo = await prisma.metodoPagoPersonal.findUnique({ where: { id } });
  if (!metodo || metodo.usuarioId !== usuarioId) {
    throw new HttpError(404, 'Método de pago no encontrado');
  }
  return metodo;
}

export function listarMetodosPago(usuarioActual) {
  return prisma.metodoPagoPersonal.findMany({
    where: { usuarioId: usuarioActual.id },
    orderBy: { nombre: 'asc' },
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
