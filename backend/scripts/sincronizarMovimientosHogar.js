/**
 * Crea (o actualiza) en el panel personal de cada miembro el movimiento de
 * caja de cada gasto del hogar ya pagado (origen pago_hogar). Hace falta una
 * vez al desplegar la separación caja/consumo (migración
 * 20261125180000_caja_hogar_y_tarjetas), para los pagos hechos antes.
 *
 * Uso (desde backend/):
 *   node scripts/sincronizarMovimientosHogar.js            → solo muestra qué haría
 *   node scripts/sincronizarMovimientosHogar.js --aplicar  → lo hace
 */
import 'dotenv/config';
import { prisma } from '../src/config/prisma.js';
import { sincronizarPagosHogar } from '../src/utils/movimientosHogar.js';

const aplicar = process.argv.includes('--aplicar');
const hogares = await prisma.hogar.findMany({ select: { id: true, nombre: true } });
for (const hogar of hogares) {
  const [cuotas, gastos] = await Promise.all([
    prisma.gastoRecurrenteInstancia.count({ where: { concepto: { hogarId: hogar.id }, estado: { not: 'por_pagar' } } }),
    prisma.gastoVariablePareja.count({ where: { hogarId: hogar.id, estado: { not: 'por_pagar' } } }),
  ]);
  console.log(`${hogar.nombre}: ${cuotas} cuotas y ${gastos} gastos variables pagados`);
  if (aplicar) await prisma.$transaction((tx) => sincronizarPagosHogar(hogar.id, tx), { timeout: 60000 });
}
const movimientos = await prisma.gastoPersonal.count({ where: { origen: 'pago_hogar' } });
console.log(aplicar ? `Listo: ${movimientos} movimientos de pago del hogar.` : 'Simulación: no se cambió nada (usa --aplicar).');
await prisma.$disconnect();
