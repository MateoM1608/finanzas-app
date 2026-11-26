import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { hoyUTC } from '../../utils/fechas.js';
import { corteDelMes, corteQueIncluye, moverCorte, rangoCiclo, enRango } from '../../utils/ciclosTarjeta.js';

/**
 * Extractos de tarjeta (entrega C2). Para cada ciclo de corte la app arma
 * el "extracto esperado" con lo que tiene registrado en esa tarjeta, y el
 * usuario lo compara con el del banco: copia el total que cobra el banco y
 * registra ajustes:
 * - correccion: el banco cobró otro valor por un cargo de la app (se cambia
 *   el valor del gasto; al quitar el ajuste vuelve el valor anterior).
 * - cargo: algo que la app no tenía (interés, cuota de manejo, seguro…):
 *   crea un gasto con la tarjeta en la fecha de corte.
 * - no_reconocido: un cargo del banco que el usuario no reconoce (reclamo):
 *   no crea gasto; al resolverlo queda reversado o, si era válido,
 *   aceptado (entonces sí crea el gasto).
 * - no_cobrado: la app lo esperaba y el banco no lo cobró en este extracto.
 * Todo es privado del usuario y se filtra por usuarioId en cada consulta.
 */

const CICLOS_LISTADOS = 6;

export const ETIQUETA_CONCEPTO = {
  interes: 'Intereses',
  mora: 'Interés de mora',
  cuota_manejo: 'Cuota de manejo',
  seguro: 'Seguro',
  comision: 'Comisión',
  avance: 'Avance',
  otro: 'Otro cargo',
};

const SELECT_CARGO = {
  id: true,
  fecha: true,
  monto: true,
  montoUsd: true,
  capital: true,
  interes: true,
  descripcion: true,
  estado: true,
  origen: true,
  compraId: true,
  numeroCuota: true,
  pagoCuotaHogarId: true,
  pagoGastoHogarId: true,
  categoria: { select: { nombre: true } },
  compra: { select: { descripcion: true, numeroCuotas: true } },
  pagoGastoHogar: { select: { item: true, compraId: true, numeroCuota: true, compra: { select: { numeroCuotas: true } } } },
  pagoCuotaHogar: { select: { concepto: { select: { nombre: true } } } },
  ajustesExtracto: { select: { id: true, tipo: true, extractoId: true } },
};

function aFecha(texto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto ?? '')) throw new HttpError(400, 'Fecha de corte inválida');
  const [a, m, d] = texto.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

async function requireTarjeta(usuarioId, metodoId) {
  const metodo = await prisma.metodoPagoPersonal.findUnique({ where: { id: metodoId } });
  if (!metodo || metodo.usuarioId !== usuarioId) throw new HttpError(404, 'Método de pago no encontrado');
  if (metodo.tipo !== 'tarjeta_credito') throw new HttpError(400, 'Los extractos son solo de tarjetas de crédito');
  if (!metodo.diaCorte) {
    throw new HttpError(400, 'Configura el día de corte de la tarjeta para revisar sus extractos');
  }
  return metodo;
}

/** Cargos de la tarjeta entre dos fechas (con margen para las cuotas). */
function cargosEntre(usuarioId, metodoId, desde, hasta) {
  return prisma.gastoPersonal.findMany({
    where: {
      usuarioId,
      metodoPagoId: metodoId,
      origen: { not: 'pago_tarjeta' },
      fecha: { gt: desde, lte: hasta },
    },
    select: SELECT_CARGO,
    orderBy: { fecha: 'asc' },
  });
}

function esCuota(c) {
  return Boolean(c.compraId || c.pagoGastoHogar?.compraId);
}

function describirCargo(c) {
  if (c.compra) return `${c.compra.descripcion} · cuota ${c.numeroCuota}/${c.compra.numeroCuotas}`;
  if (c.pagoGastoHogar?.compraId) {
    return `${c.pagoGastoHogar.item} · cuota ${c.pagoGastoHogar.numeroCuota}/${c.pagoGastoHogar.compra?.numeroCuotas ?? '?'}`;
  }
  if (c.pagoGastoHogar) return c.pagoGastoHogar.item;
  if (c.pagoCuotaHogar) return c.pagoCuotaHogar.concepto?.nombre ?? 'Cuenta del hogar';
  return c.descripcion || c.categoria?.nombre || 'Gasto';
}

