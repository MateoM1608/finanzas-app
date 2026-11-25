import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { fechasDeCuotas } from '../../utils/cuotas.js';
import { tasaMensualDe, planPorNumero, planPorCuota } from '../../utils/prestamos.js';
import { obtenerSplitVigente, calcularReparto } from '../../utils/reparto.js';
import { sincronizarPagoGasto } from '../../utils/movimientosHogar.js';
import { evaluarPeriodoSiCorresponde } from '../../utils/evaluacionAhorro.js';
import { hoyUTC } from '../../utils/fechas.js';

/**
 * Préstamos (entrega D1), personales o del hogar. Las cuotas son filas
 * reales, como las compras a cuotas:
 * - Personal: GastoPersonal (prestamoId + numeroCuota), obligatorias.
 *   Manual: `pendiente` hasta "Lo pagué" (que guarda la fecha real de pago
 *   en `fecha`, la cuenta y, si se pagó más, la mora). Automático: se dan
 *   por pagadas en su fecha (pagarCuotasAutomaticasVencidas).
 * - Hogar: GastoVariablePareja repartida con el split general vigente al
 *   desembolso. Manual: `por_pagar` hasta "Lo pagué"; automático: nacen
 *   `pagado` y entran al saldo/cuadres en su fecha.
 * Abonos extra a capital: un movimiento (personal: origen abono_prestamo;
 * hogar: gasto repartido con abonoPrestamoId), que no es consumo, y las
 * cuotas sin pagar se recalculan (bajar el plazo o bajar la cuota).
 */

function requireHogarId(usuarioActual) {
  if (!usuarioActual.hogarId) throw new HttpError(409, 'No perteneces a ningún hogar todavía');
  return usuarioActual.hogarId;
}

function requirePermisoEdicion(usuarioActual) {
  if (!usuarioActual.esAdmin && !usuarioActual.puedeEditarGastos) {
    throw new HttpError(403, 'No tienes permiso para editar los gastos del hogar');
  }
}

async function requireMetodoPropio(usuarioId, metodoPagoId) {
  if (!metodoPagoId) return null;
  const metodo = await prisma.metodoPagoPersonal.findUnique({ where: { id: metodoPagoId } });
  if (!metodo || metodo.usuarioId !== usuarioId) throw new HttpError(400, 'Método de pago no encontrado');
  return metodo;
}

async function requireMiembro(hogarId, usuarioId) {
  const existe = await prisma.usuario.count({ where: { id: usuarioId, hogarId } });
  if (!existe) throw new HttpError(400, 'Quien paga debe ser un miembro de tu hogar');
}

/** Préstamo que el usuario puede ver: suyo personal, o del hogar al que pertenece. */
async function requirePrestamo(usuarioActual, id, { editar = false } = {}) {
  const prestamo = await prisma.prestamo.findUnique({ where: { id } });
  const visible =
    prestamo &&
    (prestamo.hogarId ? prestamo.hogarId === usuarioActual.hogarId : prestamo.usuarioId === usuarioActual.id);
  if (!visible) throw new HttpError(404, 'Préstamo no encontrado');
  if (editar && prestamo.hogarId) requirePermisoEdicion(usuarioActual);
  return prestamo;
}

// --- Cuotas: lectura uniforme de personales y del hogar ---

function cuotasDe(tx, prestamo) {
  if (prestamo.hogarId) {
    return tx.gastoVariablePareja.findMany({
      where: { prestamoId: prestamo.id },
      include: { repartos: true },
      orderBy: { numeroCuota: 'asc' },
    });
  }
  return tx.gastoPersonal.findMany({ where: { prestamoId: prestamo.id }, orderBy: { numeroCuota: 'asc' } });
}

function montoCuota(c) {
  return c.valorTotal ?? c.monto;
}

/**
 * ¿La cuota ya se pagó? Personal: estado pagado. Hogar: marcada (no
 * por_pagar) y con fecha de pago (o de la cuota, si es automática) ≤ hoy.
 */
function estaPagada(prestamo, c, hoy) {
  if (!prestamo.hogarId) return c.estado === 'pagado';
  // Adelantada en un cuadre: ya se liquidó aunque su fecha sea futura.
  if (c.estado === 'en_cuadre' || c.estado === 'cuadrado') return true;
  return c.estado !== 'por_pagar' && new Date(c.fechaPago ?? c.fecha) <= hoy;
}

/** Cuotas que todavía se pueden recalcular: sin pagar y sin estar en un cuadre. */
function esRecalculable(prestamo, c, hoy) {
  if (!prestamo.hogarId) return c.estado === 'pendiente';
  return c.estado === 'por_pagar' || (c.estado === 'pagado' && !c.fechaPago && new Date(c.fecha) > hoy);
}

