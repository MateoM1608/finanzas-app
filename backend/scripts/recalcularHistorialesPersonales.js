/**
 * Limpia y recalcula los historiales de Ahorros y Límites que quedaron mal
 * guardados por la carrera al cargar el panel personal (se evaluaban antes de
 * generar los gastos/ingresos fijos del período, y el snapshot se guardaba
 * incompleto).
 *
 * Qué hace, por cada usuario:
 *   1. Borra LimiteEvaluadoPeriodo — el snapshot del período anterior se
 *      vuelve a guardar solo, bien calculado, la próxima vez que se abre el
 *      panel.
 *   2. Borra AhorroPronostico, PeriodoAhorroEvaluado y las AhorroTransaccion
 *      de origen `automatico` (salieron de esas evaluaciones). Los aportes
 *      manuales NO se tocan.
 *   3. Asegura sus fijos y re-evalúa Ahorros período por período, desde su
 *      primer movimiento hasta hoy, con la lógica corregida.
 *
 * Uso (desde backend/):
 *   node scripts/recalcularHistorialesPersonales.js            → solo muestra qué haría
 *   node scripts/recalcularHistorialesPersonales.js --aplicar  → lo hace
 */
import 'dotenv/config';
import { prisma } from '../src/config/prisma.js';
import { calcularPeriodoActual } from '../src/utils/cicloPersonal.js';
import { evaluarPeriodoSiCorresponde } from '../src/utils/evaluacionAhorro.js';
import { asegurarInstanciasFijasPersonales } from '../src/utils/instanciasFijasPersonales.js';
import { hoyUTC } from '../src/utils/fechas.js';

const aplicar = process.argv.includes('--aplicar');

async function primerMovimiento(usuarioId) {
  const [gasto, ingreso] = await Promise.all([
    prisma.gastoPersonal.findFirst({ where: { usuarioId }, orderBy: { fecha: 'asc' }, select: { fecha: true } }),
    prisma.ingresoPersonal.findFirst({ where: { usuarioId }, orderBy: { fecha: 'asc' }, select: { fecha: true } }),
  ]);
  const fechas = [gasto?.fecha, ingreso?.fecha].filter(Boolean);
  return fechas.length ? new Date(Math.min(...fechas.map((f) => f.getTime()))) : null;
}

async function main() {
  const usuarios = await prisma.usuario.findMany({ select: { id: true, nombre: true, frecuenciaCicloPersonal: true } });
  const hoy = hoyUTC();

  for (const usuario of usuarios) {
    const ahorroIds = (await prisma.ahorroPersonal.findMany({ where: { usuarioId: usuario.id }, select: { id: true } })).map(
      (a) => a.id,
    );
    const limiteIds = (
      await prisma.limiteAlertaPersonal.findMany({ where: { usuarioId: usuario.id }, select: { id: true } })
    ).map((l) => l.id);

    const [limitesEvaluados, periodosAhorro, debitosAutomaticos] = await Promise.all([
      prisma.limiteEvaluadoPeriodo.count({ where: { limiteId: { in: limiteIds } } }),
      prisma.periodoAhorroEvaluado.count({ where: { usuarioId: usuario.id } }),
      prisma.ahorroTransaccion.count({ where: { ahorroId: { in: ahorroIds }, origen: 'automatico' } }),
    ]);

    console.log(
      `${usuario.nombre}: ${limitesEvaluados} snapshots de límites, ${periodosAhorro} períodos de ahorro evaluados, ` +
        `${debitosAutomaticos} débitos automáticos`,
    );
    if (!aplicar) continue;

    await prisma.$transaction([
      prisma.limiteEvaluadoPeriodo.deleteMany({ where: { limiteId: { in: limiteIds } } }),
      prisma.ahorroPronostico.deleteMany({ where: { ahorroId: { in: ahorroIds } } }),
      prisma.periodoAhorroEvaluado.deleteMany({ where: { usuarioId: usuario.id } }),
      prisma.ahorroTransaccion.deleteMany({ where: { ahorroId: { in: ahorroIds }, origen: 'automatico' } }),
    ]);

    await asegurarInstanciasFijasPersonales(usuario.id);
    const desde = await primerMovimiento(usuario.id);
    let reevaluados = 0;
    if (desde) {
      let periodo = calcularPeriodoActual(usuario.frecuenciaCicloPersonal, desde);
      while (periodo.inicio <= hoy) {
        if (await evaluarPeriodoSiCorresponde(usuario.id, periodo.inicio)) reevaluados += 1;
        const siguiente = new Date(periodo.fin.getTime() + 24 * 60 * 60 * 1000);
        periodo = calcularPeriodoActual(usuario.frecuenciaCicloPersonal, siguiente);
      }
    }
    console.log(`  → limpiado; ${reevaluados} períodos de ahorro re-evaluados`);
  }

  if (!aplicar) console.log('\nModo simulación: no se borró nada. Corre de nuevo con --aplicar para hacerlo.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
