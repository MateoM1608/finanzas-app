import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { hoyUTC } from '../../utils/fechas.js';
import { calcularInversion, participaciones } from '../../utils/inversiones.js';
import { validarMovimiento, crearCaja } from '../../utils/movimientosAhorro.js';

/**
 * Inversiones (entrega D2), personales o del hogar. Aportes y retiros son
 * siempre de quien los registra (mueven su caja: aporte_inversion /
 * retiro_inversion, fuera del consumo y de los ingresos reales). El valor
 * actual se actualiza a mano con valoraciones. En el hogar, la parte de cada
 * miembro sale de lo que ha puesto (aportes − retiros).
 */

const ORIGENES = { aporte: 'aporte_inversion', retiro: 'retiro_inversion' };

function requirePermisoEdicion(usuarioActual) {
  if (!usuarioActual.esAdmin && !usuarioActual.puedeEditarGastos) {
    throw new HttpError(403, 'No tienes permiso para editar las finanzas del hogar');
  }
}

async function requireInversion(usuarioActual, id, { editar = false } = {}) {
  const inversion = await prisma.inversion.findUnique({ where: { id } });
  const visible =
    inversion &&
    (inversion.hogarId ? inversion.hogarId === usuarioActual.hogarId : inversion.usuarioId === usuarioActual.id);
  if (!visible) throw new HttpError(404, 'Inversión no encontrada');
  if (editar && inversion.hogarId) requirePermisoEdicion(usuarioActual);
  return inversion;
}

const INCLUDE = {
  movimientos: { orderBy: { fecha: 'asc' } },
  valoraciones: { orderBy: { fecha: 'asc' } },
};

function vista(inversion, usuarioActual, hoy) {
  const calculo = calcularInversion(inversion, inversion.movimientos, inversion.valoraciones, hoy);
  const partes = inversion.hogarId ? participaciones(inversion.movimientos) : null;
  const miFraccion = inversion.hogarId ? (partes.get(usuarioActual.id) ?? 0) : 1;
  return {
    ...inversion,
    ambito: inversion.hogarId ? 'hogar' : 'personal',
    ...calculo,
    miPorcentaje: miFraccion * 100,
    miParte: Math.round(calculo.valorActual * miFraccion),
    participaciones: partes ? [...partes.entries()].map(([usuarioId, f]) => ({ usuarioId, porcentaje: f * 100 })) : null,
    // La cuenta de cada movimiento es privada de quien lo hizo.
    movimientos: inversion.movimientos.map((m) => (m.usuarioId === usuarioActual.id ? m : { ...m, metodoPagoId: null })),
  };
}

function inversionesVisibles(usuarioActual) {
  return prisma.inversion.findMany({
    where: {
      OR: [
        { usuarioId: usuarioActual.id, hogarId: null },
        ...(usuarioActual.hogarId ? [{ hogarId: usuarioActual.hogarId }] : []),
      ],
    },
    include: INCLUDE,
    orderBy: { creadoEn: 'asc' },
  });
}

export async function listarInversiones(usuarioActual) {
  const hoy = hoyUTC();
  const vistas = (await inversionesVisibles(usuarioActual)).map((i) => vista(i, usuarioActual, hoy));
  const personales = vistas.filter((i) => i.ambito === 'personal');
  const hogar = vistas.filter((i) => i.ambito === 'hogar');
  const activas = (lista) => lista.filter((i) => i.activa);
  return {
    personales,
    hogar,
    resumen: {
      valorPersonal: activas(personales).reduce((a, i) => a + i.valorActual, 0),
      valorHogar: activas(hogar).reduce((a, i) => a + i.valorActual, 0),
      miParteHogar: activas(hogar).reduce((a, i) => a + i.miParte, 0),
      gananciaPersonal: personales.reduce((a, i) => a + i.ganancia, 0),
    },
  };
}

/**
 * Para el patrimonio: valor de mis inversiones + mi parte de las del hogar,
 * también las cerradas (si les queda valor, la plata sigue ahí; una
 * liquidada con su retiro queda en 0).
 */
export async function valorInversionesDe(usuarioActual) {
  const { personales, hogar } = await listarInversiones(usuarioActual);
  return personales.reduce((a, i) => a + i.valorActual, 0) + hogar.reduce((a, i) => a + i.miParte, 0);
}

async function obtener(usuarioActual, id) {
  const inversion = await prisma.inversion.findUnique({ where: { id }, include: INCLUDE });
  return vista(inversion, usuarioActual, hoyUTC());
}

