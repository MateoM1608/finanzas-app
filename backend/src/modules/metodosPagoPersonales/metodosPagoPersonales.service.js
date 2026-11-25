import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';

async function requireMetodoDelUsuario(usuarioId, id) {
  const metodo = await prisma.metodoPagoPersonal.findUnique({ where: { id } });
  if (!metodo || metodo.usuarioId !== usuarioId) {
    throw new HttpError(404, 'Método de pago no encontrado');
  }
  return metodo;
}

/**
 * Deuda de cada tarjeta de crédito = lo que se ha cargado (gastos pagados con
 * ella: compras, cuotas, pagos del hogar) − los pagos registrados a la
 * tarjeta. Las compras con tarjeta no bajan el Disponible hasta pagarla.
 */
export async function calcularDeudaTarjetas(usuarioId) {
  const [cargos, pagos] = await Promise.all([
    prisma.gastoPersonal.groupBy({
      by: ['metodoPagoId'],
      where: { usuarioId, estado: 'pagado', metodoPago: { tipo: 'tarjeta_credito' } },
      _sum: { monto: true },
    }),
    prisma.gastoPersonal.groupBy({
      by: ['tarjetaPagadaId'],
      where: { usuarioId, estado: 'pagado', origen: 'pago_tarjeta', tarjetaPagadaId: { not: null } },
      _sum: { monto: true },
    }),
  ]);
  const deuda = new Map();
  for (const c of cargos) deuda.set(c.metodoPagoId, (deuda.get(c.metodoPagoId) ?? 0) + (c._sum.monto ?? 0));
  for (const p of pagos) deuda.set(p.tarjetaPagadaId, (deuda.get(p.tarjetaPagadaId) ?? 0) - (p._sum.monto ?? 0));
  return deuda;
}

/**
 * Punto de partida de cada método: el saldo con que se empezó a usar la app
 * en una cuenta (IngresoPersonal origen saldo_inicial: sube el Disponible sin
 * ser ingreso real) o la deuda que ya traía una tarjeta de crédito
 * (GastoPersonal origen saldo_inicial con la tarjeta: sube su deuda sin ser
 * consumo). Uno por método.
 */
async function saldosIniciales(usuarioId, metodoPagoId) {
  const where = { usuarioId, origen: 'saldo_inicial', ...(metodoPagoId ? { metodoPagoId } : {}) };
  const select = { id: true, metodoPagoId: true, monto: true, fecha: true };
  const [ingresos, gastos] = await Promise.all([
    prisma.ingresoPersonal.findMany({ where, select }),
    prisma.gastoPersonal.findMany({ where, select }),
  ]);
  const mapa = new Map();
  for (const s of [...ingresos.map((x) => ({ ...x, tabla: 'ingreso' })), ...gastos.map((x) => ({ ...x, tabla: 'gasto' }))]) {
    mapa.set(s.metodoPagoId, s);
  }
  return mapa;
}

const publico = (s) => (s ? { monto: s.monto, fecha: s.fecha } : null);

export async function listarMetodosPago(usuarioActual) {
  const [metodos, deuda, iniciales] = await Promise.all([
    prisma.metodoPagoPersonal.findMany({ where: { usuarioId: usuarioActual.id }, orderBy: { nombre: 'asc' } }),
    calcularDeudaTarjetas(usuarioActual.id),
    saldosIniciales(usuarioActual.id),
  ]);
  return metodos.map((m) => ({
    ...m,
    saldoInicial: publico(iniciales.get(m.id)),
    ...(m.tipo === 'tarjeta_credito' ? { deuda: deuda.get(m.id) ?? 0 } : {}),
  }));
}

/**
 * Guarda (o quita, con monto 0) el punto de partida de un método. En una
 * tarjeta de crédito es lo que se debe hoy sin las cuotas que todavía no se
 * cobran (esas van en su compra a cuotas en curso). Un crédito de almacén no
 * lleva: sus compras se registran como compras a cuotas en curso.
 */
const errorSaldoAlmacen = () =>
  new HttpError(400, 'Un crédito de almacén no lleva saldo inicial: registra lo que debes como una compra a cuotas en curso');

export async function guardarSaldoInicial(usuarioActual, metodoId, { monto, fecha }) {
  const usuarioId = usuarioActual.id;
  const metodo = await requireMetodoDelUsuario(usuarioId, metodoId);
  const actuales = await Promise.all([
    prisma.ingresoPersonal.findMany({ where: { usuarioId, metodoPagoId: metodoId, origen: 'saldo_inicial' }, select: { id: true } }),
    prisma.gastoPersonal.findMany({ where: { usuarioId, metodoPagoId: metodoId, origen: 'saldo_inicial' }, select: { id: true } }),
  ]);
  if (monto > 0 && metodo.tipo === 'credito_almacen') throw errorSaldoAlmacen();
  const esTarjeta = metodo.tipo === 'tarjeta_credito';
  await prisma.$transaction(async (tx) => {
    await tx.ingresoPersonal.deleteMany({ where: { id: { in: actuales[0].map((x) => x.id) } } });
    await tx.gastoPersonal.deleteMany({ where: { id: { in: actuales[1].map((x) => x.id) } } });
    if (!monto) return;
    const comun = { usuarioId, metodoPagoId: metodoId, monto, fecha, origen: 'saldo_inicial' };
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
 * No es consumo (las compras ya contaron al hacerse).
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
  if (data.saldoInicial?.monto > 0 && data.tipo === 'credito_almacen') throw errorSaldoAlmacen();
  const metodo = await prisma.metodoPagoPersonal.create({
    data: { usuarioId: usuarioActual.id, ...datosMetodo(data) },
  });
  if (data.saldoInicial?.monto) {
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
    await guardarSaldoInicial(usuarioActual, id, {
      monto: metodo.tipo === 'credito_almacen' ? 0 : inicial.monto,
      fecha: inicial.fecha,
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
