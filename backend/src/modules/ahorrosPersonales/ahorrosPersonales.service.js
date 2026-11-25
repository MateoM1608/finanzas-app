import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { calcularPeriodoActual, calcularPeriodoAnterior, calcularPeriodoPorIndice, dentroDelRango } from '../../utils/cicloPersonal.js';
import { evaluarPeriodoSiCorresponde } from '../../utils/evaluacionAhorro.js';
import { hoyUTC } from '../../utils/fechas.js';

const PERIODOS_VENTANA = 6;

// Semáforo: amarillo (por debajo del pronóstico), azul (justo), verde (por encima).
function estadoSemaforo(ahorrado, sugerido) {
  return ahorrado < sugerido ? 'amarillo' : ahorrado === sugerido ? 'azul' : 'verde';
}

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
      fecha: data.fecha ?? hoyUTC(),
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
 *
 * `indiceCiclo` (Etapa 6): 0 = el actual, -1 = el anterior… Cada meta trae
 * `cicloConsultado` (su pronóstico de ese ciclo si se evaluó, y lo aportado
 * en él) y, en un ciclo pasado, el total ahorrado al cierre; las metas
 * creadas después de ese ciclo no aparecen.
 */
export async function obtenerResumenAhorros(usuarioActual, indiceCiclo = 0) {
  const usuarioId = usuarioActual.id;
  const rangoCiclo = calcularPeriodoPorIndice(usuarioActual.frecuenciaCicloPersonal, indiceCiclo);
  const esActual = indiceCiclo === 0;
  const finDelDia = new Date(rangoCiclo.fin.getTime() + 24 * 60 * 60 * 1000);
  // El anterior primero: un período sin obligatorios solo se evalúa una vez
  // terminado, y sin esto nadie lo dispararía (no hay cron).
  await evaluarPeriodoSiCorresponde(
    usuarioId,
    calcularPeriodoAnterior(usuarioActual.frecuenciaCicloPersonal, hoyUTC()).inicio,
  );
  await evaluarPeriodoSiCorresponde(usuarioId, hoyUTC());

  const ahorros = await prisma.ahorroPersonal.findMany({
    where: { usuarioId, ...(esActual ? {} : { creadoEn: { lt: finDelDia } }) },
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

  // Pronóstico de cada meta para el ciclo consultado (si ese período se evaluó).
  const pronosticosCiclo = await prisma.ahorroPronostico.findMany({
    where: { periodo: { usuarioId, periodoInicio: rangoCiclo.inicio } },
  });
  const pronosticoDe = new Map(pronosticosCiclo.map((p) => [p.ahorroId, p]));

  const metas = ahorros.map((ahorro) => {
    const transacciones = esActual ? ahorro.transacciones : ahorro.transacciones.filter((t) => new Date(t.fecha) <= rangoCiclo.fin);
    const totalAhorrado = sumarMontos(transacciones);
    const aportadoCiclo = sumarMontos(ahorro.transacciones.filter((t) => dentroDelRango(t.fecha, rangoCiclo)));
    const pronostico = pronosticoDe.get(ahorro.id) ?? null;

    const periodos = ahorro.pronosticos.map((p) => {
      const rango = { inicio: p.periodo.periodoInicio, fin: p.periodo.periodoFin };
      const montoAhorradoReal = sumarMontos(ahorro.transacciones.filter((t) => dentroDelRango(t.fecha, rango)));
      const estado = estadoSemaforo(montoAhorradoReal, p.montoSugerido);

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
      cicloConsultado: {
        montoAhorradoReal: aportadoCiclo,
        montoSugerido: pronostico?.montoSugerido ?? null,
        estado: pronostico ? estadoSemaforo(aportadoCiclo, pronostico.montoSugerido) : null,
      },
    };
  });

  const totalAhorradoAcumulado = sumarMontos(
    ahorros
      .filter((a) => a.activo)
      .flatMap((a) => a.transacciones)
      .filter((t) => esActual || new Date(t.fecha) <= rangoCiclo.fin),
  );
  const ciclo = { indice: indiceCiclo, inicio: rangoCiclo.inicio, fin: rangoCiclo.fin };
  if (!esActual) return { ciclo, totalAhorradoAcumulado, metas, alertaSobregasto: false };

  const frecuencia = usuarioActual.frecuenciaCicloPersonal;
  const periodoActualRango = calcularPeriodoActual(frecuencia, hoyUTC());
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

  return { ciclo, totalAhorradoAcumulado, metas, alertaSobregasto };
}