async function sumaAbonos(tx, prestamoId) {
  const r = await tx.prestamoAbono.aggregate({ where: { prestamoId }, _sum: { monto: true } });
  return r._sum.monto ?? 0;
}

/** Capital que falta: saldo al registrarlo − capital de cuotas pagadas − abonos. */
async function saldoCapital(tx, prestamo, cuotas, hoy) {
  const pagado = cuotas.filter((c) => estaPagada(prestamo, c, hoy)).reduce((a, c) => a + (c.capital ?? 0), 0);
  return prestamo.saldoInicial - pagado - (await sumaAbonos(tx, prestamo.id));
}

/** Porcentajes del reparto de un préstamo del hogar: los de sus cuotas, o el split general al desembolso. */
async function porcentajesHogar(tx, prestamo) {
  const conReparto = await tx.gastoVariablePareja.findFirst({
    where: { OR: [{ prestamoId: prestamo.id }, { abonoPrestamo: { prestamoId: prestamo.id } }] },
    include: { repartos: true },
    orderBy: { creadoEn: 'asc' },
  });
  if (conReparto?.repartos.length && conReparto.valorTotal > 0) {
    return conReparto.repartos.map((r) => ({ usuarioId: r.usuarioId, porcentaje: (r.monto / conReparto.valorTotal) * 100 }));
  }
  const split = await obtenerSplitVigente(prestamo.hogarId, 'general', tx, prestamo.fechaDesembolso ?? prestamo.creadoEn);
  if (!split.length) throw new HttpError(409, 'Configura primero el porcentaje de reparto del hogar en Configuración');
  return split;
}

/** Crea las cuotas de un plan a partir de un número y una fecha. */
async function crearCuotas(tx, prestamo, plan, desdeNumero, desdeFecha, porcentajes) {
  if (!plan.length) return;
  const hoy = hoyUTC();
  const fechas = fechasDeCuotas(desdeFecha, plan.length);
  if (!prestamo.hogarId) {
    await tx.gastoPersonal.createMany({
      data: plan.map((c, i) => ({
        usuarioId: prestamo.usuarioId,
        prestamoId: prestamo.id,
        numeroCuota: desdeNumero + i,
        monto: c.monto,
        capital: c.capital,
        interes: c.interes,
        seguro: c.seguro || null,
        fecha: fechas[i],
        fechaVencimiento: fechas[i],
        descripcion: prestamo.nombre,
        estado: prestamo.modoCobro === 'automatico' && fechas[i] <= hoy ? 'pagado' : 'pendiente',
        esObligatorio: true,
        metodoPagoId: prestamo.metodoPagoId,
        categoriaId: prestamo.categoriaId,
        origen: 'app',
      })),
    });
    return;
  }
  for (let i = 0; i < plan.length; i += 1) {
    const cuota = await tx.gastoVariablePareja.create({
      data: {
        hogarId: prestamo.hogarId,
        item: prestamo.nombre,
        valorTotal: plan[i].monto,
        capital: plan[i].capital,
        interes: plan[i].interes,
        seguro: plan[i].seguro || null,
        pagoUsuarioId: prestamo.pagoUsuarioId,
        metodoPagoId: prestamo.metodoPagoId,
        fecha: fechas[i],
        estado: prestamo.modoCobro === 'automatico' ? 'pagado' : 'por_pagar',
        prestamoId: prestamo.id,
        numeroCuota: desdeNumero + i,
      },
    });
    await tx.gastoVariableParejaReparto.createMany({
      data: calcularReparto(plan[i].monto, porcentajes).map((r) => ({ gastoId: cuota.id, ...r })),
    });
    await sincronizarPagoGasto(tx, cuota.id);
  }
}

async function borrarCuotas(tx, prestamo, ids) {
  if (!ids.length) return;
  if (prestamo.hogarId) {
    await tx.gastoVariableParejaReparto.deleteMany({ where: { gastoId: { in: ids } } });
    await tx.gastoVariablePareja.deleteMany({ where: { id: { in: ids } } });
  } else {
    await tx.gastoPersonal.deleteMany({ where: { id: { in: ids } } });
  }
}

/**
 * Recalcula las cuotas sin pagar con el saldo de capital actual: `reducir_plazo`
 * conserva la cuota y cambia cuántas quedan; `reducir_cuota` conserva cuántas
 * quedan y baja (o sube) la cuota.
 */
