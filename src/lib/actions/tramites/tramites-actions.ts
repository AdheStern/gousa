// src/lib/actions/tramites/tramites-actions.ts

"use server";

import { db } from "@/lib/db";
import type { ActionResult } from "@/types/action-result-types";
import {
  type CambiarEstadoTramiteFormData,
  type CreateTramiteFormData,
  cambiarEstadoTramiteSchema,
  createTramiteSchema,
  type UpdateTramiteFormData,
  updateTramiteSchema,
} from "@/validations/tramite-validations";

export type TramiteListItem = {
  id: string;
  createdAt: Date;
  notas: string | null;
  codigoConfirmacionDs160: string | null;
  codigoSeguimientoCourier: string | null;
  visaNumero: string | null;
  visaFechaEmision: Date | null;
  visaFechaExpiracion: Date | null;
  cliente: {
    id: string;
    nombres: string;
    apellidos: string;
    regionId: string;
    regionNombre: string;
  };
  clienteServicioId: string;
  servicio: { nombre: string; codigo: string };
  precioServicio: number;
  estadoPago: { id: string; nombre: string; color: string | null };
  estadoActual: { id: string; nombre: string; color: string | null };
  usuarioAsignado: { id: string; name: string } | null;
};

export type TramiteDetalle = TramiteListItem & {
  historial: Array<{
    id: string;
    createdAt: Date;
    observacion: string | null;
    estado: { nombre: string; color: string | null };
    usuario: { name: string } | null;
  }>;
};

const tramiteSelect = {
  id: true,
  createdAt: true,
  notas: true,
  codigoConfirmacionDs160: true,
  codigoSeguimientoCourier: true,
  visaNumero: true,
  visaFechaEmision: true,
  visaFechaExpiracion: true,
  cliente: {
    select: {
      id: true,
      nombres: true,
      apellidos: true,
      regionId: true,
      region: { select: { nombre: true } },
    },
  },
  clienteServicio: {
    select: {
      id: true,
      precioFinal: true,
      servicio: { select: { nombre: true, codigo: true } },
      estadoPago: { select: { id: true, nombre: true, color: true } },
    },
  },
  estadoActual: { select: { id: true, nombre: true, color: true } },
  usuarioAsignado: { select: { id: true, name: true } },
} as const;

function mapTramite(raw: any): TramiteListItem {
  return {
    id: raw.id,
    createdAt: raw.createdAt,
    notas: raw.notas,
    codigoConfirmacionDs160: raw.codigoConfirmacionDs160,
    codigoSeguimientoCourier: raw.codigoSeguimientoCourier,
    visaNumero: raw.visaNumero,
    visaFechaEmision: raw.visaFechaEmision,
    visaFechaExpiracion: raw.visaFechaExpiracion,
    cliente: {
      id: raw.cliente.id,
      nombres: raw.cliente.nombres,
      apellidos: raw.cliente.apellidos,
      regionId: raw.cliente.regionId,
      regionNombre: raw.cliente.region.nombre,
    },
    clienteServicioId: raw.clienteServicio.id,
    servicio: raw.clienteServicio.servicio,
    precioServicio: Number(raw.clienteServicio.precioFinal),
    estadoPago: raw.clienteServicio.estadoPago,
    estadoActual: raw.estadoActual,
    usuarioAsignado: raw.usuarioAsignado,
  };
}

