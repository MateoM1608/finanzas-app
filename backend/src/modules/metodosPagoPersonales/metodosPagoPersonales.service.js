import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { aPesos, trmParaDeuda } from '../../utils/dolares.js';

async function requireMetodoDelUsuario(usuarioId, id) {
  const metodo = await prisma.metodoPagoPersonal.findUnique({ where: { id } });
  if (!metodo || metodo.usuarioId !== usuarioId) {
    throw new HttpError(404, 'Método de pago no encontrado');
  }
  return metodo;
}

/**
 * Deuda de cada tarjeta de crédito, separada en pesos y en dólares como el
 * extracto del banco: lo que se ha cargado (gastos pagados con ella: compras,
 * cuotas, pagos del hogar, deuda inicial) − los pagos registrados a la
 * tarjeta. Un cargo o un pago con `montoUsd` va a la parte en dólares (en
 * centavos); los demás, a la de pesos. `pesosDeUsd` es lo que esos dólares
 * costaron en pesos (cargos − pagos), por si no hay tasa para valorarlos.
 * Las compras con tarjeta no bajan el Disponible hasta pagarla.
 * `hasta`: solo lo que había pasado hasta esa fecha (ciclos pasados).
 */
export async function calcularDeudaTarjetasDetalle(usuarioId, hasta = null) {
  const fecha = hasta ? { fecha: { lte: hasta } } : {};
  const [cargos, pagos] = await Promise.all([
    prisma.gastoPersonal.groupBy({
      by: ['metodoPagoId'],
      where: { usuarioId, estado: 'pagado', ...fecha, metodoPago: { tipo: 'tarjeta_credito' } },
      _sum: { monto: true },
    }),
    prisma.gastoPersonal.groupBy({
      by: ['tarjetaPagadaId'],
      where: { usuarioId, estado: 'pagado', ...fecha, origen: 'pago_tarjeta', tarjetaPagadaId: { not: null } },
      _sum: { monto: true },
    }),
  ]);
  const [cargosUsd, pagosUsd] = await Promise.all([
    prisma.gastoPersonal.groupBy({
      by: ['metodoPagoId'],
      where: { usuarioId, estado: 'pagado', ...fecha, metodoPago: { tipo: 'tarjeta_credito' }, montoUsd: { not: null } },
      _sum: { monto: true, montoUsd: true },
    }),
    prisma.gastoPersonal.groupBy({
      by: ['tarjetaPagadaId'],
      where: { usuarioId, estado: 'pagado', ...fecha, origen: 'pago_tarjeta', tarjetaPagadaId: { not: null }, montoUsd: { not: null } },
      _sum: { monto: true, montoUsd: true },
    }),
  ]);
  const deuda = new Map();
  const de = (id) => {
    if (!deuda.has(id)) deuda.set(id, { pesos: 0, usd: 0, pesosDeUsd: 0 });
    return deuda.get(id);
  };
  for (const c of cargos) de(c.metodoPagoId).pesos += c._sum.monto ?? 0;
  for (const p of pagos) de(p.tarjetaPagadaId).pesos -= p._sum.monto ?? 0;
  for (const c of cargosUsd) {
    const d = de(c.metodoPagoId);
    d.pesos -= c._sum.monto ?? 0;
    d.pesosDeUsd += c._sum.monto ?? 0;
    d.usd += c._sum.montoUsd ?? 0;
  }
  for (const p of pagosUsd) {
    const d = de(p.tarjetaPagadaId);
    d.pesos += p._sum.monto ?? 0;
    d.pesosDeUsd -= p._sum.monto ?? 0;
    d.usd -= p._sum.montoUsd ?? 0;
  }
  return deuda;
}

/** Deuda de una tarjeta en pesos: la parte en pesos + los dólares a la tasa de hoy. */
export function deudaEnPesos(d, trm) {
  if (!d) return 0;
  return d.pesos + (d.usd ? (trm ? aPesos(d.usd, trm) : d.pesosDeUsd) : 0);
}

/** Deuda de cada tarjeta valorada en pesos (los dólares a la TRM de hoy). */
export async function calcularDeudaTarjetas(usuarioId, { hasta = null, trm } = {}) {
  const detalle = await calcularDeudaTarjetasDetalle(usuarioId, hasta);
  // La TRM solo se consulta si alguna tarjeta debe dólares.
  const hayUsd = [...detalle.values()].some((d) => d.usd);
  const tasa = !hayUsd ? null : trm === undefined ? await trmParaDeuda(usuarioId) : trm;
  const deuda = new Map();
  for (const [id, d] of detalle) deuda.set(id, deudaEnPesos(d, tasa));
  return deuda;
}

