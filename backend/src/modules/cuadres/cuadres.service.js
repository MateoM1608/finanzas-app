import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { obtenerOrigenesDetalladosPorLote, origenClave } from '../../utils/cuadreItemOrigen.js';
import { asegurarCuotasHogar } from '../../utils/cuentasFijas.js';
import { evaluarPeriodoSiCorresponde } from '../../utils/evaluacionAhorro.js';
import { hoyUTC } from '../../utils/fechas.js';

/**
 * Cuadre de cuentas del hogar. Sin fechas de corte: el hogar lo inicia
 * cuando quiere y junta todo lo PAGADO y sin cuadrar con fecha ≤ hoy (cuotas
 * de cuentas fijas marcadas como pagadas + gastos variables), sin importar
 * qué tan atrás esté. Lo que se desmarca vuelve a `pagado` y aparece de
 * nuevo en el siguiente cuadre. Mientras está abierto es un borrador que se
 * refresca en cada consulta.
 */

const INCLUDE_CUADRE = {
  items: true,
  balances: { include: { usuario: { select: { id: true, nombre: true } } } },
  creadoPor: { select: { id: true, nombre: true } },
};

function requireHogarId(usuarioActual) {
  if (!usuarioActual.hogarId) {
    throw new HttpError(409, 'No perteneces a ningún hogar todavía');
  }
  return usuarioActual.hogarId;
}

function requirePermisoEdicion(usuarioActual) {
  if (!usuarioActual.esAdmin && !usuarioActual.puedeEditarGastos) {
    throw new HttpError(403, 'No tienes permiso para cuadrar las cuentas del hogar');
  }
}

async function requireCuadreAbierto(hogarId, cuadreId) {
  const cuadre = await prisma.cuadre.findUnique({ where: { id: cuadreId } });
  if (!cuadre || cuadre.hogarId !== hogarId) {
    throw new HttpError(404, 'Cuadre no encontrado');
  }
  if (cuadre.estado !== 'abierto') {
    throw new HttpError(409, 'Este cuadre ya está cerrado');
  }
  return cuadre;
}

async function actualizarEstadoOrigen(tx, tipoOrigen, origenId, estado) {
  if (tipoOrigen === 'recurrente') {
    await tx.gastoRecurrenteInstancia.update({ where: { id: origenId }, data: { estado } });
  } else {
    await tx.gastoVariablePareja.update({ where: { id: origenId }, data: { estado } });
  }
}

/** Cambia el estado de muchos orígenes con una query por tipo (no una por ítem). */
async function actualizarEstadoOrigenes(tx, items, estado) {
  const ids = (tipo) => items.filter((i) => i.tipoOrigen === tipo).map((i) => i.origenId);
  const recurrentes = ids('recurrente');
  const variables = ids('variable');
  if (recurrentes.length) {
    await tx.gastoRecurrenteInstancia.updateMany({ where: { id: { in: recurrentes } }, data: { estado } });
  }
  if (variables.length) {
    await tx.gastoVariablePareja.updateMany({ where: { id: { in: variables } }, data: { estado } });
  }
}

function ordenarItems(items) {
  return [...items].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
}

async function enriquecer(cuadres) {
  const mapa = await obtenerOrigenesDetalladosPorLote(cuadres.flatMap((c) => c.items));
  return cuadres.map((cuadre) => ({
    ...cuadre,
    items: ordenarItems(cuadre.items.map((item) => ({ ...item, ...mapa.get(origenClave(item)), monto: item.monto }))),
  }));
}

async function obtenerCuadreEnriquecido(cuadreId) {
  const cuadre = await prisma.cuadre.findUnique({ where: { id: cuadreId }, include: INCLUDE_CUADRE });
  const [enriquecido] = await enriquecer([cuadre]);
  return enriquecido;
}

