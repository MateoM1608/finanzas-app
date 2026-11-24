import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { dividirEnCuotas, fechasDeCuotas, sugerirFechaPrimeraCuota } from '../../utils/cuotas.js';
import { evaluarPeriodoSiCorresponde } from '../../utils/evaluacionAhorro.js';
import { hoyUTC } from '../../utils/fechas.js';

/**
 * Compras a cuotas del panel personal: crean de una vez todas sus cuotas
 * como GastoPersonal (compraId + numeroCuota). Automáticas: cada cuota pasa
 * a `pagado` cuando llega su fecha (ver pagarCuotasAutomaticasVencidas);
 * manuales: quedan `pendiente` hasta que el usuario las marca.
 */

async function requireDelUsuario(modelo, usuarioId, id, mensaje) {
  if (!id) return null;
  const fila = await prisma[modelo].findUnique({ where: { id } });
  if (!fila || fila.usuarioId !== usuarioId) {
    throw new HttpError(400, mensaje);
  }
  return fila;
}

const INCLUDE_COMPRA = {
  metodoPago: true,
  categoria: true,
  cuotas: { select: { id: true, numeroCuota: true, monto: true, fecha: true, estado: true }, orderBy: { numeroCuota: 'asc' } },
};

export function listarCompras(usuarioActual) {
  return prisma.compraCuotasPersonal.findMany({
    where: { usuarioId: usuarioActual.id },
    include: INCLUDE_COMPRA,
    orderBy: { fechaPrimeraCuota: 'desc' },
  });
}

export async function sugerirPrimeraCuota(usuarioActual, { fechaCompra, metodoPagoId }) {
  const metodo = await requireDelUsuario('metodoPagoPersonal', usuarioActual.id, metodoPagoId, 'Método de pago no encontrado');
  return sugerirFechaPrimeraCuota(fechaCompra ?? hoyUTC(), metodo);
}

export async function crearCompra(usuarioActual, data) {
  const usuarioId = usuarioActual.id;
  await requireDelUsuario('metodoPagoPersonal', usuarioId, data.metodoPagoId, 'Método de pago no encontrado');
  await requireDelUsuario('categoriaPersonal', usuarioId, data.categoriaId, 'Categoría no encontrada');

  const hoy = hoyUTC();
  const montos = dividirEnCuotas(data.montoTotal, data.numeroCuotas);
  const fechas = fechasDeCuotas(data.fechaPrimeraCuota, data.numeroCuotas);

  const compra = await prisma.$transaction(async (tx) => {
    const nueva = await tx.compraCuotasPersonal.create({
      data: {
        usuarioId,
        descripcion: data.descripcion,
        montoTotal: data.montoTotal,
        numeroCuotas: data.numeroCuotas,
        fechaPrimeraCuota: fechas[0],
        modoCobro: data.modoCobro,
        metodoPagoId: data.metodoPagoId ?? null,
        categoriaId: data.categoriaId ?? null,
        esObligatorio: data.esObligatorio ?? true,
      },
    });
    await tx.gastoPersonal.createMany({
      data: fechas.map((fecha, i) => ({
        usuarioId,
        compraId: nueva.id,
        numeroCuota: i + 1,
        monto: montos[i],
        fecha,
        descripcion: data.descripcion,
        estado: data.modoCobro === 'automatico' && fecha <= hoy ? 'pagado' : 'pendiente',
        esObligatorio: data.esObligatorio ?? true,
        metodoPagoId: data.metodoPagoId ?? null,
        categoriaId: data.categoriaId ?? null,
        origen: 'app',
      })),
    });
    return tx.compraCuotasPersonal.findUnique({ where: { id: nueva.id }, include: INCLUDE_COMPRA });
  });

  // Una cuota obligatoria ya pagada puede completar los obligatorios de un período.
  if (compra.esObligatorio) {
    for (const cuota of compra.cuotas.filter((c) => c.estado === 'pagado')) {
      await evaluarPeriodoSiCorresponde(usuarioId, cuota.fecha);
    }
  }
  return compra;
}

/** Elimina la compra con todas sus cuotas, solo si ninguna está pagada todavía. */
export async function eliminarCompra(usuarioActual, compraId) {
  const compra = await prisma.compraCuotasPersonal.findUnique({ where: { id: compraId } });
  if (!compra || compra.usuarioId !== usuarioActual.id) {
    throw new HttpError(404, 'Compra no encontrada');
  }
  const pagadas = await prisma.gastoPersonal.count({ where: { compraId, estado: 'pagado' } });
  if (pagadas) {
    throw new HttpError(409, 'Esta compra ya tiene cuotas pagadas — no se puede eliminar');
  }
  await prisma.$transaction([
    prisma.gastoPersonal.deleteMany({ where: { compraId } }),
    prisma.compraCuotasPersonal.delete({ where: { id: compraId } }),
  ]);
}