/** Cargos de la app que entran en el extracto de ese ciclo. */
function lineasDelCiclo(cargos, ciclo) {
  return cargos
    .filter((c) => enRango(c.fecha, esCuota(c) ? ciclo.cuotas : ciclo.compras))
    .map((c) => {
      const delHogar = Boolean(c.pagoCuotaHogarId || c.pagoGastoHogarId);
      const ajusteCargo = c.ajustesExtracto.find((a) => a.tipo === 'cargo' || a.tipo === 'no_reconocido');
      return {
        id: c.id,
        fecha: c.fecha,
        descripcion: describirCargo(c),
        monto: c.monto,
        // Cargo en dólares (centavos): va en la parte en dólares del extracto.
        montoUsd: c.montoUsd ?? null,
        interes: c.interes ?? 0,
        estado: c.estado,
        tipo: ajusteCargo ? 'ajuste' : esCuota(c) ? 'cuota' : 'compra',
        delHogar,
        // Un movimiento del hogar refleja el 100 % del gasto del hogar: su
        // valor se cambia desde Hogar, no desde el extracto.
        // Uno en dólares se corrige desde el gasto (sus US$ y su tasa).
        corregible: !delHogar && !ajusteCargo && !c.montoUsd,
        ajusteIds: c.ajustesExtracto.map((a) => a.id),
      };
    });
}

/**
 * Totales del extracto, separados como los del banco: la parte en pesos
 * (cargos sin dólares, ajustes y reclamos, que son en pesos) y la parte en
 * dólares (centavos de US$).
 */
function totales(lineas, extracto) {
  const ajustes = extracto?.ajustes ?? [];
  const enPesos = lineas.filter((l) => l.montoUsd == null);
  const enUsd = lineas.filter((l) => l.montoUsd != null);
  const esperado = enPesos.reduce((acc, l) => acc + l.monto, 0);
  const esperadoUsd = enUsd.reduce((acc, l) => acc + l.montoUsd, 0);
  const idsNoCobrados = new Set(ajustes.filter((a) => a.tipo === 'no_cobrado').map((a) => a.gastoId));
  const noCobrado = enPesos.filter((l) => idsNoCobrados.has(l.id)).reduce((acc, l) => acc + l.monto, 0);
  const noCobradoUsd = enUsd.filter((l) => idsNoCobrados.has(l.id)).reduce((acc, l) => acc + l.montoUsd, 0);
  // Reclamos que el banco cobró y la app no tiene (los aceptados ya son un gasto en `esperado`).
  const reclamos = ajustes
    .filter((a) => a.tipo === 'no_reconocido' && a.estadoReclamo !== 'aceptado')
    .reduce((acc, a) => acc + (a.monto ?? 0), 0);
  const totalBanco = extracto?.totalBanco ?? null;
  const totalBancoUsd = extracto?.totalBancoUsd ?? null;
  return {
    esperado,
    noCobrado,
    reclamos,
    totalBanco,
    // Lo que queda sin explicar: positivo = el banco cobró de más.
    diferencia: totalBanco == null ? null : totalBanco - (esperado - noCobrado) - reclamos,
    esperadoUsd,
    noCobradoUsd,
    totalBancoUsd,
    diferenciaUsd: totalBancoUsd == null ? null : totalBancoUsd - (esperadoUsd - noCobradoUsd),
  };
}

function cicloEnCurso(metodo, hoy) {
  return corteQueIncluye(hoy, metodo.diaCorte);
}

/** Ciclos recientes de la tarjeta (el en curso y los anteriores) con su estado. */
export async function listarCiclos(usuarioActual, metodoId) {
  const usuarioId = usuarioActual.id;
  const metodo = await requireTarjeta(usuarioId, metodoId);
  const hoy = hoyUTC();
  const actual = cicloEnCurso(metodo, hoy);

  const cortes = Array.from({ length: CICLOS_LISTADOS }, (_, i) => moverCorte(actual, -i, metodo.diaCorte));
  const extractos = await prisma.extractoTarjeta.findMany({
    where: { usuarioId, metodoPagoId: metodoId },
    include: { ajustes: true },
    orderBy: { fechaCorte: 'desc' },
  });
  // Extractos de cortes viejos (o de otro día de corte) que no están en la lista.
  for (const e of extractos) {
    if (!cortes.some((c) => c.getTime() === e.fechaCorte.getTime())) cortes.push(e.fechaCorte);
  }
  cortes.sort((a, b) => b - a);

  const ciclos = cortes.map((c) => rangoCiclo(c, metodo));
  const desde = new Date(Math.min(...ciclos.map((c) => Math.min(c.compras.desde, c.cuotas.desde))));
  const hasta = new Date(Math.max(...ciclos.map((c) => Math.max(c.compras.hasta, c.cuotas.hasta))));
  const cargos = await cargosEntre(usuarioId, metodoId, desde, hasta);

  const reclamosPendientes = [];
  const lista = ciclos.map((ciclo) => {
    const extracto = extractos.find((e) => e.fechaCorte.getTime() === ciclo.fechaCorte.getTime()) ?? null;
    const lineas = lineasDelCiclo(cargos, ciclo);
    for (const a of extracto?.ajustes ?? []) {
      if (a.tipo === 'no_reconocido' && a.estadoReclamo === 'pendiente') {
        reclamosPendientes.push({ ...a, fechaCorte: ciclo.fechaCorte });
      }
    }
    return {
      fechaCorte: ciclo.fechaCorte,
      fechaPago: ciclo.fechaPago,
      enCurso: ciclo.fechaCorte >= hoy,
      cargos: lineas.length,
      estado: extracto?.estado ?? null,
      ...totales(lineas, extracto),
    };
  });
  return { metodo, ciclos: lista, reclamosPendientes };
}

