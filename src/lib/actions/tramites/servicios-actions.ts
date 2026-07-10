// src/lib/actions/tramites/servicios-actions.ts

"use server";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { ActionResult } from "@/types/action-result-types";
import {
  type CambiarEstadoPagoFormData,
  type CreateClienteServicioFormData,
  cambiarEstadoPagoSchema,
  createClienteServicioSchema,
  type UpdateClienteServicioFormData,
  updateClienteServicioSchema,
} from "@/validations/tramite-validations";

export type ServicioCatalogo = {
  id: string;
  nombre: string;
  codigo: string;
  requiereTramite: boolean;
  precioRegion: number | null;
};

export type ClienteServicioItem = {
  id: string;
  precioAcordado: number;
  descuentoAplicado: number | null;
  precioFinal: number;
  notas: string | null;
  createdAt: Date;
  servicio: {
    id: string;
    nombre: string;
    codigo: string;
    requiereTramite: boolean;
  };
  estadoPago: { id: string; nombre: string; color: string | null };
  tramite: {
    id: string;
    estadoActual: { nombre: string; color: string | null };
  } | null;
};

export async function obtenerCatalogosServicioConPrecio(
  regionId: string,
): Promise<ActionResult<ServicioCatalogo[]>> {
  try {
    const servicios = await db.catalogoServicio.findMany({
      where: { activo: true },
      include: {
        preciosPorRegion: {
          where: { regionId, activo: true },
          take: 1,
        },
      },
      orderBy: { orden: "asc" },
    });

    const data = servicios.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      codigo: s.codigo,
      requiereTramite: s.requiereTramite,
      precioRegion: s.preciosPorRegion[0]
        ? Number(s.preciosPorRegion[0].precio)
        : null,
    }));

    return { success: true, data };
  } catch (error) {
    console.error("Error al obtener catálogo de servicios:", error);
    return { success: false, error: "Error al obtener los servicios" };
  }
}

export async function obtenerServiciosDeCliente(
  clienteId: string,
): Promise<ActionResult<ClienteServicioItem[]>> {
  try {
    const servicios = await db.clienteServicio.findMany({
      where: { clienteId, deletedAt: null },
      include: {
        servicio: {
          select: {
            id: true,
            nombre: true,
            codigo: true,
            requiereTramite: true,
          },
        },
        estadoPago: {
          select: { id: true, nombre: true, color: true },
        },
        tramites: {
          where: { deletedAt: null },
          include: {
            estadoActual: { select: { nombre: true, color: true } },
          },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const data: ClienteServicioItem[] = servicios.map((s) => ({
      id: s.id,
      precioAcordado: Number(s.precioAcordado),
      descuentoAplicado: s.descuentoAplicado
        ? Number(s.descuentoAplicado)
        : null,
      precioFinal: Number(s.precioFinal),
      notas: s.notas,
      createdAt: s.createdAt,
      servicio: s.servicio,
      estadoPago: s.estadoPago,
      tramite: s.tramites[0]
        ? { id: s.tramites[0].id, estadoActual: s.tramites[0].estadoActual }
        : null,
    }));

    return { success: true, data };
  } catch (error) {
    console.error("Error al obtener servicios del cliente:", error);
    return { success: false, error: "Error al obtener los servicios" };
  }
}

export async function crearClienteServicio(
  input: CreateClienteServicioFormData,
): Promise<ActionResult<{ id: string; requiereTramite: boolean }>> {
  try {
    const validated = createClienteServicioSchema.parse(input);

    const [cliente, servicio, estadoPago] = await Promise.all([
      db.cliente.findUnique({ where: { id: validated.clienteId } }),
      db.catalogoServicio.findUnique({ where: { id: validated.servicioId } }),
      db.catalogoEstadoPago.findUnique({
        where: { id: validated.estadoPagoId },
      }),
    ]);

    if (!cliente) return { success: false, error: "Cliente no encontrado" };
    if (!servicio) return { success: false, error: "Servicio no encontrado" };
    if (!estadoPago)
      return { success: false, error: "Estado de pago no encontrado" };

    const clienteServicio = await db.clienteServicio.create({
      data: {
        clienteId: validated.clienteId,
        servicioId: validated.servicioId,
        precioAcordado: validated.precioAcordado,
        descuentoAplicado: validated.descuentoAplicado ?? null,
        precioFinal: validated.precioFinal,
        estadoPagoId: validated.estadoPagoId,
        notas: validated.notas ?? null,
      },
    });

    return {
      success: true,
      data: {
        id: clienteServicio.id,
        requiereTramite: servicio.requiereTramite,
      },
    };
  } catch (error) {
    console.error("Error al crear servicio:", error);
    return { success: false, error: "Error al contratar el servicio" };
  }
}

export async function actualizarClienteServicio(
  id: string,
  input: UpdateClienteServicioFormData,
): Promise<ActionResult<void>> {
  try {
    const validated = updateClienteServicioSchema.parse(input);

    const existe = await db.clienteServicio.findUnique({ where: { id } });
    if (!existe) return { success: false, error: "Servicio no encontrado" };

    await db.clienteServicio.update({ where: { id }, data: validated });

    return { success: true };
  } catch (error) {
    console.error("Error al actualizar servicio:", error);
    return { success: false, error: "Error al actualizar el servicio" };
  }
}

export async function obtenerEstadosPago(): Promise<
  ActionResult<Array<{ id: string; nombre: string; color: string | null }>>
> {
  try {
    const estados = await db.catalogoEstadoPago.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, color: true },
      orderBy: { orden: "asc" },
    });
    return { success: true, data: estados };
  } catch (error) {
    console.error("Error al obtener estados de pago:", error);
    return { success: false, error: "Error al obtener estados de pago" };
  }
}

export async function cambiarEstadoPagoServicio(
  clienteServicioId: string,
  input: CambiarEstadoPagoFormData,
): Promise<ActionResult<void>> {
  try {
    const validated = cambiarEstadoPagoSchema.parse(input);

    const [clienteServicio, estadoPago] = await Promise.all([
      db.clienteServicio.findUnique({ where: { id: clienteServicioId } }),
      db.catalogoEstadoPago.findUnique({
        where: { id: validated.estadoPagoId },
      }),
    ]);

    if (!clienteServicio)
      return { success: false, error: "Servicio no encontrado" };
    if (!estadoPago)
      return { success: false, error: "Estado de pago no encontrado" };

    await db.clienteServicio.update({
      where: { id: clienteServicioId },
      data: { estadoPagoId: validated.estadoPagoId },
    });

    return { success: true };
  } catch (error) {
    console.error("Error al cambiar estado de pago:", error);
    return { success: false, error: "Error al cambiar el estado de pago" };
  }
}
