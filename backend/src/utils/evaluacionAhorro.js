import { prisma } from '../config/prisma.js';
import { calcularPeriodoActual } from './cicloPersonal.js';
import { calcularFechasPendientes } from './instanciasFijas.js';
import { asegurarInstanciasFijasPersonales } from './instanciasFijasPersonales.js';
import { hoyUTC } from './fechas.js';
import { gastosDeConsumo, ingresosReales, ORIGENES_NO_CONSUMO } from './consumo.js';

function sumarMontos(items) {
  return items.reduce((acc, i) => acc + i.monto, 0);
}

/**
 * ¿Algún gasto fijo obligatorio activo tiene todavía una ocurrencia dentro
 * del período que aún no se generó (fecha posterior a hoy)? Las ocurrencias
 * fijas se generan perezosamente solo hasta hoy, así que sin esto un período
 * recién empezado "no tenía obligatorios pendientes" y se evaluaba antes de
 * tiempo — con el ingreso del mes todavía sin recibir.
 */
async function hayObligatoriosFijosPorVenir(usuarioId, periodo, hoy) {
  if (periodo.fin <= hoy) return false;
  const configs = await prisma.gastoFijoConfig.findMany({
    where: { usuarioId, activo: true, esObligatorio: true },
  });
  return configs.some((config) =>
    calcularFechasPendientes(config.fechaInicio, config.frecuencia, periodo.fin).some(
      (f) => f > hoy && f >= periodo.inicio,
    ),
  );
}

function esViolacionDeUnico(error) {
  return error?.code === 'P2002';
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
  const hoy = hoyUTC();

  const yaEvaluado = await prisma.periodoAhorroEvaluado.findUnique({
    where: { usuarioId_periodoInicio: { usuarioId, periodoInicio: periodo.inicio } },
  });
  if (yaEvaluado) return null;

  // Los fijos tienen que existir antes de contar pendientes y sumar montos.
  await asegurarInstanciasFijasPersonales(usuarioId);
  if (await hayObligatoriosFijosPorVenir(usuarioId, periodo, hoy)) return null;

  const rango = { gte: periodo.inicio, lte: periodo.fin };

  const obligatoriosPendientes = await prisma.gastoPersonal.count({
    where: { usuarioId, esObligatorio: true, estado: 'pendiente', fecha: rango, origen: { notIn: ORIGENES_NO_CONSUMO } },
  });
  if (obligatoriosPendientes > 0) return null;

  // Un período EN CURSO sin ningún obligatorio cumple "todos pagados" desde el
  // primer día: se evaluaba en la primera visita al panel, con el ingreso del
  // período todavía sin recibir, y quedaba guardado en $0 para siempre. En
  // curso solo se evalúa si hay al menos un obligatorio (y todos pagados); un
  // período ya terminado se evalúa siempre (sin pendientes), con lo que de
  // verdad entró y salió en él.
  // Consumo del período (su parte del hogar cuenta como obligatoria) e
  // ingresos reales (sin reintegros de cuadres) — ver utils/consumo.js.
  const [ingresos, consumo] = await Promise.all([ingresosReales(usuarioId, rango), gastosDeConsumo(usuarioId, rango)]);
  const gastosObligatorios = consumo.filter((g) => g.esObligatorio);
  const gastosNoObligatorios = consumo.filter((g) => !g.esObligatorio);

  const periodoTerminado = periodo.fin < hoy;
  if (!periodoTerminado && gastosObligatorios.length === 0) return null;

  const ingresoPeriodo = sumarMontos(ingresos);
  const gastosObligatoriosPeriodo = sumarMontos(gastosObligatorios);
  const gastosNoObligatoriosPeriodo = sumarMontos(gastosNoObligatorios);
  const baseCalculoAhorro = ingresoPeriodo - gastosObligatoriosPeriodo;

  // Solo metas que ya existían durante el período: al evaluar uno pasado (el
  // anterior, o el script de recálculo) no se le aplica — ni se le debita —
  // una meta creada después de que terminó.
  const finDelPeriodo = new Date(periodo.fin.getTime() + 24 * 60 * 60 * 1000);
  const ahorrosActivos = await prisma.ahorroPersonal.findMany({
    where: { usuarioId, activo: true, creadoEn: { lt: finDelPeriodo } },
  });

  // El débito automático pertenece al período evaluado: si se evalúa uno ya
  // terminado (ej. se pagó tarde un obligatorio del mes pasado), cae en su
  // último día y no en el período en curso.
  const fechaDebito = periodo.fin < hoy ? periodo.fin : hoy;

  try {
    return await prisma.$transaction(async (tx) => {
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
            data: { ahorroId: ahorro.id, monto: montoSugerido, fecha: fechaDebito, origen: 'automatico' },
          });
        }
      }

      return periodoEvaluado;
    });
  } catch (error) {
    // Dos consultas en paralelo evaluando el mismo período: la segunda choca
    // con el único (usuarioId, periodoInicio) y no tiene nada que hacer.
    if (esViolacionDeUnico(error)) return null;
    throw error;
  }
}