export async function crearInversion(usuarioActual, data) {
  const esHogar = data.ambito === 'hogar';
  if (esHogar) {
    if (!usuarioActual.hogarId) throw new HttpError(409, 'No perteneces a ningún hogar todavía');
    requirePermisoEdicion(usuarioActual);
  }
  const aporte = data.aporteInicial;
  if (aporte) await validarMovimiento(usuarioActual.id, aporte);

  const creada = await prisma.$transaction(
    async (tx) => {
      const inversion = await tx.inversion.create({
        data: {
          usuarioId: usuarioActual.id,
          hogarId: esHogar ? usuarioActual.hogarId : null,
          nombre: data.nombre,
          tipo: data.tipo ?? 'otro',
          entidad: data.entidad || null,
          fechaInicio: data.fechaInicio,
          tasaEA: data.tasaEA ?? null,
          fechaVencimiento: data.fechaVencimiento ?? null,
        },
      });
      if (aporte) {
        await registrar(tx, inversion, usuarioActual.id, {
          tipo: 'aporte',
          monto: aporte.monto,
          fecha: aporte.fecha ?? data.fechaInicio,
          metodoPagoId: aporte.metodoPagoId,
        });
      }
      return inversion;
    },
    { timeout: 120000, maxWait: 20000 },
  );
  return obtener(usuarioActual, creada.id);
}

export async function actualizarInversion(usuarioActual, id, data) {
  await requireInversion(usuarioActual, id, { editar: true });
  await prisma.inversion.update({
    where: { id },
    data: {
      ...(data.nombre !== undefined && { nombre: data.nombre }),
      ...(data.tipo !== undefined && { tipo: data.tipo }),
      ...(data.entidad !== undefined && { entidad: data.entidad || null }),
      ...(data.tasaEA !== undefined && { tasaEA: data.tasaEA }),
      ...(data.fechaVencimiento !== undefined && { fechaVencimiento: data.fechaVencimiento }),
      ...(data.activa !== undefined && { activa: data.activa }),
    },
  });
  return obtener(usuarioActual, id);
}

/** Se elimina solo sin aportes ni retiros (si no, se marca cerrada). */
export async function eliminarInversion(usuarioActual, id) {
  await requireInversion(usuarioActual, id, { editar: true });
  const movimientos = await prisma.inversionMovimiento.count({ where: { inversionId: id } });
  if (movimientos) throw new HttpError(409, 'Esta inversión ya tiene aportes o retiros: márcala como cerrada en vez de eliminarla');
  await prisma.inversion.delete({ where: { id } });
}

async function registrar(tx, inversion, usuarioId, mov) {
  const creado = await tx.inversionMovimiento.create({
    data: {
      inversionId: inversion.id,
      usuarioId,
      tipo: mov.tipo,
      monto: mov.monto,
      fecha: mov.fecha,
      metodoPagoId: mov.metodoPagoId ?? null,
    },
  });
  await crearCaja(tx, creado, {
    enlace: { inversionMovId: creado.id },
    origenes: ORIGENES,
    descripcion: `${mov.tipo === 'aporte' ? 'Aporte a' : 'Retiro de'} ${inversion.nombre}`,
  });
  return creado;
}

/** Aporte o retiro de quien lo registra (cualquier miembro, con su propia plata). */
export async function registrarMovimiento(usuarioActual, id, data) {
  const inversion = await requireInversion(usuarioActual, id);
  await validarMovimiento(usuarioActual.id, data);
  await prisma.$transaction(
    (tx) => registrar(tx, inversion, usuarioActual.id, { ...data, fecha: data.fecha ?? hoyUTC() }),
    { timeout: 120000, maxWait: 20000 },
  );
  return obtener(usuarioActual, id);
}

/** Quita un aporte o retiro propio (y su movimiento de caja). */
export async function eliminarMovimiento(usuarioActual, id, movId) {
  await requireInversion(usuarioActual, id);
  const mov = await prisma.inversionMovimiento.findUnique({ where: { id: movId } });
  if (!mov || mov.inversionId !== id) throw new HttpError(404, 'Movimiento no encontrado');
  if (mov.usuarioId !== usuarioActual.id) throw new HttpError(403, 'Solo quien hizo el movimiento puede quitarlo');
  await prisma.inversionMovimiento.delete({ where: { id: movId } });
  return obtener(usuarioActual, id);
}

/** Valor actual a una fecha (lo que dice el extracto o la app de la entidad). */
export async function registrarValoracion(usuarioActual, id, data) {
  await requireInversion(usuarioActual, id, { editar: true });
  const fecha = data.fecha ?? hoyUTC();
  if (fecha > hoyUTC()) throw new HttpError(400, 'La fecha no puede ser futura');
  await prisma.inversionValoracion.upsert({
    where: { inversionId_fecha: { inversionId: id, fecha } },
    create: { inversionId: id, fecha, valor: data.valor },
    update: { valor: data.valor },
  });
  return obtener(usuarioActual, id);
}

export async function eliminarValoracion(usuarioActual, id, valId) {
  await requireInversion(usuarioActual, id, { editar: true });
  const val = await prisma.inversionValoracion.findUnique({ where: { id: valId } });
  if (!val || val.inversionId !== id) throw new HttpError(404, 'Valoración no encontrada');
  await prisma.inversionValoracion.delete({ where: { id: valId } });
  return obtener(usuarioActual, id);
}
