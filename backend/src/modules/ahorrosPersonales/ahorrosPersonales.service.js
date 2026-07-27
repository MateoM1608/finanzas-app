import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { calcularPeriodoActual, dentroDelRango } from '../../utils/cicloPersonal.js';
import { evaluarPeriodoSiCorresponde } from '../../utils/evaluacionAhorro.js';

const PERIODOS_VENTANA = 6;

function sumarMontos(items) {
  return items.reduce((acc, i) => acc + i.monto, 0);
}

async function requireAhorroDelUsuario(usuarioId, id) {
  const ahorro = await prisma.ahorroPersonal.findUnique({ where: { id } });
  if (!ahorro || ahorro.usuarioId !== usuarioId) {
    throw new HttpError(404, 'Meta de ahorro no encontrada');
  }
  return ahorro;
}

export function listarAhorros(usuarioActual) {
  return prisma.ahorroPersonal.findMany({
    where: { usuarioId: usuarioActual.id },
    include: { categoria: true },
    orderBy: { creadoEn: 'asc' },
  });
}

export function crearAhorro(usuarioActual, data) {
  return prisma.ahorroPersonal.create({
    data: { ...data, usuarioId: usuarioActual.id },
  });
}

export async function actualizarAhorro(usuarioActual, id, data) {
  await requireAhorroDelUsuario(usuarioActual.id, id);
  return prisma.ahorroPersonal.update({ where: { id }, data });
}

export async function eliminarAhorro(usuarioActual, id) {
  await requireAhorroDelUsuario(usuarioActual.id, id);

  const [transacciones, pronosticos] = await Promise.all([
    prisma.ahorroTransaccion.count({ where: { ahorroId: id } }),
    prisma.ahorroPronostico.count({ where: { ahorroId: id } }),
  ]);
  if (transacciones || pronosticos) {
    throw new HttpError(
      409,
      'Esta meta ya tiene aportes o pronósticos registrados — desactívala en vez de eliminarla, para no perder ese historial',
    );
  }

  await prisma.ahorroPersonal.delete({ where: { id } });
}

export async function registrarAporte(usuarioActual, ahorroId, data) {
  await requireAhorroDelUsuario(usuarioActual.id, ahorroId);
  return prisma.ahorroTransaccion.create({
    data: {
      ahorroId,
      monto: data.monto,
      fecha: data.fecha ?? new Date(),
      origen: 'manual',
    },
  });
}

/**
 * Resumen para la sección "Ahorros" de Panel personal: evalúa primero el
 * período actual de forma perezosa (por si ya cumple la condición y nadie lo
 * disparó pagando un gasto obligatorio), y arma el semáforo de cada meta
 * activa contra sus últimos períodos evaluados. `montoAhorradoReal` se
 * calcula en vivo sumando AhorroTransaccion dentro del rango de cada
 * período — no se guarda como columna, para no tener que mantenerlo
 * sincronizado a mano cada vez que entra un aporte nuevo.
 */
export async function obtenerResumenAhorros(usuarioActual) {
  const usuarioId = usuarioActual.id;
  await evaluarPeriodoSiCorresponde(usuarioId, new Date());

  const ahorros = await prisma.ahorroPersonal.findMany({
    where: { usuarioId },
    include: {
      categoria: true,
      transacciones: true,
      pronosticos: {
        include: { periodo: true },
        orderBy: { periodo: { periodoInicio: 'desc' } },
        take: PERIODOS_VENTANA,
      },
    },
    orderBy: { creadoEn: 'asc' },
  });

  const metas = ahorros.map((ahorro) => {
    const totalAhorrado = sumarMontos(ahorro.transacciones);

    const periodos = ahorro.pronosticos.map((p) => {
      const rango = { inicio: p.periodo.periodoInicio, fin: p.periodo.periodoFin };
      const montoAhorradoReal = sumarMontos(ahorro.transacciones.filter((t) => dentroDelRango(t.fecha, rango)));
      const estado =
        montoAhorradoReal < p.montoSugerido ? 'amarillo' : montoAhorradoReal === p.montoSugerido ? 'azul' : 'verde';

      return {
        periodoInicio: p.periodo.periodoInicio,
        periodoFin: p.periodo.periodoFin,
        montoSugerido: p.montoSugerido,
        montoAhorradoReal,
        estado,
      };
    });

    return {
      id: ahorro.id,
      nombre: ahorro.nombre,
      montoMetaTotal: ahorro.montoMetaTotal,
      reglaTipo: ahorro.reglaTipo,
      reglaValor: ahorro.reglaValor,
      baseCalculo: ahorro.baseCalculo,
      modoTransaccion: ahorro.modoTransaccion,
      categoria: ahorro.categoria?.nombre ?? null,
      activo: ahorro.activo,
      totalAhorrado,
      progresoPct: ahorro.montoMetaTotal ? (totalAhorrado / ahorro.montoMetaTotal) * 100 : null,
      periodos,
    };
  });

  const totalAhorradoAcumulado = sumarMontos(
    ahorros.filter((a) => a.activo).flatMap((a) => a.transacciones),
  );

  const frecuencia = usuarioActual.frecuenciaCicloPersonal;
  const periodoActualRango = calcularPeriodoActual(frecuencia, new Date());
  const periodoActualEvaluado = await prisma.periodoAhorroEvaluado.findUnique({
    where: { usuarioId_periodoInicio: { usuarioId, periodoInicio: periodoActualRango.inicio } },
  });

  let alertaSobregasto = false;
  if (periodoActualEvaluado) {
    const pronosticosActuales = await prisma.ahorroPronostico.findMany({
      where: { periodoId: periodoActualEvaluado.id, ahorro: { activo: true } },
    });
    const sumaPronosticos = sumarMontos(pronosticosActuales.map((p) => ({ monto: p.montoSugerido })));
    alertaSobregasto =
      periodoActualEvaluado.gastosNoObligatoriosPeriodo + sumaPronosticos > periodoActualEvaluado.baseCalculoAhorro;
  }

  return { totalAhorradoAcumulado, metas, alertaSobregasto };
}