/**
 * Punto de partida de cada método: el saldo con que se empezó a usar la app
 * en una cuenta (IngresoPersonal origen saldo_inicial: sube el Disponible sin
 * ser ingreso real) o la deuda que ya traía una tarjeta de crédito
 * (GastoPersonal origen saldo_inicial con la tarjeta: sube su deuda sin ser
 * consumo). Uno por método; una tarjeta puede traer además una deuda
 * inicial en dólares (otra fila, con montoUsd y la tasa del día).
 */
async function saldosIniciales(usuarioId, metodoPagoId) {
  const where = { usuarioId, origen: 'saldo_inicial', ...(metodoPagoId ? { metodoPagoId } : {}) };
  const [ingresos, gastos] = await Promise.all([
    prisma.ingresoPersonal.findMany({ where, select: { metodoPagoId: true, monto: true, fecha: true } }),
    prisma.gastoPersonal.findMany({ where, select: { metodoPagoId: true, monto: true, fecha: true, montoUsd: true, trm: true } }),
  ]);
  const mapa = new Map();
  for (const s of [...ingresos, ...gastos]) {
    const actual = mapa.get(s.metodoPagoId) ?? { monto: 0, fecha: s.fecha, montoUsd: null, trm: null };
    if (s.montoUsd) {
      actual.montoUsd = s.montoUsd;
      actual.trm = s.trm;
    } else {
      actual.monto = s.monto;
    }
    actual.fecha = s.fecha;
    mapa.set(s.metodoPagoId, actual);
  }
  return mapa;
}

const publico = (s) => (s ? { monto: s.monto, fecha: s.fecha, montoUsd: s.montoUsd, trm: s.trm } : null);

/**
 * Métodos del usuario. Cada tarjeta trae su deuda: `deuda` (todo en pesos,
 * los dólares a la TRM de hoy), `deudaPesos`, `deudaUsd` (centavos) y, si
 * tiene cupo, `cupoDisponible` (el cupo es uno solo, en pesos: lo consumen
 * las dos partes). `trmDeuda` es la tasa usada (null si no hubo).
 */
export async function listarMetodosPago(usuarioActual) {
  const usuarioId = usuarioActual.id;
  const [metodos, detalle, iniciales] = await Promise.all([
    prisma.metodoPagoPersonal.findMany({ where: { usuarioId }, orderBy: { nombre: 'asc' } }),
    calcularDeudaTarjetasDetalle(usuarioId),
    saldosIniciales(usuarioId),
  ]);
  const hayUsd = [...detalle.values()].some((d) => d.usd);
  const trm = hayUsd ? await trmParaDeuda(usuarioId) : null;
  return metodos.map((m) => {
    if (m.tipo !== 'tarjeta_credito') return { ...m, saldoInicial: publico(iniciales.get(m.id)) };
    const d = detalle.get(m.id) ?? { pesos: 0, usd: 0, pesosDeUsd: 0 };
    const deuda = deudaEnPesos(d, trm);
    return {
      ...m,
      saldoInicial: publico(iniciales.get(m.id)),
      deuda,
      deudaPesos: d.pesos,
      deudaUsd: d.usd,
      trmDeuda: d.usd ? trm : null,
      cupoDisponible: m.cupo ? m.cupo - deuda : null,
    };
  });
}

/**
 * Guarda (o quita, con monto 0) el punto de partida de un método. En una
 * tarjeta de crédito es lo que se debe hoy sin las cuotas que todavía no se
 * cobran (esas van en su compra a cuotas en curso). Un crédito de almacén no
 * lleva: sus compras se registran como compras a cuotas en curso.
 */
const errorSaldoAlmacen = () =>
  new HttpError(400, 'Un crédito de almacén no lleva saldo inicial: registra lo que debes como una compra a cuotas en curso');

