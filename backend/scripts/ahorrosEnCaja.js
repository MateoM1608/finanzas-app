// Crea el movimiento de caja (aporte_ahorro / retiro_ahorro) de las
// transacciones de Ahorros personales registradas antes de que los ahorros
// movieran el Disponible. Por defecto solo muestra qué haría; con --aplicar lo hace.
//   npm run ahorros-en-caja            (solo muestra)
//   npm run ahorros-en-caja -- --aplicar
import 'dotenv/config';
import { prisma } from '../src/config/prisma.js';
import { crearCajaAhorro } from '../src/utils/movimientosAhorro.js';

const aplicar = process.argv.includes('--aplicar');

const pendientes = await prisma.ahorroTransaccion.findMany({
  where: { gasto: null, ingreso: null },
  include: { ahorro: { select: { usuarioId: true, nombre: true } } },
  orderBy: { fecha: 'asc' },
});
console.log(`${pendientes.length} transacciones de ahorro sin movimiento de caja`);
for (const t of pendientes) {
  console.log(`  ${t.fecha.toISOString().slice(0, 10)} ${t.tipo} ${t.monto} · ${t.ahorro.nombre}`);
}
if (aplicar && pendientes.length) {
  await prisma.$transaction(
    async (tx) => {
      for (const t of pendientes) await crearCajaAhorro(tx, t, t.ahorro.usuarioId, t.ahorro.nombre);
    },
    { timeout: 120000, maxWait: 20000 },
  );
  console.log('Listo: movimientos creados.');
} else if (pendientes.length) {
  console.log('Nada se cambió. Corre con --aplicar para crearlos.');
}
await prisma.$disconnect();