async function recalcularPendientes(tx, prestamo, modo) {
  const hoy = hoyUTC();
  const cuotas = await cuotasDe(tx, prestamo);
  const pendientes = cuotas.filter((c) => esRecalculable(prestamo, c, hoy));
  if (!pendientes.length) return;
  const primera = pendientes[0];
  const saldo = Math.max(0, await saldoCapital(tx, prestamo, cuotas, hoy));
  const referencia =
    prestamo.sistemaInteres === 'capital_fijo' || !prestamo.tasaMensual
      ? primera.capital
      : (primera.capital ?? 0) + (primera.interes ?? 0);
  const plan =
    modo === 'reducir_plazo'
      ? planPorCuota(saldo, referencia, prestamo.tasaMensual, prestamo.sistemaInteres, prestamo.seguroMensual)
      : planPorNumero(saldo, pendientes.length, prestamo.tasaMensual, prestamo.sistemaInteres, prestamo.seguroMensual);
  const desdeFecha = primera.fechaVencimiento ?? primera.fecha;
  const porcentajes = prestamo.hogarId ? await porcentajesHogar(tx, prestamo) : null;
  await borrarCuotas(tx, prestamo, pendientes.map((c) => c.id));
  await crearCuotas(tx, prestamo, plan, primera.numeroCuota, desdeFecha, porcentajes);
  await tx.prestamo.update({
    where: { id: prestamo.id },
    data: { numeroCuotas: primera.numeroCuota - 1 + plan.length },
  });
}

// --- Vista ---

function vistaPrestamo(prestamo, cuotas, abonos, usuarioActual, hoy) {
  const pagadas = cuotas.filter((c) => estaPagada(prestamo, c, hoy));
  const pendientes = cuotas.filter((c) => !estaPagada(prestamo, c, hoy));
  const capitalPagado = pagadas.reduce((a, c) => a + (c.capital ?? 0), 0);
  const totalAbonos = abonos.reduce((a, b) => a + b.monto, 0);
  const saldo = Math.max(0, prestamo.saldoInicial - capitalPagado - totalAbonos);
  const proxima = pendientes[0] ?? null;
  const verMetodo = !prestamo.hogarId || prestamo.pagoUsuarioId === usuarioActual.id;

  // Mi parte (hogar): la de la próxima cuota, o la de la última si ya terminó.
  const referencia = proxima ?? cuotas.at(-1);
  const miPorcentaje = prestamo.hogarId
    ? referencia?.repartos?.length
      ? ((referencia.repartos.find((r) => r.usuarioId === usuarioActual.id)?.monto ?? 0) / montoCuota(referencia)) * 100
      : null
    : 100;

  return {
    ...prestamo,
    metodoPagoId: verMetodo ? prestamo.metodoPagoId : null,
    ambito: prestamo.hogarId ? 'hogar' : 'personal',
    saldoCapital: saldo,
    miPorcentaje,
    cuotasPagadas: prestamo.cuotasPrevias + pagadas.length,
    totalCuotas: prestamo.cuotasPrevias + cuotas.length,
    interesesPagados: pagadas.reduce((a, c) => a + (c.interes ?? 0) + (c.mora ?? 0), 0),
    interesesPendientes: pendientes.reduce((a, c) => a + (c.interes ?? 0), 0),
    totalPendiente: pendientes.reduce((a, c) => a + montoCuota(c), 0),
    atrasadas: pendientes.filter((c) => new Date(c.fecha) < hoy).length,
    proximaCuota: proxima ? { numero: proxima.numeroCuota, fecha: proxima.fecha, monto: montoCuota(proxima) } : null,
    terminaEn: cuotas.at(-1)?.fecha ?? null,
    terminado: saldo === 0 && !pendientes.length,
    cuotas: cuotas.map((c) => ({
      id: c.id,
      numero: c.numeroCuota,
      fecha: c.fecha,
      fechaVencimiento: c.fechaVencimiento ?? c.fecha,
      fechaPago: prestamo.hogarId ? c.fechaPago : c.estado === 'pagado' ? c.fecha : null,
      monto: montoCuota(c),
      capital: c.capital,
      interes: c.interes,
      seguro: c.seguro,
      mora: c.mora,
      estado: c.estado,
      pagada: estaPagada(prestamo, c, hoy),
      // Hogar: ya entró a un cuadre (no se puede deshacer el pago).
      enCuadre: ['en_cuadre', 'cuadrado'].includes(c.estado),
      pagoUsuarioId: c.pagoUsuarioId ?? null,
      miParte: prestamo.hogarId ? (c.repartos?.find((r) => r.usuarioId === usuarioActual.id)?.monto ?? 0) : montoCuota(c),
    })),
    abonos: abonos.map((a) => ({ ...a, metodoPagoId: verMetodo || a.pagoUsuarioId === usuarioActual.id ? a.metodoPagoId : null })),
  };
}