/** Lo pagado y sin cuadrar con fecha ≤ `hasta`, que es lo que entra a un cuadre. */
async function buscarPagadosSinCuadrar(hogarId, hasta) {
  const [cuotas, variables] = await Promise.all([
    prisma.gastoRecurrenteInstancia.findMany({
      where: { concepto: { hogarId }, estado: 'pagado', fecha: { lte: hasta } },
    }),
    prisma.gastoVariablePareja.findMany({
      where: { hogarId, estado: 'pagado', fecha: { lte: hasta } },
    }),
  ]);
  return { cuotas, variables };
}

/**
 * Refresca un borrador: agrega lo pagado y sin cuadrar que todavía no está
 * en él (preseleccionado) y sincroniza el monto de los ítems con su origen
 * (un gasto desmarcado se puede editar mientras tanto). Los desmarcados en
 * ESTE borrador se quedan desmarcados — no se vuelven a agregar.
 */
async function refrescarBorrador(hogarId, cuadreId) {
  const hoy = hoyUTC();
  const existentes = await prisma.cuadreItem.findMany({ where: { cuadreId } });
  const yaEnCuadre = new Set(existentes.map(origenClave));

  const { cuotas, variables } = await buscarPagadosSinCuadrar(hogarId, hoy);
  const nuevos = [
    ...cuotas
      .filter((c) => !yaEnCuadre.has(`recurrente:${c.id}`))
      .map((c) => ({ cuadreId, tipoOrigen: 'recurrente', origenId: c.id, monto: c.monto })),
    ...variables
      .filter((v) => !yaEnCuadre.has(`variable:${v.id}`))
      .map((v) => ({ cuadreId, tipoOrigen: 'variable', origenId: v.id, monto: v.valorTotal })),
  ];

  const mapa = await obtenerOrigenesDetalladosPorLote(existentes);
  const desactualizados = existentes.filter((item) => {
    const origen = mapa.get(origenClave(item));
    return origen && origen.monto != null && origen.monto !== item.monto;
  });
  // Un ítem cuyo origen ya no existe o dejó de estar pagado (ej. se deshizo
  // el pago de una cuota desmarcada) sale del borrador.
  const huerfanos = existentes.filter((item) => {
    const origen = mapa.get(origenClave(item));
    return !origen || !['pagado', 'en_cuadre'].includes(origen.estado);
  });

  if (!nuevos.length && !desactualizados.length && !huerfanos.length) return;

  await prisma.$transaction(async (tx) => {
    if (nuevos.length) {
      await tx.cuadreItem.createMany({ data: nuevos });
      await actualizarEstadoOrigenes(tx, nuevos, 'en_cuadre');
    }
    for (const item of desactualizados) {
      await tx.cuadreItem.update({
        where: { id: item.id },
        data: { monto: mapa.get(origenClave(item)).monto },
      });
    }
    if (huerfanos.length) {
      await tx.cuadreItem.deleteMany({ where: { id: { in: huerfanos.map((h) => h.id) } } });
    }
  });
}

export async function listarCuadres(usuarioActual) {
  const hogarId = requireHogarId(usuarioActual);
  const cuadres = await prisma.cuadre.findMany({
    where: { hogarId, estado: 'cerrado' },
    orderBy: [{ fecha: 'desc' }, { cerradoEn: 'desc' }],
    include: INCLUDE_CUADRE,
  });
  return enriquecer(cuadres);
}

export async function obtenerCuadreAbierto(usuarioActual) {
  const hogarId = requireHogarId(usuarioActual);
  const abierto = await prisma.cuadre.findFirst({ where: { hogarId, estado: 'abierto' } });
  if (!abierto) return null;
  await asegurarCuotasHogar(hogarId);
  await refrescarBorrador(hogarId, abierto.id);
  return obtenerCuadreEnriquecido(abierto.id);
}

export async function obtenerCuadre(usuarioActual, cuadreId) {
  const hogarId = requireHogarId(usuarioActual);
  const cuadre = await prisma.cuadre.findUnique({ where: { id: cuadreId } });
  if (!cuadre || cuadre.hogarId !== hogarId) {
    throw new HttpError(404, 'Cuadre no encontrado');
  }
  return obtenerCuadreEnriquecido(cuadreId);
}

