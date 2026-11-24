import { prisma } from '../config/prisma.js';
import { calcularPeriodoActual, calcularPeriodoAnterior } from './cicloPersonal.js';
import { hoyUTC } from './fechas.js';
import { gastosDeConsumo, ingresosReales } from './consumo.js';

function sumarMontos(items) {
  return items.reduce((acc, i) => acc + i.monto, 0);
}

// Límites miden CONSUMO (ver utils/consumo.js): la parte del usuario en el
// hogar cuenta como obligatoria; los reintegros de cuadres no son ingreso.
async function calcularIngresoPeriodo(usuarioId, rango) {
  return sumarMontos(await ingresosReales(usuarioId, rango));
}

async function calcularMontoGastado(limite, usuarioId, rango) {
  const gastos = await gastosDeConsumo(usuarioId, rango);
  const filtrados = gastos.filter((g) => {
    if (limite.tipoObjetivo === 'categoria') return g.categoriaId === limite.categoriaId;
    if (limite.tipoObjetivo === 'obligatorios') return g.esObligatorio;
    if (limite.tipoObjetivo === 'no_obligatorios') return !g.esObligatorio;
    return true;
  });
  return sumarMontos(filtrados);
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
  const rango = calcularPeriodoActual(frecuencia, hoyUTC());
  return calcularEvaluacion(limite, usuarioId, rango);
}

/**
 * Período anterior: el único "pasado" alcanzable hoy (la navegación histórica
 * genérica es la Etapa 6). Se snapshotea la primera vez que se consulta, para
 * no reescribir el historial si el usuario cambia reglaValor más adelante.
 */
export async function obtenerEvaluacionAnterior(limite, usuarioId, frecuencia) {
  const rango = calcularPeriodoAnterior(frecuencia, hoyUTC());

  const existente = await prisma.limiteEvaluadoPeriodo.findUnique({
    where: { limiteId_periodoInicio: { limiteId: limite.id, periodoInicio: rango.inicio } },
  });
  if (existente) return existente;

  const evaluacion = await calcularEvaluacion(limite, usuarioId, rango);
  try {
    return await prisma.limiteEvaluadoPeriodo.create({
      data: { limiteId: limite.id, ...evaluacion },
    });
  } catch (error) {
    // Otra consulta en paralelo ya guardó el snapshot de este período.
    if (error?.code !== 'P2002') throw error;
    return prisma.limiteEvaluadoPeriodo.findUnique({
      where: { limiteId_periodoInicio: { limiteId: limite.id, periodoInicio: rango.inicio } },
    });
  }
}