async function cargar(usuarioActual, prestamo) {
  const hoy = hoyUTC();
  const [cuotas, abonos, pagador] = await Promise.all([
    cuotasDe(prisma, prestamo),
    prisma.prestamoAbono.findMany({ where: { prestamoId: prestamo.id }, orderBy: { fecha: 'asc' } }),
    prestamo.pagoUsuarioId
      ? prisma.usuario.findUnique({ where: { id: prestamo.pagoUsuarioId }, select: { id: true, nombre: true } })
      : null,
  ]);
  return { ...vistaPrestamo(prestamo, cuotas, abonos, usuarioActual, hoy), pagador };
}

/**
 * Préstamos del usuario: los personales y los de su hogar, con saldo, cuotas
 * y un orden sugerido de pago (avalancha: primero la tasa más alta).
 */
export async function listarPrestamos(usuarioActual) {
  await pagarCuotasAutomaticasPrestamos(usuarioActual.id);
  const prestamos = await prisma.prestamo.findMany({
    where: {
      OR: [
        { usuarioId: usuarioActual.id, hogarId: null },
        ...(usuarioActual.hogarId ? [{ hogarId: usuarioActual.hogarId }] : []),
      ],
    },
    orderBy: { creadoEn: 'asc' },
  });
  const vistas = await Promise.all(prestamos.map((p) => cargar(usuarioActual, p)));
  const personales = vistas.filter((p) => p.ambito === 'personal');
  const hogar = vistas.filter((p) => p.ambito === 'hogar');
  const activos = vistas.filter((p) => !p.terminado);
  return {
    personales,
    hogar,
    resumen: {
      deudaPersonal: personales.reduce((a, p) => a + p.saldoCapital, 0),
      deudaHogar: hogar.reduce((a, p) => a + p.saldoCapital, 0),
      miParteHogar: Math.round(hogar.reduce((a, p) => a + (p.saldoCapital * (p.miPorcentaje ?? 0)) / 100, 0)),
      interesesPendientes: activos.reduce((a, p) => a + p.interesesPendientes, 0),
      ordenSugerido: [...activos]
        .sort((a, b) => b.tasaMensual - a.tasaMensual || a.saldoCapital - b.saldoCapital)
        .map((p) => ({ id: p.id, nombre: p.nombre, ambito: p.ambito, tasaMensual: p.tasaMensual, saldoCapital: p.saldoCapital })),
    },
  };
}

/** Personal automático: cuotas con fecha cumplida pasan a pagadas (sin cron, al consultar). */
async function pagarCuotasAutomaticasPrestamos(usuarioId) {
  await prisma.gastoPersonal.updateMany({
    where: { usuarioId, estado: 'pendiente', fecha: { lte: hoyUTC() }, prestamo: { modoCobro: 'automatico' } },
    data: { estado: 'pagado' },
  });
}

export async function obtenerPrestamo(usuarioActual, id) {
  return cargar(usuarioActual, await requirePrestamo(usuarioActual, id));
}

// --- Crear / editar / eliminar ---