async function cicloValido(usuarioId, metodo, fechaTexto) {
  const fechaCorte = aFecha(fechaTexto);
  const extracto = await prisma.extractoTarjeta.findUnique({
    where: { metodoPagoId_fechaCorte: { metodoPagoId: metodo.id, fechaCorte } },
    include: { ajustes: { orderBy: { creadoEn: 'asc' } } },
  });
  if (extracto && extracto.usuarioId !== usuarioId) throw new HttpError(404, 'Extracto no encontrado');
  if (!extracto && corteDelMes(fechaCorte, metodo.diaCorte).getTime() !== fechaCorte.getTime()) {
    throw new HttpError(400, 'Esa fecha no es un corte de esta tarjeta');
  }
  return { ciclo: rangoCiclo(fechaCorte, metodo), extracto };
}

async function detalle(usuarioId, metodo, ciclo, extracto) {
  const desde = new Date(Math.min(ciclo.compras.desde, ciclo.cuotas.desde));
  const hasta = new Date(Math.max(ciclo.compras.hasta, ciclo.cuotas.hasta));
  const cargos = await cargosEntre(usuarioId, metodo.id, desde, hasta);
  const lineas = lineasDelCiclo(cargos, ciclo);
  return {
    metodo,
    ciclo: {
      fechaCorte: ciclo.fechaCorte,
      corteAnterior: ciclo.corteAnterior,
      fechaPago: ciclo.fechaPago,
      enCurso: ciclo.fechaCorte >= hoyUTC(),
    },
    lineas,
    extracto,
    totales: totales(lineas, extracto),
  };
}

export async function obtenerCiclo(usuarioActual, metodoId, fechaTexto) {
  const metodo = await requireTarjeta(usuarioActual.id, metodoId);
  const { ciclo, extracto } = await cicloValido(usuarioActual.id, metodo, fechaTexto);
  return detalle(usuarioActual.id, metodo, ciclo, extracto);
}

async function asegurarExtracto(usuarioId, metodo, ciclo, extracto) {
  if (extracto) return extracto;
  return prisma.extractoTarjeta.create({
    data: { usuarioId, metodoPagoId: metodo.id, fechaCorte: ciclo.fechaCorte, fechaPago: ciclo.fechaPago },
    include: { ajustes: true },
  });
}

function requireAbierto(extracto) {
  if (extracto?.estado === 'revisado') {
    throw new HttpError(409, 'Este extracto ya está revisado: reábrelo para cambiarlo');
  }
}

/** Guarda el total que cobra el banco y las notas del extracto. */
export async function guardarExtracto(usuarioActual, metodoId, fechaTexto, data) {
  const usuarioId = usuarioActual.id;
  const metodo = await requireTarjeta(usuarioId, metodoId);
  const { ciclo, extracto: actual } = await cicloValido(usuarioId, metodo, fechaTexto);
  requireAbierto(actual);
  const extracto = await asegurarExtracto(usuarioId, metodo, ciclo, actual);
  await prisma.extractoTarjeta.update({
    where: { id: extracto.id },
    data: {
      ...(data.totalBanco !== undefined && { totalBanco: data.totalBanco }),
      ...(data.totalBancoUsd !== undefined && { totalBancoUsd: data.totalBancoUsd }),
      ...(data.notas !== undefined && { notas: data.notas || null }),
    },
  });
  return obtenerCiclo(usuarioActual, metodoId, fechaTexto);
}