export async function guardarSaldoInicial(usuarioActual, metodoId, { monto, fecha, montoUsd = null, trm = null }) {
  const usuarioId = usuarioActual.id;
  const metodo = await requireMetodoDelUsuario(usuarioId, metodoId);
  const actuales = await Promise.all([
    prisma.ingresoPersonal.findMany({ where: { usuarioId, metodoPagoId: metodoId, origen: 'saldo_inicial' }, select: { id: true } }),
    prisma.gastoPersonal.findMany({ where: { usuarioId, metodoPagoId: metodoId, origen: 'saldo_inicial' }, select: { id: true } }),
  ]);
  if ((monto > 0 || montoUsd > 0) && metodo.tipo === 'credito_almacen') throw errorSaldoAlmacen();
  const esTarjeta = metodo.tipo === 'tarjeta_credito';
  if (montoUsd > 0 && !esTarjeta) throw new HttpError(400, 'Solo una tarjeta de crédito lleva deuda en dólares');
  if (montoUsd > 0 && !trm) throw new HttpError(400, 'Escribe la tasa de cambio de la deuda en dólares');
  await prisma.$transaction(async (tx) => {
    await tx.ingresoPersonal.deleteMany({ where: { id: { in: actuales[0].map((x) => x.id) } } });
    await tx.gastoPersonal.deleteMany({ where: { id: { in: actuales[1].map((x) => x.id) } } });
    const comun = { usuarioId, metodoPagoId: metodoId, monto, fecha, origen: 'saldo_inicial' };
    if (esTarjeta && montoUsd > 0) {
      await tx.gastoPersonal.create({
        data: {
          ...comun,
          monto: aPesos(montoUsd, trm),
          montoUsd,
          trm,
          descripcion: `Deuda inicial en dólares de ${metodo.nombre}`,
          estado: 'pagado',
          esObligatorio: false,
        },
      });
    }
    if (!monto) return;
    if (esTarjeta) {
      await tx.gastoPersonal.create({
        data: { ...comun, descripcion: `Deuda inicial de ${metodo.nombre}`, estado: 'pagado', esObligatorio: false },
      });
    } else {
      await tx.ingresoPersonal.create({
        data: { ...comun, descripcion: `Saldo inicial de ${metodo.nombre}`, estado: 'recibido' },
      });
    }
  });
  return publico((await saldosIniciales(usuarioId, metodoId)).get(metodoId));
}

/**
 * Registra el pago de una tarjeta de crédito: un movimiento (origen
 * pago_tarjeta) que SÍ baja el Disponible, desde la cuenta con que se pagó.
 * No es consumo (las compras ya contaron al hacerse). Pago de la parte en
 * dólares: `montoUsd` son los US$ que cubre (centavos) y `monto` los pesos
 * que costó (la tasa queda guardada); la diferencia de cambio no es consumo.
 */
export async function registrarPagoTarjeta(usuarioActual, tarjetaId, data) {
  const tarjeta = await requireMetodoDelUsuario(usuarioActual.id, tarjetaId);
  if (tarjeta.tipo !== 'tarjeta_credito') {
    throw new HttpError(400, 'Solo se registran pagos de una tarjeta de crédito');
  }
  if (data.metodoPagoId) {
    const desde = await requireMetodoDelUsuario(usuarioActual.id, data.metodoPagoId);
    if (desde.tipo === 'tarjeta_credito') {
      throw new HttpError(400, 'Una tarjeta de crédito no se paga con otra tarjeta de crédito');
    }
  }
  return prisma.gastoPersonal.create({
    data: {
      usuarioId: usuarioActual.id,
      monto: data.monto,
      fecha: data.fecha,
      descripcion: `Pago de ${tarjeta.nombre}`,
      estado: 'pagado',
      esObligatorio: false,
      metodoPagoId: data.metodoPagoId ?? null,
      tarjetaPagadaId: tarjetaId,
      origen: 'pago_tarjeta',
      ...(data.montoUsd ? { montoUsd: data.montoUsd, trm: Math.round((data.monto * 10000) / data.montoUsd) / 100 } : {}),
    },
  });
}

/**
 * Los datos de tarjeta (corte, pago, cupo, últimos 4) solo aplican a tarjeta
 * de crédito y crédito de almacén; para los demás tipos se limpian.
 */
function datosMetodo(data, actual = {}) {
  const tipo = data.tipo ?? actual.tipo ?? 'otro';
  const esCredito = tipo === 'tarjeta_credito' || tipo === 'credito_almacen';
  const valor = (campo) => (data[campo] === undefined ? (actual[campo] ?? null) : data[campo]);
  return {
    nombre: data.nombre ?? actual.nombre,
    tipo,
    ultimos4: tipo === 'tarjeta_credito' || tipo === 'debito' ? valor('ultimos4') : null,
    diaCorte: tipo === 'tarjeta_credito' ? valor('diaCorte') : null,
    diaPago: esCredito ? valor('diaPago') : null,
    cupo: esCredito ? valor('cupo') : null,
    tasaMensual: esCredito ? (data.tasaMensual ?? actual.tasaMensual ?? 0) : 0,
    sistemaInteres: data.sistemaInteres ?? actual.sistemaInteres ?? 'capital_fijo',
  };
}