export async function crearPrestamo(usuarioActual, data) {
  const esHogar = data.ambito === 'hogar';
  const hogarId = esHogar ? requireHogarId(usuarioActual) : null;
  if (esHogar) {
    requirePermisoEdicion(usuarioActual);
    await requireMiembro(hogarId, data.pagoUsuarioId);
    if (data.metodoPagoId && data.pagoUsuarioId !== usuarioActual.id) {
      throw new HttpError(400, 'Solo puedes asociar uno de tus métodos de pago a un préstamo que pagas tú');
    }
  }
  await requireMetodoPropio(usuarioActual.id, data.metodoPagoId);
  if (data.categoriaId && !esHogar) {
    const cat = await prisma.categoriaPersonal.findUnique({ where: { id: data.categoriaId } });
    if (!cat || cat.usuarioId !== usuarioActual.id) throw new HttpError(400, 'Categoría no encontrada');
  }
  if (data.desembolso?.metodoPagoId) await requireMetodoPropio(usuarioActual.id, data.desembolso.metodoPagoId);

  const enCurso = Boolean(data.enCurso);
  const saldoInicial = enCurso ? data.saldoActual : data.montoPrestado;
  const cuotasPrevias = enCurso ? (data.cuotasPagadas ?? 0) : 0;
  const restantes = enCurso ? data.cuotasRestantes : data.plazoMeses;
  if (!saldoInicial || !restantes) throw new HttpError(400, 'Falta el saldo o el número de cuotas');
  const tasaMensual = tasaMensualDe(data.tasa ?? 0, data.tasaEsAnual);

  const prestamo = await prisma.$transaction(
    async (tx) => {
      let desembolsoIngresoId = null;
      // El dinero que llegó a una cuenta (solo personal y préstamo nuevo): sube
      // el Disponible pero no es ingreso real (no cuenta en informes/Límites).
      if (!esHogar && !enCurso && data.desembolso) {
        const ingreso = await tx.ingresoPersonal.create({
          data: {
            usuarioId: usuarioActual.id,
            monto: data.montoPrestado,
            fecha: data.desembolso.fecha ?? data.fechaDesembolso ?? hoyUTC(),
            descripcion: `Desembolso · ${data.nombre}`,
            estado: 'recibido',
            metodoPagoId: data.desembolso.metodoPagoId ?? null,
            origen: 'desembolso_prestamo',
          },
        });
        desembolsoIngresoId = ingreso.id;
      }
      const nuevo = await tx.prestamo.create({
        data: {
          usuarioId: usuarioActual.id,
          hogarId,
          nombre: data.nombre,
          entidad: data.entidad || null,
          tipo: data.tipo ?? 'otro',
          montoPrestado: data.montoPrestado ?? saldoInicial,
          saldoInicial,
          cuotasPrevias,
          numeroCuotas: cuotasPrevias + restantes,
          tasaMensual,
          tasaIngresada: data.tasa ?? 0,
          tasaEsAnual: Boolean(data.tasaEsAnual),
          sistemaInteres: data.sistemaInteres ?? 'cuota_fija',
          seguroMensual: data.seguroMensual ?? 0,
          fechaDesembolso: data.fechaDesembolso ?? null,
          fechaPrimeraCuota: data.fechaPrimeraCuota,
          modoCobro: data.modoCobro ?? 'manual',
          metodoPagoId: data.metodoPagoId ?? null,
          pagoUsuarioId: esHogar ? data.pagoUsuarioId : null,
          categoriaId: esHogar ? null : (data.categoriaId ?? null),
          desembolsoIngresoId,
        },
      });
      const plan = planPorNumero(saldoInicial, restantes, tasaMensual, nuevo.sistemaInteres, nuevo.seguroMensual);
      const porcentajes = esHogar ? await porcentajesHogar(tx, nuevo) : null;
      await crearCuotas(tx, nuevo, plan, cuotasPrevias + 1, data.fechaPrimeraCuota, porcentajes);
      return nuevo;
    },
    { timeout: 120000, maxWait: 20000 },
  );
  if (!esHogar) await evaluarPagadas(prestamo);
  return cargar(usuarioActual, prestamo);
}

/** Las cuotas obligatorias ya pagadas pueden completar los obligatorios de su período (Ahorros). */
async function evaluarPagadas(prestamo) {
  const pagadas = await prisma.gastoPersonal.findMany({
    where: { prestamoId: prestamo.id, estado: 'pagado' },
    select: { fecha: true, fechaVencimiento: true },
  });
  for (const c of pagadas) {
    await evaluarPeriodoSiCorresponde(prestamo.usuarioId, c.fechaVencimiento ?? c.fecha);
    await evaluarPeriodoSiCorresponde(prestamo.usuarioId, c.fecha);
  }
}

/**
 * Edita datos que no cambian el plan: nombre, entidad, tipo, categoría,
 * cuenta, cómo se paga y (hogar) quién paga. Se aplican a las cuotas sin pagar.
 */
