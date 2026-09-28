import { prisma } from '../config/prisma.js';
import { calcularPeriodoActual, calcularPeriodoAnterior } from './cicloPersonal.js';

function sumarMontos(items) {
  return items.reduce((acc, i) => acc + i.monto, 0);
}

async function calcularIngresoPeriodo(usuarioId, rango) {
  const ingresos = await prisma.ingresoPersonal.findMany({
    where: { usuarioId, estado: 'recibido', fecha: { gte: rango.inicio, lte: rango.fin } },
  });
  return sumarMontos(ingresos);
}

async function calcularMontoGastado(limite, usuarioId, rango) {
  const where = { usuarioId, estado: 'pagado', fecha: { gte: rango.inicio, lte: rango.fin } };
  if (limite.tipoObjetivo === 'categoria') where.categoriaId = limite.categoriaId;
  else if (limite.tipoObjetivo === 'obligatorios') where.esObligatorio = true;
  else if (limite.tipoObjetivo === 'no_obligatorios') where.esObligatorio = false;

  const gastos = await prisma.gastoPersonal.findMany({ where });
  return sumarMontos(gastos);
}

function calcularLimiteMonto(limite, ingresoPeriodo) {
  return limite.reglaTipo === 'porcentaje' ? Math.round((ingresoPeriodo * limite.reglaValor) / 100) : limite.reglaValor;
}

async function calcularEvaluacion(limite, usuarioId, rango) {
  const [ingresoPeriodo, montoGastado] = await Promise.all([
    calcularIngresoPeriodo(usuarioId, rango),
    calcularMontoGastado(limite, usuarioId, rango),
  ]);
  const limiteCalculado = calcularLimiteMonto(limite, ingresoPeriodo);
  const disponibleRestante = limiteCalculado - montoGastado;
  const estado = montoGastado > limiteCalculado ? 'excedido' : 'dentro';

  return {
    periodoInicio: rango.inicio,
    periodoFin: rango.fin,
    reglaValorUsado: limite.reglaValor,
    limiteCalculado,
    montoGastado,
    disponibleRestante,
    estado,
  };
}

/** Período actual: siempre se recalcula en vivo, nunca se guarda. */
export async function obtenerEvaluacionActual(limite, usuarioId, frecuencia) {
  const rango = calcularPeriodoActual(frecuencia, new Date());
  return calcularEvaluacion(limite, usuarioId, rango);
}

/**
 * Período anterior: el único "pasado" alcanzable hoy (la navegación histórica
 * genérica es la Etapa 6). Se snapshotea la primera vez que se consulta, para
 * no reescribir el historial si el usuario cambia reglaValor más adelante.
 */
export async function obtenerEvaluacionAnterior(limite, usuarioId, frecuencia) {
  const rango = calcularPeriodoAnterior(frecuencia, new Date());

  const existente = await prisma.limiteEvaluadoPeriodo.findUnique({
    where: { limiteId_periodoInicio: { limiteId: limite.id, periodoInicio: rango.inicio } },
  });
  if (existente) return existente;

  const evaluacion = await calcularEvaluacion(limite, usuarioId, rango);
  return prisma.limiteEvaluadoPeriodo.create({
    data: { limiteId: limite.id, ...evaluacion },
  });
}