export async function iniciarCuadre(usuarioActual) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);

  const existente = await obtenerCuadreAbierto(usuarioActual);
  if (existente) return { cuadre: existente, motivo: null };

  const { cuotas, variables } = await buscarPagadosSinCuadrar(hogarId, hoyUTC());
  if (!cuotas.length && !variables.length) {
    return {
      cuadre: null,
      motivo: 'No hay nada pagado pendiente de cuadrar: el hogar está al día',
    };
  }

  const cuadre = await prisma.cuadre.create({
    data: { hogarId, creadoPorUsuarioId: usuarioActual.id },
  });
  await refrescarBorrador(hogarId, cuadre.id);
  return { cuadre: await obtenerCuadreEnriquecido(cuadre.id), motivo: null };
}

export async function marcarItem(usuarioActual, cuadreId, itemId, incluido) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);
  await requireCuadreAbierto(hogarId, cuadreId);

  const item = await prisma.cuadreItem.findUnique({ where: { id: itemId } });
  if (!item || item.cuadreId !== cuadreId) {
    throw new HttpError(404, 'Ítem no encontrado en este cuadre');
  }

  await prisma.$transaction(async (tx) => {
    await tx.cuadreItem.update({ where: { id: itemId }, data: { incluido } });
    await actualizarEstadoOrigen(tx, item.tipoOrigen, item.origenId, incluido ? 'en_cuadre' : 'pagado');
  });

  return obtenerCuadreEnriquecido(cuadreId);
}

/** Descarta el borrador: todo lo que tenía vuelve a `pagado`, como si no se hubiera iniciado. */
export async function descartarCuadre(usuarioActual, cuadreId) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);
  await requireCuadreAbierto(hogarId, cuadreId);

  const items = await prisma.cuadreItem.findMany({ where: { cuadreId } });
  await prisma.$transaction(async (tx) => {
    await actualizarEstadoOrigenes(tx, items.filter((i) => i.incluido), 'pagado');
    await tx.cuadreItem.deleteMany({ where: { cuadreId } });
    await tx.cuadre.delete({ where: { id: cuadreId } });
  });
}

function claveMes(fecha) {
  const f = new Date(fecha);
  return `${f.getUTCFullYear()}-${String(f.getUTCMonth() + 1).padStart(2, '0')}`;
}