export async function actualizarPrestamo(usuarioActual, id, data) {
  const prestamo = await requirePrestamo(usuarioActual, id, { editar: true });
  if (!prestamo.hogarId && prestamo.usuarioId !== usuarioActual.id) throw new HttpError(404, 'Préstamo no encontrado');
  const pagoUsuarioId = prestamo.hogarId ? (data.pagoUsuarioId ?? prestamo.pagoUsuarioId) : null;
  if (prestamo.hogarId && data.pagoUsuarioId) await requireMiembro(prestamo.hogarId, data.pagoUsuarioId);

  // Cuenta: privada de quien paga. Si cambia quien paga, la anterior se quita.
  let metodoPagoId = prestamo.metodoPagoId;
  if (pagoUsuarioId !== prestamo.pagoUsuarioId) metodoPagoId = null;
  if (data.metodoPagoId !== undefined) {
    if (prestamo.hogarId && pagoUsuarioId !== usuarioActual.id) {
      throw new HttpError(400, 'Solo quien paga el préstamo puede asociarle su cuenta');
    }
    await requireMetodoPropio(usuarioActual.id, data.metodoPagoId);
    metodoPagoId = data.metodoPagoId;
  }
  if (data.categoriaId && !prestamo.hogarId) {
    const cat = await prisma.categoriaPersonal.findUnique({ where: { id: data.categoriaId } });
    if (!cat || cat.usuarioId !== usuarioActual.id) throw new HttpError(400, 'Categoría no encontrada');
  }

  const datos = {
    nombre: data.nombre ?? prestamo.nombre,
    entidad: data.entidad === undefined ? prestamo.entidad : data.entidad || null,
    tipo: data.tipo ?? prestamo.tipo,
    categoriaId: prestamo.hogarId ? null : data.categoriaId === undefined ? prestamo.categoriaId : data.categoriaId,
    modoCobro: data.modoCobro ?? prestamo.modoCobro,
    pagoUsuarioId,
    metodoPagoId,
  };

  await prisma.$transaction(
    async (tx) => {
      const actualizado = await tx.prestamo.update({ where: { id }, data: datos });
      const hoy = hoyUTC();
      const cuotas = await cuotasDe(tx, actualizado);
      const sinPagar = cuotas.filter((c) => esRecalculable(actualizado, c, hoy));
      if (!actualizado.hogarId) {
        await tx.gastoPersonal.updateMany({ where: { prestamoId: id }, data: { descripcion: datos.nombre, categoriaId: datos.categoriaId } });
        await tx.gastoPersonal.updateMany({
          where: { id: { in: sinPagar.map((c) => c.id) } },
          data: { metodoPagoId: datos.metodoPagoId },
        });
      } else {
        await tx.gastoVariablePareja.updateMany({ where: { prestamoId: id }, data: { item: datos.nombre } });
        await tx.gastoVariablePareja.updateMany({
          where: { id: { in: sinPagar.map((c) => c.id) } },
          data: {
            pagoUsuarioId: datos.pagoUsuarioId,
            metodoPagoId: datos.metodoPagoId,
            // Automático: nacen pagadas (entran al saldo en su fecha); manual: por pagar.
            estado: datos.modoCobro === 'automatico' ? 'pagado' : 'por_pagar',
          },
        });
        for (const c of cuotas) await sincronizarPagoGasto(tx, c.id);
      }
    },
    { timeout: 120000, maxWait: 20000 },
  );
  if (!prestamo.hogarId) await pagarCuotasAutomaticasPrestamos(prestamo.usuarioId);
  return obtenerPrestamo(usuarioActual, id);
}

/** Elimina un préstamo mientras no tenga cuotas pagadas ni abonos. */
export async function eliminarPrestamo(usuarioActual, id) {
  const prestamo = await requirePrestamo(usuarioActual, id, { editar: true });
  if (!prestamo.hogarId && prestamo.usuarioId !== usuarioActual.id) throw new HttpError(404, 'Préstamo no encontrado');
  const hoy = hoyUTC();
  const cuotas = await cuotasDe(prisma, prestamo);
  const abonos = await prisma.prestamoAbono.count({ where: { prestamoId: id } });
  if (abonos || cuotas.some((c) => estaPagada(prestamo, c, hoy) || ['en_cuadre', 'cuadrado'].includes(c.estado))) {
    throw new HttpError(409, 'Este préstamo ya tiene cuotas pagadas o abonos: no se puede eliminar');
  }
  await prisma.$transaction(
    async (tx) => {
      await borrarCuotas(tx, prestamo, cuotas.map((c) => c.id));
      await tx.prestamo.delete({ where: { id } });
      if (prestamo.desembolsoIngresoId) await tx.ingresoPersonal.delete({ where: { id: prestamo.desembolsoIngresoId } });
    },
    { timeout: 120000, maxWait: 20000 },
  );
}

// --- Pagar / deshacer una cuota ---

async function requireCuota(tx, prestamo, numero) {
  const where = { prestamoId_numeroCuota: { prestamoId: prestamo.id, numeroCuota: numero } };
  const cuota = prestamo.hogarId
    ? await tx.gastoVariablePareja.findUnique({ where, include: { repartos: true } })
    : await tx.gastoPersonal.findUnique({ where });
  if (!cuota) throw new HttpError(404, 'Cuota no encontrada');
  return cuota;
}

/**
 * "Lo pagué": fecha real de pago, cuenta y valor. Si se pagó más que la
 * cuota, la diferencia queda como mora (interés de mora). Hogar: también quién pagó.
 */
