import { prisma } from '../config/prisma.js';

/**
 * Vista de CONSUMO del panel personal ("¿cuánto gasté yo?"), separada de la
 * de CAJA (movimientos y Disponible: "¿cuánta plata salió y entró?").
 *
 * Consumo = gastos personales propios pagados (sin los movimientos de caja
 * del hogar, los reintegros ni los pagos de tarjeta) + la PARTE del usuario
 * en cada gasto del hogar ya pagado, en la fecha del gasto. Ingresos reales
 * = ingresos recibidos sin los reintegros de cuadres (no son sueldo: es
 * plata propia que vuelve).
 *
 * Una compra con tarjeta de crédito sí es consumo en su fecha (aunque no
 * baje el Disponible hasta pagar la tarjeta).
 */
// Un abono extra a capital de un préstamo paga deuda: baja la caja pero no es consumo.
export const ORIGENES_NO_CONSUMO = ['pago_hogar', 'liquidacion_hogar', 'pago_tarjeta', 'cuadre_hogar', 'abono_prestamo'];

const CATEGORIA_HOGAR = 'Hogar';

/**
 * Gastos de consumo del usuario con fecha en `rango` ({ gte, lte } o
 * { inicio, fin }), normalizados a { monto, fecha, esObligatorio,
 * categoriaId, categoria, origen }. Lo del hogar cuenta como obligatorio
 * (son compromisos compartidos) y con categoría "Hogar".
 */
export async function gastosDeConsumo(usuarioId, rango, { estado = 'pagado' } = {}) {
  const fecha = rango ? { gte: rango.gte ?? rango.inicio, lte: rango.lte ?? rango.fin } : undefined;
  const [personales, repartosCuotas, repartosGastos] = await Promise.all([
    prisma.gastoPersonal.findMany({
      where: { usuarioId, estado, origen: { notIn: ORIGENES_NO_CONSUMO }, ...(fecha ? { fecha } : {}) },
      include: { categoria: true },
    }),
    estado === 'pagado'
      ? prisma.gastoRecurrenteInstanciaReparto.findMany({
          where: { usuarioId, instancia: { estado: { not: 'por_pagar' }, ...(fecha ? { fecha } : {}) } },
          include: { instancia: { select: { fecha: true, concepto: { select: { nombre: true } } } } },
        })
      : [],
    estado === 'pagado'
      ? prisma.gastoVariableParejaReparto.findMany({
          where: { usuarioId, gasto: { estado: { not: 'por_pagar' }, abonoPrestamoId: null, ...(fecha ? { fecha } : {}) } },
          include: { gasto: { select: { fecha: true, item: true } } },
        })
      : [],
  ]);

  return [
    ...personales.map((g) => ({
      monto: g.monto,
      fecha: g.fecha,
      esObligatorio: g.esObligatorio,
      categoriaId: g.categoriaId,
      categoria: g.categoria?.nombre ?? null,
      descripcion: g.descripcion,
      origen: 'personal',
    })),
    ...repartosCuotas.map((r) => ({
      monto: r.monto,
      fecha: r.instancia.fecha,
      esObligatorio: true,
      categoriaId: null,
      categoria: CATEGORIA_HOGAR,
      descripcion: r.instancia.concepto.nombre,
      origen: 'hogar',
    })),
    ...repartosGastos.map((r) => ({
      monto: r.monto,
      fecha: r.gasto.fecha,
      esObligatorio: true,
      categoriaId: null,
      categoria: CATEGORIA_HOGAR,
      descripcion: r.gasto.item,
      origen: 'hogar',
    })),
  ].filter((g) => g.monto > 0);
}

/** Ingresos reales recibidos en el rango: sin los reintegros de los cuadres del hogar ni desembolsos de préstamos. */
export function ingresosReales(usuarioId, rango) {
  const fecha = rango ? { gte: rango.gte ?? rango.inicio, lte: rango.lte ?? rango.fin } : undefined;
  return prisma.ingresoPersonal.findMany({
    where: { usuarioId, estado: 'recibido', origen: { notIn: ['liquidacion_hogar', 'desembolso_prestamo'] }, ...(fecha ? { fecha } : {}) },
  });
}

export function sumarMontos(items) {
  return items.reduce((acc, i) => acc + i.monto, 0);
}