function ultimoDiaDelMes(clave) {
  const [anio, mes] = clave.split('-').map(Number);
  return new Date(Date.UTC(anio, mes, 0));
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/**
 * Calcula el neto de lo incluido: positivo = a ese miembro le deben, negativo
 * = debe. Quien pagó un ítem suma su monto; cada miembro resta su parte.
 */
function calcularBalances(itemsIncluidos, mapa) {
  const balance = new Map();
  const sumar = (usuarioId, delta) => balance.set(usuarioId, (balance.get(usuarioId) ?? 0) + delta);
  for (const item of itemsIncluidos) {
    const origen = mapa.get(origenClave(item));
    sumar(origen.pagador.id, item.monto);
    for (const reparto of origen.repartos) {
      sumar(reparto.usuarioId, -reparto.monto);
    }
  }
  return balance;
}

export async function confirmarCuadre(usuarioActual, cuadreId) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);
  await requireCuadreAbierto(hogarId, cuadreId);

  // Sin refrescar aquí: se confirma exactamente lo que el hogar revisó. Lo
  // que se haya pagado mientras tanto entra al siguiente cuadre.
  const items = await prisma.cuadreItem.findMany({ where: { cuadreId, incluido: true } });
  if (!items.length) {
    throw new HttpError(409, 'No hay ningún gasto marcado para cuadrar');
  }
  const mapa = await obtenerOrigenesDetalladosPorLote(items);
  for (const item of items) {
    const origen = mapa.get(origenClave(item));
    if (origen?.estado !== 'en_cuadre') {
      throw new HttpError(409, 'El cuadre cambió mientras lo revisabas — vuelve a abrirlo antes de confirmar');
    }
    if (!origen.pagador || !origen.repartos.length) {
      throw new HttpError(409, `"${origen.nombre}" no tiene quién pagó o reparto definido`);
    }
  }

  const fechaCuadre = hoyUTC();
  const balances = calcularBalances(items, mapa);

  // Lo que a cada miembro le tocó de su bolsillo (su reparto, sin importar
  // quién pagó el ítem) se registra en su panel personal agrupado por MES de
  // los gastos: un cuadre que abarca marzo y abril deja un gasto en cada mes,
  // para que los informes personales mensuales sigan cuadrando. Cada gasto
  // va al último día de su mes, o al día del cuadre si es el mes en curso.
  const repartoPorMiembroMes = new Map();
  for (const item of items) {
    const origen = mapa.get(origenClave(item));
    const mes = claveMes(origen.fecha);
    for (const reparto of origen.repartos) {
      const clave = `${reparto.usuarioId}|${mes}`;
      repartoPorMiembroMes.set(clave, (repartoPorMiembroMes.get(clave) ?? 0) + reparto.monto);
    }
  }
  const fechaIso = fechaCuadre.toISOString().slice(0, 10);
  const gastosPersonales = [...repartoPorMiembroMes.entries()]
    .filter(([, monto]) => monto > 0)
    .map(([clave, monto]) => {
      const [usuarioId, mes] = clave.split('|');
      const finDeMes = ultimoDiaDelMes(mes);
      const [, mesNum] = mes.split('-').map(Number);
      return {
        usuarioId,
        monto,
        fecha: finDeMes < fechaCuadre ? finDeMes : fechaCuadre,
        descripcion: `Hogar · ${MESES[mesNum - 1]} (cuadre del ${fechaIso})`,
        estado: 'pagado',
        esObligatorio: true,
        origen: 'cuadre_hogar',
        origenCuadreId: cuadreId,
      };
    });

  await prisma.$transaction(async (tx) => {
    await actualizarEstadoOrigenes(tx, items, 'cuadrado');
    await tx.cuadreBalanceMiembro.createMany({
      data: [...balances.entries()].map(([usuarioId, balance]) => ({ cuadreId, usuarioId, balance })),
    });
    if (gastosPersonales.length) {
      await tx.gastoPersonal.createMany({ data: gastosPersonales });
    }
    // Los desmarcados no forman parte del cuadre cerrado: siguen `pagado` y
    // entran al siguiente.
    await tx.cuadreItem.deleteMany({ where: { cuadreId, incluido: false } });
    await tx.cuadre.update({
      where: { id: cuadreId },
      data: { estado: 'cerrado', fecha: fechaCuadre, cerradoEn: new Date() },
    });
  });

  // Un obligatorio del hogar puede completar los obligatorios de un período
  // personal y disparar la evaluación de Ahorros (Fase 7, Etapa 5).
  for (const gasto of gastosPersonales) {
    await evaluarPeriodoSiCorresponde(gasto.usuarioId, gasto.fecha);
  }

  return obtenerCuadreEnriquecido(cuadreId);
}

/**
 * Saldo en vivo entre los miembros con todo lo pagado y sin cuadrar con
 * fecha ≤ hoy (lo que entraría a un cuadre si se hiciera ahora).
 */
