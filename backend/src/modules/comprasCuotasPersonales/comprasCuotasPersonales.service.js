import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { calcularCuotas, fechasDeCuotas, sugerirFechaPrimeraCuota, interesDeCompra } from '../../utils/cuotas.js';
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

/**
 * Crea las cuotas (GastoPersonal) de una compra con los datos dados. Si la
 * compra ya venía en curso, solo las que faltan: salen del plan completo de
 * la compra y se numeran desde la siguiente a las ya pagadas; la primera
 * fecha es la de la próxima cuota.
 */
async function generarCuotas(tx, compraId, usuarioId, datos) {
  const hoy = hoyUTC();
  const antes = datos.cuotasPagadasAntes ?? 0;
  const cuotas = calcularCuotas(datos.montoTotal, datos.numeroCuotas, datos.tasaMensual, datos.sistemaInteres).slice(antes);
  const fechas = fechasDeCuotas(datos.fechaPrimeraCuota, datos.numeroCuotas - antes);
  await tx.gastoPersonal.createMany({
    data: fechas.map((fecha, i) => ({
      usuarioId,
      compraId,
      numeroCuota: antes + i + 1,
      monto: cuotas[i].monto,
      capital: cuotas[i].capital,
      interes: cuotas[i].interes,
      fecha,
      descripcion: datos.descripcion,
      estado: datos.modoCobro === 'automatico' && fecha <= hoy ? 'pagado' : 'pendiente',
      esObligatorio: datos.esObligatorio,
      metodoPagoId: datos.metodoPagoId,
      categoriaId: datos.categoriaId,
      origen: 'app',
    })),
  });
  return fechas[0];
}

/** Una cuota obligatoria ya pagada puede completar los obligatorios de un período. */
async function evaluarCuotasPagadas(usuarioId, compra) {
  if (!compra.esObligatorio) return;
  for (const cuota of compra.cuotas.filter((c) => c.estado === 'pagado')) {
    await evaluarPeriodoSiCorresponde(usuarioId, cuota.fecha);
  }
}

export async function crearCompra(usuarioActual, data) {
  const usuarioId = usuarioActual.id;
  const metodo = await requireDelUsuario('metodoPagoPersonal', usuarioId, data.metodoPagoId, 'Método de pago no encontrado');
  await requireDelUsuario('categoriaPersonal', usuarioId, data.categoriaId, 'Categoría no encontrada');
  const interes = interesDeCompra(data, metodo);

  const datos = {
    descripcion: data.descripcion,
    montoTotal: data.montoTotal,
    numeroCuotas: data.numeroCuotas,
    fechaPrimeraCuota: data.fechaPrimeraCuota,
    modoCobro: data.modoCobro,
    tasaMensual: interes.tasaMensual,
    sistemaInteres: interes.sistemaInteres,
    metodoPagoId: data.metodoPagoId ?? null,
    categoriaId: data.categoriaId ?? null,
    esObligatorio: data.esObligatorio ?? true,
    cuotasPagadasAntes: data.cuotasPagadasAntes ?? 0,
  };
  const compra = await prisma.$transaction(async (tx) => {
    const nueva = await tx.compraCuotasPersonal.create({ data: { usuarioId, ...datos } });
    const primera = await generarCuotas(tx, nueva.id, usuarioId, datos);
    await tx.compraCuotasPersonal.update({ where: { id: nueva.id }, data: { fechaPrimeraCuota: primera } });
    return tx.compraCuotasPersonal.findUnique({ where: { id: nueva.id }, include: INCLUDE_COMPRA });
  }, { timeout: 120000, maxWait: 20000 });
  await evaluarCuotasPagadas(usuarioId, compra);
  return compra;
}

const CAMPOS_ESTRUCTURALES = ['montoTotal', 'numeroCuotas', 'fechaPrimeraCuota', 'modoCobro', 'tasaMensual', 'sistemaInteres', 'cuotasPagadasAntes'];

