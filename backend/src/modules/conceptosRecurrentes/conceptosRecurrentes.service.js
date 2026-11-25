import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { hoyUTC } from '../../utils/fechas.js';
import { validarCategoriaHogar } from '../categoriasHogar/categoriasHogar.service.js';

/**
 * Cuentas fijas del hogar (modelo ConceptoRecurrentePareja): arriendo,
 * internet… con su propio calendario (frecuencia + día(s) + fecha de inicio)
 * y un responsable. Sus cuotas viven en GastoRecurrenteInstancia y se
 * generan perezosamente (utils/cuentasFijas.js) — ver módulo cuentasHogar.
 */

function requireHogarId(usuarioActual) {
  if (!usuarioActual.hogarId) {
    throw new HttpError(409, 'No perteneces a ningún hogar todavía');
  }
  return usuarioActual.hogarId;
}

function requirePermisoEdicion(usuarioActual) {
  if (!usuarioActual.esAdmin && !usuarioActual.puedeEditarGastos) {
    throw new HttpError(403, 'No tienes permiso para editar las cuentas del hogar');
  }
}

async function validarResponsableDelHogar(hogarId, responsableUsuarioId) {
  if (!responsableUsuarioId) return;
  const pertenece = await prisma.usuario.count({ where: { id: responsableUsuarioId, hogarId } });
  if (!pertenece) {
    throw new HttpError(400, 'El responsable debe ser un miembro de tu hogar');
  }
}

async function requireConceptoDelHogar(hogarId, conceptoId) {
  const concepto = await prisma.conceptoRecurrentePareja.findUnique({ where: { id: conceptoId } });
  if (!concepto || concepto.hogarId !== hogarId) {
    throw new HttpError(404, 'Cuenta no encontrada');
  }
  return concepto;
}

const INCLUDE_CONCEPTO = {
  responsable: { select: { id: true, nombre: true } },
  categoria: { select: { id: true, nombre: true } },
};

function normalizarCalendario(data) {
  return {
    frecuencia: data.frecuencia,
    diaMes: data.frecuencia === 'quincenal' ? (data.diaMes ?? 15) : (data.diaMes ?? null),
    diaMes2: data.frecuencia === 'quincenal' ? (data.diaMes2 ?? null) : null,
  };
}

export function listarConceptos(usuarioActual) {
  const hogarId = requireHogarId(usuarioActual);
  return prisma.conceptoRecurrentePareja.findMany({
    where: { hogarId },
    include: INCLUDE_CONCEPTO,
    orderBy: { creadoEn: 'asc' },
  });
}

export async function crearConcepto(usuarioActual, data) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);
  await validarResponsableDelHogar(hogarId, data.responsableUsuarioId);
  const categoriaId = await validarCategoriaHogar(hogarId, data.categoriaId);

  return prisma.conceptoRecurrentePareja.create({
    data: {
      hogarId,
      nombre: data.nombre,
      tipoMonto: data.tipoMonto,
      montoDefault: data.tipoMonto === 'fijo' ? data.montoDefault : null,
      responsableUsuarioId: data.responsableUsuarioId ?? null,
      categoriaId,
      fechaInicio: data.fechaInicio,
      ...normalizarCalendario(data),
    },
    include: INCLUDE_CONCEPTO,
  });
}

export async function actualizarConcepto(usuarioActual, conceptoId, data) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);
  const concepto = await requireConceptoDelHogar(hogarId, conceptoId);
  if (data.responsableUsuarioId !== undefined) {
    await validarResponsableDelHogar(hogarId, data.responsableUsuarioId);
  }

  const tipoMontoFinal = data.tipoMonto ?? concepto.tipoMonto;
  const montoDefaultFinal = data.montoDefault === undefined ? concepto.montoDefault : data.montoDefault;
  if (tipoMontoFinal === 'fijo' && montoDefaultFinal == null) {
    throw new HttpError(400, 'Las cuentas de monto fijo requieren el monto');
  }

  const frecuenciaFinal = data.frecuencia ?? concepto.frecuencia;
  const calendario = normalizarCalendario({
    frecuencia: frecuenciaFinal,
    diaMes: data.diaMes === undefined ? concepto.diaMes : data.diaMes,
    diaMes2: data.diaMes2 === undefined ? concepto.diaMes2 : data.diaMes2,
  });
  if (frecuenciaFinal === 'quincenal' && calendario.diaMes >= (calendario.diaMes2 ?? 31)) {
    throw new HttpError(400, 'En una cuenta quincenal el primer día debe ser antes que el segundo');
  }
  const fechaInicioFinal = data.fechaInicio ?? concepto.fechaInicio;
  const categoriaId =
    data.categoriaId === undefined ? undefined : await validarCategoriaHogar(hogarId, data.categoriaId, concepto.categoriaId);

  const cambiaCalendario =
    calendario.frecuencia !== concepto.frecuencia ||
    calendario.diaMes !== concepto.diaMes ||
    calendario.diaMes2 !== concepto.diaMes2 ||
    new Date(fechaInicioFinal).getTime() !== concepto.fechaInicio.getTime();
  const montoPorCuota = tipoMontoFinal === 'variable' ? null : montoDefaultFinal;

  return prisma.$transaction(async (tx) => {
    const actualizado = await tx.conceptoRecurrentePareja.update({
      where: { id: conceptoId },
      data: {
        nombre: data.nombre ?? undefined,
        activo: data.activo ?? undefined,
        tipoMonto: data.tipoMonto ?? undefined,
        montoDefault: montoPorCuota,
        categoriaId,
        responsableUsuarioId:
          data.responsableUsuarioId === undefined ? undefined : data.responsableUsuarioId,
        fechaInicio: fechaInicioFinal,
        ...calendario,
      },
      include: INCLUDE_CONCEPTO,
    });

    // Las cuotas que nadie ha pagado todavía siguen a la configuración nueva:
    // si cambió el calendario se borran (se regeneran solas con las fechas
    // nuevas); si no, se les actualiza el monto. Las ya pagadas no se tocan.
    if (cambiaCalendario) {
      await tx.gastoRecurrenteInstancia.deleteMany({ where: { conceptoId, estado: 'por_pagar' } });
    } else {
      await tx.gastoRecurrenteInstancia.updateMany({
        where: { conceptoId, estado: 'por_pagar' },
        data: { monto: montoPorCuota },
      });
    }

    // Desactivar deja de generar cuotas y quita las futuras sin pagar; las ya
    // vencidas sin pagar siguen ahí, porque son una obligación real.
    if (data.activo === false) {
      await tx.gastoRecurrenteInstancia.deleteMany({
        where: { conceptoId, estado: 'por_pagar', fecha: { gt: hoyUTC() } },
      });
    }

    return actualizado;
  });
}

export async function eliminarConcepto(usuarioActual, conceptoId) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);
  await requireConceptoDelHogar(hogarId, conceptoId);

  const conPagos = await prisma.gastoRecurrenteInstancia.count({
    where: { conceptoId, estado: { not: 'por_pagar' } },
  });
  if (conPagos) {
    throw new HttpError(
      409,
      'Esta cuenta ya tiene pagos registrados — desactívala en vez de eliminarla, para no perder ese historial',
    );
  }

  await prisma.$transaction([
    prisma.gastoRecurrenteInstancia.deleteMany({ where: { conceptoId } }),
    prisma.conceptoRecurrentePareja.delete({ where: { id: conceptoId } }),
  ]);
}