export async function pagarCuota(usuarioActual, id, numero, data) {
  const prestamo = await requirePrestamo(usuarioActual, id, { editar: true });
  const hoy = hoyUTC();
  const fechaPago = data.fecha ?? hoy;
  if (fechaPago > hoy) throw new HttpError(400, 'La fecha de pago no puede ser futura');

  if (!prestamo.hogarId) {
    const cuota = await requireCuota(prisma, prestamo, numero);
    if (cuota.estado === 'pagado') throw new HttpError(409, 'Esta cuota ya está pagada');
    await requireMetodoPropio(usuarioActual.id, data.metodoPagoId);
    const base = cuota.monto - (cuota.mora ?? 0);
    const monto = data.monto ?? base;
    if (monto < base) throw new HttpError(400, `El valor no puede ser menor que la cuota (${base})`);
    await prisma.gastoPersonal.update({
      where: { id: cuota.id },
      data: {
        estado: 'pagado',
        fecha: fechaPago,
        monto,
        mora: monto > base ? monto - base : null,
        metodoPagoId: data.metodoPagoId === undefined ? cuota.metodoPagoId : data.metodoPagoId,
      },
    });
    await evaluarPeriodoSiCorresponde(prestamo.usuarioId, cuota.fechaVencimiento ?? cuota.fecha);
    await evaluarPeriodoSiCorresponde(prestamo.usuarioId, fechaPago);
    return obtenerPrestamo(usuarioActual, id);
  }

  const pagoUsuarioId = data.pagoUsuarioId ?? prestamo.pagoUsuarioId ?? usuarioActual.id;
  await requireMiembro(prestamo.hogarId, pagoUsuarioId);
  if (data.metodoPagoId && pagoUsuarioId !== usuarioActual.id) {
    throw new HttpError(400, 'Solo quien paga puede indicar su cuenta');
  }
  await requireMetodoPropio(usuarioActual.id, data.metodoPagoId);
  await prisma.$transaction(
    async (tx) => {
      const cuota = await requireCuota(tx, prestamo, numero);
      if (cuota.estado !== 'por_pagar') throw new HttpError(409, 'Esta cuota ya está pagada');
      const base = cuota.valorTotal - (cuota.mora ?? 0);
      const monto = data.monto ?? base;
      if (monto < base) throw new HttpError(400, `El valor no puede ser menor que la cuota (${base})`);
      if (monto !== cuota.valorTotal) {
        const porcentajes = cuota.repartos.map((r) => ({ usuarioId: r.usuarioId, porcentaje: (r.monto / cuota.valorTotal) * 100 }));
        await tx.gastoVariableParejaReparto.deleteMany({ where: { gastoId: cuota.id } });
        await tx.gastoVariableParejaReparto.createMany({
          data: calcularReparto(monto, porcentajes).map((r) => ({ gastoId: cuota.id, ...r })),
        });
      }
      await tx.gastoVariablePareja.update({
        where: { id: cuota.id },
        data: {
          estado: 'pagado',
          fechaPago,
          valorTotal: monto,
          mora: monto > base ? monto - base : null,
          pagoUsuarioId,
          metodoPagoId:
            pagoUsuarioId === usuarioActual.id
              ? (data.metodoPagoId ?? (prestamo.pagoUsuarioId === pagoUsuarioId ? prestamo.metodoPagoId : null))
              : null,
        },
      });
      await sincronizarPagoGasto(tx, cuota.id);
    },
    { timeout: 120000, maxWait: 20000 },
  );
  return obtenerPrestamo(usuarioActual, id);
}

/** Deshace "Lo pagué" (vuelve a la fecha y el valor de la cuota). No si ya entró a un cuadre. */
export async function deshacerPagoCuota(usuarioActual, id, numero) {
  const prestamo = await requirePrestamo(usuarioActual, id, { editar: true });
  if (prestamo.modoCobro === 'automatico') {
    throw new HttpError(409, 'Este préstamo se paga automático: cambia a manual para deshacer pagos');
  }
  await prisma.$transaction(
    async (tx) => {
      const cuota = await requireCuota(tx, prestamo, numero);
      if (!prestamo.hogarId) {
        if (cuota.estado !== 'pagado') throw new HttpError(409, 'Esta cuota no está pagada');
        await tx.gastoPersonal.update({
          where: { id: cuota.id },
          data: {
            estado: 'pendiente',
            fecha: cuota.fechaVencimiento ?? cuota.fecha,
            monto: cuota.monto - (cuota.mora ?? 0),
            mora: null,
          },
        });
        return;
      }
      if (cuota.estado !== 'pagado') throw new HttpError(409, 'Esta cuota no está pagada o ya está en un cuadre');
      const base = cuota.valorTotal - (cuota.mora ?? 0);
      if (cuota.mora) {
        const porcentajes = cuota.repartos.map((r) => ({ usuarioId: r.usuarioId, porcentaje: (r.monto / cuota.valorTotal) * 100 }));
        await tx.gastoVariableParejaReparto.deleteMany({ where: { gastoId: cuota.id } });
        await tx.gastoVariableParejaReparto.createMany({
          data: calcularReparto(base, porcentajes).map((r) => ({ gastoId: cuota.id, ...r })),
        });
      }
      await tx.gastoVariablePareja.update({
        where: { id: cuota.id },
        data: { estado: 'por_pagar', fechaPago: null, valorTotal: base, mora: null },
      });
      await sincronizarPagoGasto(tx, cuota.id);
    },
    { timeout: 120000, maxWait: 20000 },
  );
  return obtenerPrestamo(usuarioActual, id);
}