/**
 * Edita una compra. Descripción, categoría, método y obligatorio se pueden
 * cambiar siempre (se aplican a todas sus cuotas). Cambiar monto, número de
 * cuotas, primera cuota o modo de cobro recalcula TODAS las cuotas; no se
 * permite si alguna cuota manual ya se marcó pagada (perdería ese pago). Las
 * automáticas se recalculan solas según su fecha.
 */
export async function actualizarCompra(usuarioActual, compraId, data) {
  const usuarioId = usuarioActual.id;
  const actual = await prisma.compraCuotasPersonal.findUnique({ where: { id: compraId } });
  if (!actual || actual.usuarioId !== usuarioId) {
    throw new HttpError(404, 'Compra no encontrada');
  }
  if (data.metodoPagoId !== undefined) {
    await requireDelUsuario('metodoPagoPersonal', usuarioId, data.metodoPagoId, 'Método de pago no encontrado');
  }
  if (data.categoriaId !== undefined) {
    await requireDelUsuario('categoriaPersonal', usuarioId, data.categoriaId, 'Categoría no encontrada');
  }

  const datos = {
    descripcion: data.descripcion ?? actual.descripcion,
    montoTotal: data.montoTotal ?? actual.montoTotal,
    numeroCuotas: data.numeroCuotas ?? actual.numeroCuotas,
    fechaPrimeraCuota: data.fechaPrimeraCuota ?? actual.fechaPrimeraCuota,
    modoCobro: data.modoCobro ?? actual.modoCobro,
    tasaMensual: data.tasaMensual ?? actual.tasaMensual,
    sistemaInteres: data.sistemaInteres ?? actual.sistemaInteres,
    metodoPagoId: data.metodoPagoId === undefined ? actual.metodoPagoId : data.metodoPagoId,
    categoriaId: data.categoriaId === undefined ? actual.categoriaId : data.categoriaId,
    esObligatorio: data.esObligatorio ?? actual.esObligatorio,
    cuotasPagadasAntes: data.cuotasPagadasAntes ?? actual.cuotasPagadasAntes,
  };
  if (datos.cuotasPagadasAntes >= datos.numeroCuotas) {
    throw new HttpError(400, 'Las cuotas ya pagadas deben ser menos que el total de cuotas');
  }
  const cambiaEstructura = CAMPOS_ESTRUCTURALES.some((campo) =>
    campo === 'fechaPrimeraCuota'
      ? new Date(datos[campo]).getTime() !== new Date(actual[campo]).getTime()
      : datos[campo] !== actual[campo],
  );

  if (cambiaEstructura && actual.modoCobro === 'manual') {
    const pagadas = await prisma.gastoPersonal.count({ where: { compraId, estado: 'pagado' } });
    if (pagadas) {
      throw new HttpError(
        409,
        'Ya marcaste cuotas de esta compra como pagadas: solo puedes cambiar la descripción, categoría, método u obligatorio',
      );
    }
  }

  const compra = await prisma.$transaction(async (tx) => {
    if (cambiaEstructura) {
      await tx.gastoPersonal.deleteMany({ where: { compraId } });
      datos.fechaPrimeraCuota = await generarCuotas(tx, compraId, usuarioId, datos);
    } else {
      await tx.gastoPersonal.updateMany({
        where: { compraId },
        data: {
          descripcion: datos.descripcion,
          metodoPagoId: datos.metodoPagoId,
          categoriaId: datos.categoriaId,
          esObligatorio: datos.esObligatorio,
        },
      });
    }
    await tx.compraCuotasPersonal.update({ where: { id: compraId }, data: datos });
    return tx.compraCuotasPersonal.findUnique({ where: { id: compraId }, include: INCLUDE_COMPRA });
  }, { timeout: 120000, maxWait: 20000 });
  await evaluarCuotasPagadas(usuarioId, compra);
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