/** Marca el extracto revisado (guarda lo esperado a esa fecha) o lo reabre. */
export async function revisarExtracto(usuarioActual, metodoId, fechaTexto, revisado) {
  const usuarioId = usuarioActual.id;
  const metodo = await requireTarjeta(usuarioId, metodoId);
  const { ciclo, extracto: actual } = await cicloValido(usuarioId, metodo, fechaTexto);
  if (revisado) {
    if (actual?.totalBanco == null) throw new HttpError(400, 'Escribe primero el total que cobra el banco');
    const { totales: t } = await detalle(usuarioId, metodo, ciclo, actual);
    await prisma.extractoTarjeta.update({
      where: { id: actual.id },
      data: {
        estado: 'revisado',
        totalEsperado: t.esperado,
        totalEsperadoUsd: t.esperadoUsd || null,
        revisadoEn: new Date(),
      },
    });
  } else if (actual) {
    await prisma.extractoTarjeta.update({
      where: { id: actual.id },
      data: { estado: 'pendiente', totalEsperado: null, totalEsperadoUsd: null, revisadoEn: null },
    });
  }
  return obtenerCiclo(usuarioActual, metodoId, fechaTexto);
}

function datosGastoCargo(usuarioId, metodo, fecha, monto, descripcion, categoriaId) {
  return {
    usuarioId,
    monto,
    fecha,
    descripcion,
    estado: 'pagado',
    esObligatorio: false,
    metodoPagoId: metodo.id,
    categoriaId: categoriaId ?? null,
    origen: 'app',
  };
}

/** Agrega un ajuste al extracto de ese ciclo. */
export async function agregarAjuste(usuarioActual, metodoId, fechaTexto, data) {
  const usuarioId = usuarioActual.id;
  const metodo = await requireTarjeta(usuarioId, metodoId);
  const { ciclo, extracto: actual } = await cicloValido(usuarioId, metodo, fechaTexto);
  requireAbierto(actual);

  if (data.categoriaId) {
    const categoria = await prisma.categoriaPersonal.findUnique({ where: { id: data.categoriaId } });
    if (!categoria || categoria.usuarioId !== usuarioId) throw new HttpError(400, 'Categoría no encontrada');
  }

  // Ajustes sobre un cargo de la app: tiene que ser una línea de este ciclo.
  let linea = null;
  if (data.tipo === 'correccion' || data.tipo === 'no_cobrado') {
    const { lineas } = await detalle(usuarioId, metodo, ciclo, actual);
    linea = lineas.find((l) => l.id === data.gastoId);
    if (!linea) throw new HttpError(400, 'Ese cargo no está en este extracto');
    if (data.tipo === 'correccion' && !linea.corregible) {
      throw new HttpError(
        409,
        linea.delHogar
          ? 'Este cargo es un pago del hogar: cambia su valor desde Hogar, o registra la diferencia como cargo extra'
          : linea.montoUsd != null
            ? 'Este cargo es en dólares: cambia sus US$ o su tasa desde Movimientos (o desde la compra a cuotas)'
            : 'Este cargo ya es un ajuste del extracto: quítalo y vuelve a crearlo',
      );
    }
  }

  const extracto = await asegurarExtracto(usuarioId, metodo, ciclo, actual);
  const base = { extractoId: extracto.id, tipo: data.tipo, origen: data.origen ?? 'manual' };

  await prisma.$transaction(async (tx) => {
    if (data.tipo === 'correccion') {
      const gasto = await tx.gastoPersonal.findUnique({ where: { id: linea.id } });
      const previa = await tx.extractoAjuste.findFirst({ where: { tipo: 'correccion', gastoId: gasto.id } });
      const montoAntes = previa?.montoAntes ?? gasto.monto;
      await tx.gastoPersonal.update({
        where: { id: gasto.id },
        data: {
          monto: data.monto,
          ...(gasto.capital != null && { interes: Math.max(0, data.monto - gasto.capital) }),
        },
      });
      if (previa) {
        await tx.extractoAjuste.update({ where: { id: previa.id }, data: { monto: data.monto, descripcion: data.descripcion ?? previa.descripcion } });
      } else {
        await tx.extractoAjuste.create({
          data: { ...base, gastoId: gasto.id, montoAntes, monto: data.monto, descripcion: data.descripcion ?? null },
        });
      }
    } else if (data.tipo === 'no_cobrado') {
      const previa = await tx.extractoAjuste.findFirst({ where: { extractoId: extracto.id, tipo: 'no_cobrado', gastoId: linea.id } });
      if (!previa) await tx.extractoAjuste.create({ data: { ...base, gastoId: linea.id, monto: linea.monto } });
    } else if (data.tipo === 'cargo') {
      const descripcion = data.descripcion?.trim() || `${ETIQUETA_CONCEPTO[data.concepto]} · ${metodo.nombre}`;
      const gasto = await tx.gastoPersonal.create({
        data: datosGastoCargo(usuarioId, metodo, ciclo.fechaCorte, data.monto, descripcion, data.categoriaId),
      });
      await tx.extractoAjuste.create({
        data: { ...base, gastoId: gasto.id, concepto: data.concepto, descripcion, monto: data.monto, fecha: ciclo.fechaCorte },
      });
    } else {
      // no_reconocido: reclamo pendiente, sin gasto.
      await tx.extractoAjuste.create({
        data: {
          ...base,
          descripcion: data.descripcion,
          monto: data.monto,
          fecha: data.fecha ?? null,
          estadoReclamo: 'pendiente',
        },
      });
    }
  });
  return obtenerCiclo(usuarioActual, metodoId, fechaTexto);
}

