import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { hoyUTC } from '../../utils/fechas.js';
import { calcularDeudaTarjetas } from '../metodosPagoPersonales/metodosPagoPersonales.service.js';

/**
 * Informe de un método de pago del usuario (privado): lo que salió y entró
 * por él en un mes y, si es tarjeta de crédito, su deuda, las compras a
 * cuotas vivas (personales y del hogar que el usuario paga con ella), los
 * pagos hechos a la tarjeta y lo que viene en los próximos meses separado
 * en capital e intereses.
 */

const MESES_PROXIMOS = 6;

function rangoMes(periodo) {
  const [anio, mes] = periodo.split('-').map(Number);
  return { gte: new Date(Date.UTC(anio, mes - 1, 1)), lte: new Date(Date.UTC(anio, mes, 0)) };
}

function claveMes(fecha) {
  const f = new Date(fecha);
  return `${f.getUTCFullYear()}-${String(f.getUTCMonth() + 1).padStart(2, '0')}`;
}

function sumar(items) {
  return items.reduce((acc, i) => acc + i.monto, 0);
}

const SELECT_MOV = {
  id: true,
  fecha: true,
  monto: true,
  descripcion: true,
  estado: true,
  origen: true,
  numeroCuota: true,
  capital: true,
  interes: true,
  categoria: { select: { nombre: true } },
};

export async function obtenerInforme(usuarioActual, metodoId, periodo) {
  const usuarioId = usuarioActual.id;
  const metodo = await prisma.metodoPagoPersonal.findUnique({ where: { id: metodoId } });
  if (!metodo || metodo.usuarioId !== usuarioId) {
    throw new HttpError(404, 'Método de pago no encontrado');
  }
  const hoy = hoyUTC();
  const mes = periodo ?? claveMes(hoy);
  const rango = rangoMes(mes);

  const [gastosMes, ingresosMes] = await Promise.all([
    prisma.gastoPersonal.findMany({
      where: { usuarioId, metodoPagoId: metodoId, estado: 'pagado', fecha: rango, origen: { not: 'saldo_inicial' } },
      select: SELECT_MOV,
      orderBy: { fecha: 'desc' },
    }),
    prisma.ingresoPersonal.findMany({
      where: { usuarioId, metodoPagoId: metodoId, estado: 'recibido', fecha: rango, origen: { not: 'saldo_inicial' } },
      select: { id: true, fecha: true, monto: true, descripcion: true, origen: true },
      orderBy: { fecha: 'desc' },
    }),
  ]);

  const informe = {
    metodo,
    mes: {
      periodo: mes,
      gastos: gastosMes,
      totalGastos: sumar(gastosMes),
      interesesMes: gastosMes.reduce((acc, g) => acc + (g.interes ?? 0), 0),
      ingresos: ingresosMes,
      totalIngresos: sumar(ingresosMes),
    },
    tarjeta: null,
  };
  if (metodo.tipo !== 'tarjeta_credito') return informe;

  // --- Tarjeta de crédito ---
  const [deudas, cargos, pagos] = await Promise.all([
    calcularDeudaTarjetas(usuarioId),
    // Todo lo que se carga a la tarjeta (incluye cuotas futuras aún pendientes)
    prisma.gastoPersonal.findMany({
      where: { usuarioId, metodoPagoId: metodoId, origen: { not: 'pago_tarjeta' } },
      select: {
        ...SELECT_MOV,
        compraId: true,
        compra: { select: { id: true, descripcion: true, numeroCuotas: true, tasaMensual: true, cuotasPagadasAntes: true } },
        pagoGastoHogar: {
          select: { compra: { select: { id: true, item: true, numeroCuotas: true, tasaMensual: true, cuotasPagadasAntes: true } } },
        },
      },
      orderBy: { fecha: 'asc' },
    }),
    prisma.gastoPersonal.findMany({
      where: { usuarioId, origen: 'pago_tarjeta', tarjetaPagadaId: metodoId },
      select: { id: true, fecha: true, monto: true, montoUsd: true, metodoPago: { select: { nombre: true } } },
      orderBy: { fecha: 'desc' },
    }),
  ]);

  // Compras a cuotas vivas: las que todavía tienen cuotas con fecha futura.
  const compras = new Map();
  for (const c of cargos) {
    const compraPersonal = c.compra;
    const compraHogar = c.pagoGastoHogar?.compra;
    if (!compraPersonal && !compraHogar) continue;
    const clave = compraPersonal ? `p:${compraPersonal.id}` : `h:${compraHogar.id}`;
    const actual = compras.get(clave) ?? {
      nombre: compraPersonal ? compraPersonal.descripcion : compraHogar.item,
      origen: compraPersonal ? 'personal' : 'hogar',
      numeroCuotas: (compraPersonal ?? compraHogar).numeroCuotas,
      tasaMensual: (compraPersonal ?? compraHogar).tasaMensual,
      cuotasCobradas: (compraPersonal ?? compraHogar).cuotasPagadasAntes ?? 0,
      saldoPendiente: 0,
      interesPendiente: 0,
      proximaCuota: null,
      terminaEn: null,
    };
    if (c.fecha <= hoy) {
      actual.cuotasCobradas += 1;
    } else {
      actual.saldoPendiente += c.monto;
      actual.interesPendiente += c.interes ?? 0;
      if (!actual.proximaCuota) actual.proximaCuota = { fecha: c.fecha, monto: c.monto };
    }
    actual.terminaEn = c.fecha;
    compras.set(clave, actual);
  }

  // Próximos meses: lo que se cargará a la tarjeta, separado en capital e interés.
  const proximos = new Map();
  for (let i = 1; i <= MESES_PROXIMOS; i += 1) {
    const clave = claveMes(new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + i, 1)));
    proximos.set(clave, { periodo: clave, total: 0, capital: 0, interes: 0 });
  }
  const mesActual = claveMes(hoy);
  proximos.set(mesActual, { periodo: mesActual, total: 0, capital: 0, interes: 0 });
  for (const c of cargos) {
    if (c.fecha <= hoy) continue;
    const fila = proximos.get(claveMes(c.fecha));
    if (!fila) continue;
    fila.total += c.monto;
    fila.interes += c.interes ?? 0;
    fila.capital += c.monto - (c.interes ?? 0);
  }

  informe.tarjeta = {
    deuda: deudas.get(metodoId) ?? 0,
    comprasVivas: [...compras.values()].filter((c) => c.saldoPendiente > 0),
    pagos,
    proximosPagos: [...proximos.values()].sort((a, b) => a.periodo.localeCompare(b.periodo)),
    interesesTotales: cargos.filter((c) => c.fecha <= hoy).reduce((acc, c) => acc + (c.interes ?? 0), 0),
  };
  return informe;
}