export async function obtenerTodosTramites(filtros?: {
  estadoId?: string;
  usuarioAsignadoId?: string;
  query?: string;
}): Promise<ActionResult<TramiteListItem[]>> {
  try {
    const where: any = { deletedAt: null };

    if (filtros?.estadoId) where.estadoActualId = filtros.estadoId;
    if (filtros?.usuarioAsignadoId)
      where.usuarioAsignadoId = filtros.usuarioAsignadoId;
    if (filtros?.query) {
      where.OR = [
        {
          cliente: {
            nombres: { contains: filtros.query, mode: "insensitive" },
          },
        },
        {
          cliente: {
            apellidos: { contains: filtros.query, mode: "insensitive" },
          },
        },
        {
          cliente: {
            numeroCi: { contains: filtros.query, mode: "insensitive" },
          },
        },
      ];
    }

    const tramites = await db.tramite.findMany({
      where,
      select: tramiteSelect,
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: tramites.map(mapTramite) };
  } catch (error) {
    console.error("Error al obtener trámites:", error);
    return { success: false, error: "Error al obtener los trámites" };
  }
}

export async function obtenerTramitesPorCliente(
  clienteId: string,
): Promise<ActionResult<TramiteListItem[]>> {
  try {
    const tramites = await db.tramite.findMany({
      where: { clienteId, deletedAt: null },
      select: tramiteSelect,
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: tramites.map(mapTramite) };
  } catch (error) {
    console.error("Error al obtener trámites del cliente:", error);
    return { success: false, error: "Error al obtener los trámites" };
  }
}

export async function obtenerTramitePorId(
  id: string,
): Promise<ActionResult<TramiteDetalle>> {
  try {
    const tramite = await db.tramite.findUnique({
      where: { id },
      select: {
        ...tramiteSelect,
        historial: {
          select: {
            id: true,
            createdAt: true,
            observacion: true,
            estado: { select: { nombre: true, color: true } },
            usuario: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!tramite) return { success: false, error: "Trámite no encontrado" };

    return {
      success: true,
      data: { ...mapTramite(tramite), historial: tramite.historial },
    };
  } catch (error) {
    console.error("Error al obtener trámite:", error);
    return { success: false, error: "Error al obtener el trámite" };
  }
}

export async function crearTramite(
  input: CreateTramiteFormData,
  usuarioId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const validated = createTramiteSchema.parse(input);

    const [clienteServicio, estadoInicial] = await Promise.all([
      db.clienteServicio.findUnique({
        where: { id: validated.clienteServicioId },
      }),
      db.catalogoEstadoTramite.findUnique({
        where: { id: validated.estadoActualId },
      }),
    ]);

    if (!clienteServicio)
      return { success: false, error: "Servicio no encontrado" };
    if (!estadoInicial)
      return { success: false, error: "Estado inicial no encontrado" };

    const tramiteId = await db.$transaction(async (tx) => {
      const tramite = await tx.tramite.create({
        data: {
          clienteId: validated.clienteId,
          clienteServicioId: validated.clienteServicioId,
          estadoActualId: validated.estadoActualId,
          usuarioAsignadoId: validated.usuarioAsignadoId ?? null,
          notas: validated.notas ?? null,
        },
      });

      await tx.tramiteHistorial.create({
        data: {
          tramiteId: tramite.id,
          estadoId: validated.estadoActualId,
          usuarioId,
          observacion: "Trámite iniciado",
        },
      });

      return tramite.id;
    });

    return { success: true, data: { id: tramiteId } };
  } catch (error) {
    console.error("Error al crear trámite:", error);
    return { success: false, error: "Error al crear el trámite" };
  }
}

export async function actualizarTramite(
  id: string,
  input: UpdateTramiteFormData,
): Promise<ActionResult<void>> {
  try {
    const validated = updateTramiteSchema.parse(input);

    const existe = await db.tramite.findUnique({ where: { id } });
    if (!existe) return { success: false, error: "Trámite no encontrado" };

    await db.tramite.update({ where: { id }, data: validated });

    return { success: true };
  } catch (error) {
    console.error("Error al actualizar trámite:", error);
    return { success: false, error: "Error al actualizar el trámite" };
  }
}

export async function cambiarEstadoTramite(
  tramiteId: string,
  input: CambiarEstadoTramiteFormData,
  usuarioId: string,
): Promise<ActionResult<void>> {
  try {
    const validated = cambiarEstadoTramiteSchema.parse(input);

    const [tramite, estado] = await Promise.all([
      db.tramite.findUnique({ where: { id: tramiteId } }),
      db.catalogoEstadoTramite.findUnique({
        where: { id: validated.estadoId },
      }),
    ]);

    if (!tramite) return { success: false, error: "Trámite no encontrado" };
    if (!estado) return { success: false, error: "Estado no encontrado" };

    await db.$transaction([
      db.tramite.update({
        where: { id: tramiteId },
        data: { estadoActualId: validated.estadoId },
      }),
      db.tramiteHistorial.create({
        data: {
          tramiteId,
          estadoId: validated.estadoId,
          usuarioId,
          observacion: validated.observacion ?? null,
        },
      }),
    ]);

    return { success: true };
  } catch (error) {
    console.error("Error al cambiar estado:", error);
    return { success: false, error: "Error al cambiar el estado del trámite" };
  }
}

export async function obtenerEstadosTramite(): Promise<
  ActionResult<
    Array<{ id: string; nombre: string; color: string | null; orden: number }>
  >
> {
  try {
    const estados = await db.catalogoEstadoTramite.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, color: true, orden: true },
      orderBy: { orden: "asc" },
    });
    return { success: true, data: estados };
  } catch (error) {
    console.error("Error al obtener estados:", error);
    return { success: false, error: "Error al obtener los estados" };
  }
}

export async function obtenerUsuariosAsignables(): Promise<
  ActionResult<Array<{ id: string; name: string }>>
> {
  try {
    const usuarios = await db.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return { success: true, data: usuarios };
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    return { success: false, error: "Error al obtener los usuarios" };
  }
}