// --- Abonos extra a capital ---

export async function abonar(usuarioActual, id, data) {
  const prestamo = await requirePrestamo(usuarioActual, id, { editar: true });
  const hoy = hoyUTC();
  const fecha = data.fecha ?? hoy;
  if (fecha > hoy) throw new HttpError(400, 'La fecha del abono no puede ser futura');
  const cuotas = await cuotasDe(prisma, prestamo);
  const saldo = await saldoCapital(prisma, prestamo, cuotas, hoy);
  if (data.monto > saldo) throw new HttpError(400, `El abono no puede ser mayor que el saldo de capital (${saldo})`);

  const pagoUsuarioId = prestamo.hogarId ? (data.pagoUsuarioId ?? usuarioActual.id) : null;
  if (prestamo.hogarId) await requireMiembro(prestamo.hogarId, pagoUsuarioId);
  if (data.metodoPagoId && prestamo.hogarId && pagoUsuarioId !== usuarioActual.id) {
    throw new HttpError(400, 'Solo quien paga puede indicar su cuenta');
  }
  await requireMetodoPropio(usuarioActual.id, data.metodoPagoId);

  await prisma.$transaction(
    async (tx) => {
      const abono = await tx.prestamoAbono.create({
        data: {
          prestamoId: id,
          fecha,
          monto: data.monto,
          modo: data.modo,
          metodoPagoId: data.metodoPagoId ?? null,
          pagoUsuarioId,
        },
      });
      const descripcion = `Abono a capital · ${prestamo.nombre}`;
      if (!prestamo.hogarId) {
        await tx.gastoPersonal.create({
          data: {
            usuarioId: prestamo.usuarioId,
            monto: data.monto,
            fecha,
            descripcion,
            estado: 'pagado',
            esObligatorio: false,
            metodoPagoId: data.metodoPagoId ?? null,
            origen: 'abono_prestamo',
            abonoPrestamoId: abono.id,
          },
        });
      } else {
        const porcentajes = await porcentajesHogar(tx, prestamo);
        const gasto = await tx.gastoVariablePareja.create({
          data: {
            hogarId: prestamo.hogarId,
            item: descripcion,
            valorTotal: data.monto,
            pagoUsuarioId,
            metodoPagoId: data.metodoPagoId ?? null,
            fecha,
            estado: 'pagado',
            abonoPrestamoId: abono.id,
          },
        });
        await tx.gastoVariableParejaReparto.createMany({
          data: calcularReparto(data.monto, porcentajes).map((r) => ({ gastoId: gasto.id, ...r })),
        });
        await sincronizarPagoGasto(tx, gasto.id);
      }
      await recalcularPendientes(tx, prestamo, data.modo);
    },
    { timeout: 120000, maxWait: 20000 },
  );
  return obtenerPrestamo(usuarioActual, id);
}

/** Quita un abono (y su movimiento) y recalcula las cuotas sin pagar con el mismo criterio. No si ya entró a un cuadre. */
export async function eliminarAbono(usuarioActual, id, abonoId) {
  const prestamo = await requirePrestamo(usuarioActual, id, { editar: true });
  const abono = await prisma.prestamoAbono.findUnique({ where: { id: abonoId }, include: { gastoHogar: true } });
  if (!abono || abono.prestamoId !== id) throw new HttpError(404, 'Abono no encontrado');
  if (['en_cuadre', 'cuadrado'].includes(abono.gastoHogar?.estado)) {
    throw new HttpError(409, 'Este abono ya está en un cuadre: no se puede quitar');
  }
  await prisma.$transaction(
    async (tx) => {
      if (abono.gastoHogar) {
        await tx.gastoVariableParejaReparto.deleteMany({ where: { gastoId: abono.gastoHogar.id } });
        await tx.gastoVariablePareja.delete({ where: { id: abono.gastoHogar.id } });
      }
      // El GastoPersonal del abono se borra en cascada.
      await tx.prestamoAbono.delete({ where: { id: abonoId } });
      await recalcularPendientes(tx, prestamo, abono.modo);
    },
    { timeout: 120000, maxWait: 20000 },
  );
  return obtenerPrestamo(usuarioActual, id);
}

/** Para el patrimonio: capital que debo en mis préstamos + mi parte de los del hogar. */
export async function deudaPrestamosDe(usuarioActual) {
  const { resumen } = await listarPrestamos(usuarioActual);
  return resumen.deudaPersonal + resumen.miParteHogar;
}
