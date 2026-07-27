import { prisma } from '../config/prisma.js';
import { calcularPeriodoActual } from './cicloPersonal.js';

function sumarMontos(items) {
  return items.reduce((acc, i) => acc + i.monto, 0);
}

function calcularMontoSugerido(ahorro, baseCalculoAhorro, gastosNoObligatoriosPeriodo) {
  const base =
    ahorro.baseCalculo === 'disponible_total'
      ? baseCalculoAhorro - gastosNoObligatoriosPeriodo
      : baseCalculoAhorro;

  return ahorro.reglaTipo === 'porcentaje' ? Math.round((base * ahorro.reglaValor) / 100) : ahorro.reglaValor;
}

/**
 * Evalúa el período (según Usuario.frecuenciaCicloPersonal) que contiene
 * `fecha`, si todavía no se había evaluado y si todos los gastos obligatorios
 * de ese rango ya están pagados (ver Modulo_Panel_Personal_Ajustes.md,
 * sección 6.4). Se llama tanto al pagar un gasto obligatorio como, de forma
 * perezosa, cada vez que se consulta el resumen de Ahorros — no hay cron en
 * esta app, así que un período que ya cumple la condición pero que nadie
 * "disparó" pagando algo (ej. ya todo estaba pagado de antes) igual se evalúa
 * la próxima vez que alguien abre Ahorros.
 *
 * Idempotente: si el período ya fue evaluado, no hace nada y devuelve null.
 */
export async function evaluarPeriodoSiCorresponde(usuarioId, fecha) {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  const periodo = calcularPeriodoActual(usuario.frecuenciaCicloPersonal, fecha);

  const yaEvaluado = await prisma.periodoAhorroEvaluado.findUnique({
    where: { usuarioId_periodoInicio: { usuarioId, periodoInicio: periodo.inicio } },
  });
  if (yaEvaluado) return null;

  const rango = { gte: periodo.inicio, lte: periodo.fin };

  const obligatoriosPendientes = await prisma.gastoPersonal.count({
    where: { usuarioId, esObligatorio: true, estado: 'pendiente', fecha: rango },
  });
  if (obligatoriosPendientes > 0) return null;

  const [ingresos, gastosObligatorios, gastosNoObligatorios] = await Promise.all([
    prisma.ingresoPersonal.findMany({ where: { usuarioId, estado: 'recibido', fecha: rango } }),
    prisma.gastoPersonal.findMany({ where: { usuarioId, esObligatorio: true, estado: 'pagado', fecha: rango } }),
    prisma.gastoPersonal.findMany({ where: { usuarioId, esObligatorio: false, estado: 'pagado', fecha: rango } }),
  ]);

  const ingresoPeriodo = sumarMontos(ingresos);
  const gastosObligatoriosPeriodo = sumarMontos(gastosObligatorios);
  const gastosNoObligatoriosPeriodo = sumarMontos(gastosNoObligatorios);
  const baseCalculoAhorro = ingresoPeriodo - gastosObligatoriosPeriodo;

  const ahorrosActivos = await prisma.ahorroPersonal.findMany({ where: { usuarioId, activo: true } });

  return prisma.$transaction(async (tx) => {
    const periodoEvaluado = await tx.periodoAhorroEvaluado.create({
      data: {
        usuarioId,
        periodoInicio: periodo.inicio,
        periodoFin: periodo.fin,
        ingresoPeriodo,
        gastosObligatoriosPeriodo,
        gastosNoObligatoriosPeriodo,
        baseCalculoAhorro,
      },
    });

    for (const ahorro of ahorrosActivos) {
      const montoSugerido = calcularMontoSugerido(ahorro, baseCalculoAhorro, gastosNoObligatoriosPeriodo);

      await tx.ahorroPronostico.create({
        data: { ahorroId: ahorro.id, periodoId: periodoEvaluado.id, montoSugerido },
      });

      if (ahorro.modoTransaccion === 'automatico' && montoSugerido > 0) {
        await tx.ahorroTransaccion.create({
          data: { ahorroId: ahorro.id, monto: montoSugerido, fecha: new Date(), origen: 'automatico' },
        });
      }
    }

    return periodoEvaluado;
  });
}