export async function obtenerSaldo(usuarioActual) {
  const hogarId = requireHogarId(usuarioActual);
  const hoy = hoyUTC();
  await asegurarCuotasHogar(hogarId, hoy);

  const [cuotas, variables, miembros] = await Promise.all([
    prisma.gastoRecurrenteInstancia.findMany({
      where: { concepto: { hogarId }, estado: { in: ['pagado', 'en_cuadre'] }, fecha: { lte: hoy } },
      select: { id: true },
    }),
    prisma.gastoVariablePareja.findMany({
      where: { hogarId, estado: { in: ['pagado', 'en_cuadre'] }, fecha: { lte: hoy } },
      select: { id: true },
    }),
    prisma.usuario.findMany({ where: { hogarId }, select: { id: true, nombre: true }, orderBy: { creadoEn: 'asc' } }),
  ]);
  const items = [
    ...cuotas.map((c) => ({ tipoOrigen: 'recurrente', origenId: c.id })),
    ...variables.map((v) => ({ tipoOrigen: 'variable', origenId: v.id })),
  ];
  const mapa = await obtenerOrigenesDetalladosPorLote(items);
  const conMonto = items
    .map((i) => ({ ...i, monto: mapa.get(origenClave(i))?.monto }))
    .filter((i) => i.monto != null && mapa.get(origenClave(i)).pagador);
  const balances = calcularBalances(conMonto, mapa);

  return {
    totalSinCuadrar: conMonto.reduce((acc, i) => acc + i.monto, 0),
    cantidadSinCuadrar: conMonto.length,
    balances: miembros.map((m) => ({ usuario: m, balance: balances.get(m.id) ?? 0 })),
  };
}

const MESES_RESUMEN = 6;

/**
 * Resumen para Panel del hogar por MES CALENDARIO según la fecha de cada
 * gasto pagado (cuotas pagadas + gastos variables), sin depender de cuándo
 * se cuadró. Solo meses que tienen movimientos de verdad, los últimos 6.
 */
export async function obtenerResumenHogar(usuarioActual) {
  const hogarId = requireHogarId(usuarioActual);
  const hoy = hoyUTC();
  const desde = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - (MESES_RESUMEN - 1), 1));
  const estadosPagados = ['pagado', 'en_cuadre', 'cuadrado'];

  const [cuotas, variables, ultimoCuadre] = await Promise.all([
    prisma.gastoRecurrenteInstancia.findMany({
      where: { concepto: { hogarId }, estado: { in: estadosPagados }, fecha: { gte: desde, lte: hoy } },
      include: { pagador: { select: { id: true, nombre: true } } },
    }),
    prisma.gastoVariablePareja.findMany({
      where: { hogarId, estado: { in: estadosPagados }, fecha: { gte: desde, lte: hoy } },
      include: { pagador: { select: { id: true, nombre: true } } },
    }),
    prisma.cuadre.findFirst({
      where: { hogarId, estado: 'cerrado' },
      orderBy: { cerradoEn: 'desc' },
      include: { balances: { include: { usuario: { select: { id: true, nombre: true } } } } },
    }),
  ]);

  const porMes = new Map();
  const pagadoPorMiembro = new Map();
  const acumular = (fecha, campo, monto, pagador) => {
    const mes = claveMes(fecha);
    const fila = porMes.get(mes) ?? { periodo: mes, totalCuentasFijas: 0, totalVariables: 0 };
    fila[campo] += monto;
    porMes.set(mes, fila);
    if (pagador) {
      const actual = pagadoPorMiembro.get(pagador.id) ?? { nombre: pagador.nombre, total: 0 };
      actual.total += monto;
      pagadoPorMiembro.set(pagador.id, actual);
    }
  };
  for (const c of cuotas) acumular(c.fecha, 'totalCuentasFijas', c.monto ?? 0, c.pagador);
  for (const v of variables) acumular(v.fecha, 'totalVariables', v.valorTotal, v.pagador);

  return {
    serieMensual: [...porMes.values()].sort((a, b) => a.periodo.localeCompare(b.periodo)),
    pagadoPorMiembro: [...pagadoPorMiembro.values()],
    ultimoCuadre: ultimoCuadre
      ? {
          fecha: ultimoCuadre.fecha,
          balances: ultimoCuadre.balances.map((b) => ({ nombre: b.usuario.nombre, balance: b.balance })),
        }
      : null,
  };
}
