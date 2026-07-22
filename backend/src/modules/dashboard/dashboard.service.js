import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { obtenerOrigenesDetalladosPorLote, origenClave } from '../../utils/corteItemOrigen.js';

const MESES_VENTANA = 6;
const CORTES_VENTANA = 6;

function claveMes(fecha) {
  const d = new Date(fecha);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function obtenerDashboardPersonal(usuarioId) {
  const gastos = await prisma.gastoPersonal.findMany({
    where: { usuarioId },
    orderBy: { fecha: 'asc' },
  });

  const totalesPorMes = new Map();
  for (const gasto of gastos) {
    const clave = claveMes(gasto.fecha);
    totalesPorMes.set(clave, (totalesPorMes.get(clave) ?? 0) + gasto.monto);
  }

  const mesesConDatos = [...totalesPorMes.keys()].sort();
  const ultimosMeses = mesesConDatos.slice(-MESES_VENTANA);
  const serieMensual = ultimosMeses.map((periodo) => ({
    periodo,
    total: totalesPorMes.get(periodo),
  }));

  // El desglose por categoría se calcula sobre la misma ventana que la serie
  // mensual (no todo el histórico ni solo el mes en curso), para que ambos
  // gráficos representen exactamente el mismo rango de tiempo.
  const desdeVentana = ultimosMeses[0];
  const gastosVentana = desdeVentana
    ? gastos.filter((g) => claveMes(g.fecha) >= desdeVentana)
    : gastos;
  const totalesPorCategoria = new Map();
  for (const gasto of gastosVentana) {
    const categoria = gasto.categoria || 'Sin categoría';
    totalesPorCategoria.set(categoria, (totalesPorCategoria.get(categoria) ?? 0) + gasto.monto);
  }
  const porCategoria = [...totalesPorCategoria.entries()]
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total);

  const hoy = new Date();
  const mesAnteriorFecha = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const totalMesActual = totalesPorMes.get(claveMes(hoy)) ?? 0;
  const totalMesAnterior = totalesPorMes.get(claveMes(mesAnteriorFecha)) ?? 0;
  const variacionPct = totalMesAnterior
    ? ((totalMesActual - totalMesAnterior) / totalMesAnterior) * 100
    : null;

  return {
    resumen: { totalMesActual, totalMesAnterior, variacionPct },
    serieMensual,
    porCategoria,
  };
}

export async function obtenerDashboardHogar(usuarioActual) {
  if (!usuarioActual.hogarId) {
    throw new HttpError(409, 'No perteneces a ningún hogar todavía');
  }
  const hogarId = usuarioActual.hogarId;

  const cortesCerrados = await prisma.corte.findMany({
    where: { hogarId, estado: 'cerrado' },
    orderBy: { fechaNominal: 'desc' },
    take: CORTES_VENTANA,
    include: {
      items: true,
      balances: { include: { usuario: { select: { id: true, nombre: true } } } },
    },
  });
  cortesCerrados.reverse();

  const itemsIncluidos = cortesCerrados.flatMap((c) => c.items.filter((i) => i.incluido));
  const mapaOrigenes = await obtenerOrigenesDetalladosPorLote(itemsIncluidos);

  const totalPagadoPorMiembro = new Map();
  const serieCortes = cortesCerrados.map((corte) => {
    const incluidos = corte.items.filter((i) => i.incluido);
    const totalRecurrentes = incluidos
      .filter((i) => i.tipoOrigen === 'recurrente')
      .reduce((acc, i) => acc + i.monto, 0);
    const totalVariables = incluidos
      .filter((i) => i.tipoOrigen === 'variable')
      .reduce((acc, i) => acc + i.monto, 0);

    for (const item of incluidos) {
      const origen = mapaOrigenes.get(origenClave(item));
      if (!origen?.pagador) continue;
      const actual = totalPagadoPorMiembro.get(origen.pagador.id) ?? {
        nombre: origen.pagador.nombre,
        total: 0,
      };
      actual.total += item.monto;
      totalPagadoPorMiembro.set(origen.pagador.id, actual);
    }

    return {
      fechaNominal: corte.fechaNominal,
      totalRecurrentes,
      totalVariables,
      balances: corte.balances.map((b) => ({
        usuarioId: b.usuarioId,
        nombre: b.usuario.nombre,
        balance: b.balance,
      })),
    };
  });

  const hayCorteAbierto = (await prisma.corte.count({ where: { hogarId, estado: 'abierto' } })) > 0;

  return {
    serieCortes,
    pagadoPorMiembro: [...totalPagadoPorMiembro.values()],
    hayCorteAbierto,
  };
}