export async function crearMetodoPago(usuarioActual, data) {
  // Se valida antes de crear, para no dejar la cuenta creada si el saldo no aplica.
  if ((data.saldoInicial?.monto > 0 || data.saldoInicial?.montoUsd > 0) && data.tipo === 'credito_almacen') throw errorSaldoAlmacen();
  const metodo = await prisma.metodoPagoPersonal.create({
    data: { usuarioId: usuarioActual.id, ...datosMetodo(data) },
  });
  if (data.saldoInicial?.monto || data.saldoInicial?.montoUsd) {
    return { ...metodo, saldoInicial: await guardarSaldoInicial(usuarioActual, metodo.id, data.saldoInicial) };
  }
  return { ...metodo, saldoInicial: null };
}

export async function actualizarMetodoPago(usuarioActual, id, data) {
  const actual = await requireMetodoDelUsuario(usuarioActual.id, id);
  const metodo = await prisma.metodoPagoPersonal.update({ where: { id }, data: datosMetodo(data, actual) });
  // Si cambia de cuenta a tarjeta (o al revés), el punto de partida cambia de
  // sentido (saldo ↔ deuda): se vuelve a guardar con el tipo nuevo.
  const inicial = (await saldosIniciales(usuarioActual.id, id)).get(id);
  const eraTarjeta = actual.tipo === 'tarjeta_credito';
  const esTarjeta = metodo.tipo === 'tarjeta_credito';
  if (inicial && (eraTarjeta !== esTarjeta || metodo.tipo === 'credito_almacen')) {
    // Los dólares solo quedan si sigue siendo tarjeta (una cuenta no los lleva).
    await guardarSaldoInicial(usuarioActual, id, {
      monto: metodo.tipo === 'credito_almacen' ? 0 : inicial.monto,
      fecha: inicial.fecha,
      montoUsd: esTarjeta ? inicial.montoUsd : null,
      trm: inicial.trm,
    });
  }
  return { ...metodo, saldoInicial: publico((await saldosIniciales(usuarioActual.id, id)).get(id)) };
}

export async function eliminarMetodoPago(usuarioActual, id) {
  await requireMetodoDelUsuario(usuarioActual.id, id);
  // El punto de partida no cuenta como uso: se borra con el método.
  const sinOtrosMovimientos = { origen: { not: 'saldo_inicial' } };

  const [gastos, ingresos, gastosFijos, compras, comprasHogar, extractos, prestamos, movsAhorro] = await Promise.all([
    prisma.gastoPersonal.count({ where: { metodoPagoId: id, ...sinOtrosMovimientos } }),
    prisma.ingresoPersonal.count({ where: { metodoPagoId: id, ...sinOtrosMovimientos } }),
    prisma.gastoFijoConfig.count({ where: { metodoPagoIdDefault: id } }),
    prisma.compraCuotasPersonal.count({ where: { metodoPagoId: id } }),
    prisma.compraCuotasHogar.count({ where: { metodoPagoId: id } }),
    prisma.extractoTarjeta.count({ where: { metodoPagoId: id } }),
    prisma.prestamo.count({ where: { metodoPagoId: id } }),
    Promise.all([
      prisma.inversionMovimiento.count({ where: { metodoPagoId: id } }),
      prisma.metaHogarMovimiento.count({ where: { metodoPagoId: id } }),
      prisma.ahorroTransaccion.count({ where: { metodoPagoId: id } }),
    ]).then(([a, b, c]) => a + b + c),
  ]);
  if (gastos || ingresos || gastosFijos || compras || comprasHogar || extractos || prestamos || movsAhorro) {
    throw new HttpError(409, 'Este método de pago ya está en uso — no se puede eliminar');
  }

  await prisma.$transaction([
    prisma.ingresoPersonal.deleteMany({ where: { metodoPagoId: id, origen: 'saldo_inicial' } }),
    prisma.gastoPersonal.deleteMany({ where: { metodoPagoId: id, origen: 'saldo_inicial' } }),
    prisma.metodoPagoPersonal.delete({ where: { id } }),
  ]);
}