async function requireAjuste(usuarioId, id) {
  const ajuste = await prisma.extractoAjuste.findUnique({
    where: { id },
    include: { extracto: { include: { metodoPago: true } } },
  });
  if (!ajuste || ajuste.extracto.usuarioId !== usuarioId) throw new HttpError(404, 'Ajuste no encontrado');
  return ajuste;
}

function fechaTextoDe(extracto) {
  return extracto.fechaCorte.toISOString().slice(0, 10);
}

/**
 * Resuelve un reclamo: reversado (el banco lo devolvió) o aceptado (era un
 * cargo válido: se registra como gasto con la tarjeta). Se puede cambiar
 * aunque el extracto ya esté revisado: los reclamos se resuelven después.
 */
export async function resolverReclamo(usuarioActual, id, estadoReclamo) {
  const usuarioId = usuarioActual.id;
  const ajuste = await requireAjuste(usuarioId, id);
  if (ajuste.tipo !== 'no_reconocido') throw new HttpError(400, 'Solo los cargos no reconocidos se resuelven');
  const { extracto } = ajuste;

  await prisma.$transaction(async (tx) => {
    let gastoId = ajuste.gastoId;
    if (estadoReclamo === 'aceptado' && !gastoId) {
      const gasto = await tx.gastoPersonal.create({
        data: datosGastoCargo(
          usuarioId,
          extracto.metodoPago,
          ajuste.fecha ?? extracto.fechaCorte,
          ajuste.monto,
          ajuste.descripcion || `Cargo del banco · ${extracto.metodoPago.nombre}`,
        ),
      });
      gastoId = gasto.id;
    } else if (estadoReclamo !== 'aceptado' && gastoId) {
      await tx.gastoPersonal.deleteMany({ where: { id: gastoId, usuarioId } });
      gastoId = null;
    }
    await tx.extractoAjuste.update({ where: { id }, data: { estadoReclamo, gastoId } });
  });
  return obtenerCiclo(usuarioActual, extracto.metodoPagoId, fechaTextoDe(extracto));
}

/** Quita un ajuste: devuelve el valor anterior (corrección) o borra el gasto que creó. */
export async function eliminarAjuste(usuarioActual, id) {
  const usuarioId = usuarioActual.id;
  const ajuste = await requireAjuste(usuarioId, id);
  requireAbierto(ajuste.extracto);

  await prisma.$transaction(async (tx) => {
    if (ajuste.tipo === 'correccion' && ajuste.gastoId) {
      const gasto = await tx.gastoPersonal.findUnique({ where: { id: ajuste.gastoId } });
      if (gasto) {
        await tx.gastoPersonal.update({
          where: { id: gasto.id },
          data: {
            monto: ajuste.montoAntes,
            ...(gasto.capital != null && { interes: Math.max(0, ajuste.montoAntes - gasto.capital) }),
          },
        });
      }
    }
    await tx.extractoAjuste.delete({ where: { id } });
    if ((ajuste.tipo === 'cargo' || ajuste.tipo === 'no_reconocido') && ajuste.gastoId) {
      await tx.gastoPersonal.deleteMany({ where: { id: ajuste.gastoId, usuarioId } });
    }
  });
  return obtenerCiclo(usuarioActual, ajuste.extracto.metodoPagoId, fechaTextoDe(ajuste.extracto));
}
