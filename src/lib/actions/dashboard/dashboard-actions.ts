// src/lib/actions/dashboard/dashboard-actions.ts

"use server";

import {
  eachMonthOfInterval,
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { db } from "@/lib/db";
import type { ActionResult } from "@/types/action-result-types";

export type FiltroFecha = {
  desde: string;
  hasta: string;
};

export type KpiGeneral = {
  totalClientes: number;
  clientesNuevos: number;
  totalTramites: number;
  tramitesActivos: number;
  totalCitas: number;
  citasProgramadas: number;
  ingresosTotales: number;
  ingresosServicios: number;
  ingresosCitas: number;
  tasaAsistencia: number;
  tramitesCompletados: number;
  citasCompletadas: number;
  gruposFamiliares: number;
  clientesPorRegion: Array<{ region: string; total: number }>;
  clientesPorTipo: Array<{ tipo: string; total: number }>;
};

export type EvolucionMensual = {
  mes: string;
  clientes: number;
  tramites: number;
  citas: number;
  ingresos: number;
};

export type DesempenoUsuario = {
  id: string;
  nombre: string;
  clientesRegistrados: number;
  tramitesGestionados: number;
  citasGestionadas: number;
  ingresosGenerados: number;
};

export type HistoricoUsuarioPunto = {
  mes: string;
  clientesRegistrados: number;
  tramitesGestionados: number;
  citasGestionadas: number;
  ingresosGenerados: number;
};

export type UsuarioSelector = {
  id: string;
  nombre: string;
};

export type ProximaCita = {
  id: string;
  fechaHora: Date;
  tipoCita: string;
  lugar: string | null;
  cliente: string | null;
  grupoFamiliar: string | null;
  participantes: number;
};

export type CumpleanosHoy = {
  id: string;
  nombreCompleto: string;
  edad: number;
  telefono: string | null;
  email: string | null;
};

export type EstadoTramitesDistribucion = {
  estado: string;
  color: string | null;
  total: number;
};

export type ServicioPopular = {
  nombre: string;
  codigo: string;
  total: number;
  ingresos: number;
};

function buildDateRange(filtro: FiltroFecha) {
  return {
    gte: startOfDay(new Date(filtro.desde)),
    lte: endOfDay(new Date(filtro.hasta)),
  };
}

type MetricasUsuario = {
  clientesRegistrados: number;
  tramitesGestionados: number;
  citasGestionadas: number;
  ingresosGenerados: number;
};

/**
 * Calcula las métricas de actividad de un usuario para un rango de fechas dado.
 * Utilizada tanto por el ranking general como por el histórico mensual individual.
 */
async function calcularMetricasUsuario(
  usuarioId: string,
  rango: { gte: Date; lte: Date },
): Promise<MetricasUsuario> {
  const [
    clientesRegistrados,
    tramitesGestionados,
    citasGestionadas,
    ingresosServ,
    ingresosCit,
  ] = await Promise.all([
    db.cliente.count({
      where: { registradoPorId: usuarioId, deletedAt: null, createdAt: rango },
    }),
    db.tramite.count({
      where: {
        usuarioAsignadoId: usuarioId,
        deletedAt: null,
        createdAt: rango,
      },
    }),
    db.cita.count({
      where: { creadaPorId: usuarioId, deletedAt: null, fechaHora: rango },
    }),
    db.clienteServicio.aggregate({
      where: {
        deletedAt: null,
        createdAt: rango,
        cliente: { registradoPorId: usuarioId },
      },
      _sum: { precioFinal: true },
    }),
    db.cita.aggregate({
      where: { creadaPorId: usuarioId, deletedAt: null, fechaHora: rango },
      _sum: { precioFinal: true },
    }),
  ]);

  return {
    clientesRegistrados,
    tramitesGestionados,
    citasGestionadas,
    ingresosGenerados:
      Number(ingresosServ._sum.precioFinal ?? 0) +
      Number(ingresosCit._sum.precioFinal ?? 0),
  };
}

export async function obtenerKpisGenerales(
  filtro: FiltroFecha,
): Promise<ActionResult<KpiGeneral>> {
  try {
    const rango = buildDateRange(filtro);

    const [
      totalClientes,
      clientesNuevos,
      totalTramites,
      tramitesActivos,
      tramitesCompletados,
      totalCitas,
      citasProgramadas,
      citasCompletadas,
      asistenciaCitas,
      totalParticipantes,
      ingresosServicios,
      ingresosCitas,
      gruposFamiliares,
      clientesPorRegion,
      clientesPorTipo,
    ] = await Promise.all([
      db.cliente.count({ where: { deletedAt: null } }),
      db.cliente.count({ where: { deletedAt: null, createdAt: rango } }),
      db.tramite.count({ where: { deletedAt: null, createdAt: rango } }),
      db.tramite.count({
        where: {
          deletedAt: null,
          createdAt: rango,
          estadoActual: {
            nombre: { notIn: ["Completado", "Cancelado", "Rechazado"] },
          },
        },
      }),
      db.tramite.count({
        where: {
          deletedAt: null,
          createdAt: rango,
          estadoActual: { nombre: { in: ["Completado", "Aprobado"] } },
        },
      }),
      db.cita.count({ where: { deletedAt: null, fechaHora: rango } }),
      db.cita.count({
        where: { deletedAt: null, fechaHora: rango, estado: "PROGRAMADA" },
      }),
      db.cita.count({
        where: { deletedAt: null, fechaHora: rango, estado: "COMPLETADA" },
      }),
      db.citaParticipante.count({
        where: { asistio: true, cita: { deletedAt: null, fechaHora: rango } },
      }),
      db.citaParticipante.count({
        where: { cita: { deletedAt: null, fechaHora: rango } },
      }),
      db.clienteServicio.aggregate({
        where: { deletedAt: null, createdAt: rango },
        _sum: { precioFinal: true },
      }),
      db.cita.aggregate({
        where: { deletedAt: null, fechaHora: rango },
        _sum: { precioFinal: true },
      }),
      db.grupoFamiliar.count({ where: { deletedAt: null } }),
      db.cliente.groupBy({
        by: ["regionId"],
        where: { deletedAt: null },
        _count: true,
        orderBy: { _count: { regionId: "desc" } },
        take: 6,
      }),
      db.cliente.groupBy({
        by: ["tipoCliente"],
        where: { deletedAt: null },
        _count: true,
      }),
    ]);

    const regionIds = clientesPorRegion.map((r) => r.regionId);
    const regiones = await db.catalogoRegion.findMany({
      where: { id: { in: regionIds } },
      select: { id: true, nombre: true },
    });
    const regionMap = new Map(regiones.map((r) => [r.id, r.nombre]));

    const ingresosServiciosNum = Number(
      ingresosServicios._sum.precioFinal ?? 0,
    );
    const ingresosCitasNum = Number(ingresosCitas._sum.precioFinal ?? 0);

    return {
      success: true,
      data: {
        totalClientes,
        clientesNuevos,
        totalTramites,
        tramitesActivos,
        tramitesCompletados,
        totalCitas,
        citasProgramadas,
        citasCompletadas,
        gruposFamiliares,
        ingresosTotales: ingresosServiciosNum + ingresosCitasNum,
        ingresosServicios: ingresosServiciosNum,
        ingresosCitas: ingresosCitasNum,
        tasaAsistencia:
          totalParticipantes > 0
            ? Math.round((asistenciaCitas / totalParticipantes) * 100)
            : 0,
        clientesPorRegion: clientesPorRegion.map((r) => ({
          region: regionMap.get(r.regionId) ?? r.regionId,
          total: r._count,
        })),
        clientesPorTipo: clientesPorTipo.map((t) => ({
          tipo: t.tipoCliente === "ADULTO" ? "Adulto" : "Infante",
          total: t._count,
        })),
      },
    };
  } catch (error) {
    console.error("Error al obtener KPIs:", error);
    return { success: false, error: "Error al obtener indicadores" };
  }
}

export async function obtenerEvolucionMensual(
  filtro: FiltroFecha,
): Promise<ActionResult<EvolucionMensual[]>> {
  try {
    const inicio = new Date(filtro.desde);
    const fin = new Date(filtro.hasta);
    const meses = eachMonthOfInterval({ start: inicio, end: fin });

    const data = await Promise.all(
      meses.map(async (mes) => {
        const rangoMes = {
          gte: startOfMonth(mes),
          lte: endOfMonth(mes),
        };

        const [clientes, tramites, citas, ingresosS, ingresosC] =
          await Promise.all([
            db.cliente.count({
              where: { deletedAt: null, createdAt: rangoMes },
            }),
            db.tramite.count({
              where: { deletedAt: null, createdAt: rangoMes },
            }),
            db.cita.count({ where: { deletedAt: null, fechaHora: rangoMes } }),
            db.clienteServicio.aggregate({
              where: { deletedAt: null, createdAt: rangoMes },
              _sum: { precioFinal: true },
            }),
            db.cita.aggregate({
              where: { deletedAt: null, fechaHora: rangoMes },
              _sum: { precioFinal: true },
            }),
          ]);

        return {
          mes: format(mes, "MMM yy"),
          clientes,
          tramites,
          citas,
          ingresos:
            Number(ingresosS._sum.precioFinal ?? 0) +
            Number(ingresosC._sum.precioFinal ?? 0),
        };
      }),
    );

    return { success: true, data };
  } catch (error) {
    console.error("Error evolución mensual:", error);
    return { success: false, error: "Error al obtener evolución mensual" };
  }
}

export async function obtenerDesempenoUsuarios(
  filtro: FiltroFecha,
): Promise<ActionResult<DesempenoUsuario[]>> {
  try {
    const rango = buildDateRange(filtro);

    const usuarios = await db.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
    });

    const data = await Promise.all(
      usuarios.map(async (u) => ({
        id: u.id,
        nombre: u.name,
        ...(await calcularMetricasUsuario(u.id, rango)),
      })),
    );

    return {
      success: true,
      data: data
        .filter(
          (u) =>
            u.clientesRegistrados + u.tramitesGestionados + u.citasGestionadas >
            0,
        )
        .sort((a, b) => b.ingresosGenerados - a.ingresosGenerados),
    };
  } catch (error) {
    console.error("Error desempeño usuarios:", error);
    return { success: false, error: "Error al obtener desempeño de usuarios" };
  }
}

export async function obtenerHistoricoUsuario(
  usuarioId: string,
  filtro: FiltroFecha,
): Promise<ActionResult<HistoricoUsuarioPunto[]>> {
  try {
    const inicio = new Date(filtro.desde);
    const fin = new Date(filtro.hasta);
    const meses = eachMonthOfInterval({ start: inicio, end: fin });

    const data = await Promise.all(
      meses.map(async (mes) => {
        const rangoMes = { gte: startOfMonth(mes), lte: endOfMonth(mes) };
        const metricas = await calcularMetricasUsuario(usuarioId, rangoMes);

        return {
          mes: format(mes, "MMM yy"),
          ...metricas,
        };
      }),
    );

    return { success: true, data };
  } catch (error) {
    console.error("Error histórico usuario:", error);
    return { success: false, error: "Error al obtener histórico del usuario" };
  }
}

export async function obtenerUsuariosActivos(): Promise<
  ActionResult<UsuarioSelector[]>
> {
  try {
    const usuarios = await db.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return {
      success: true,
      data: usuarios.map((u) => ({ id: u.id, nombre: u.name })),
    };
  } catch (error) {
    console.error("Error usuarios activos:", error);
    return { success: false, error: "Error al obtener usuarios activos" };
  }
}

export async function obtenerProximasCitas(
  limite = 8,
): Promise<ActionResult<ProximaCita[]>> {
  try {
    const citas = await db.cita.findMany({
      where: {
        deletedAt: null,
        estado: "PROGRAMADA",
        fechaHora: { gte: new Date() },
      },
      select: {
        id: true,
        fechaHora: true,
        lugar: true,
        tipoCita: { select: { nombre: true } },
        tramite: {
          select: { cliente: { select: { nombres: true, apellidos: true } } },
        },
        grupoFamiliar: { select: { nombre: true } },
        _count: { select: { participantes: true } },
      },
      orderBy: { fechaHora: "asc" },
      take: limite,
    });

    return {
      success: true,
      data: citas.map((c) => ({
        id: c.id,
        fechaHora: c.fechaHora,
        tipoCita: c.tipoCita.nombre,
        lugar: c.lugar,
        cliente: c.tramite
          ? `${c.tramite.cliente.nombres} ${c.tramite.cliente.apellidos}`
          : null,
        grupoFamiliar: c.grupoFamiliar?.nombre ?? null,
        participantes: c._count.participantes,
      })),
    };
  } catch (error) {
    console.error("Error próximas citas:", error);
    return { success: false, error: "Error al obtener próximas citas" };
  }
}

export async function obtenerCumpleanosHoy(): Promise<
  ActionResult<CumpleanosHoy[]>
> {
  try {
    const hoy = new Date();
    const mes = hoy.getMonth() + 1;
    const dia = hoy.getDate();

    const clientes = await db.$queryRaw<
      Array<{
        id: string;
        nombres: string;
        apellidos: string;
        fechaNacimiento: Date;
        telefonoCelular: string | null;
        email: string | null;
      }>
    >`
      SELECT id, nombres, apellidos, "fechaNacimiento", "telefonoCelular", email
      FROM "Cliente"
      WHERE "deletedAt" IS NULL
        AND "fechaNacimiento" IS NOT NULL
        AND EXTRACT(MONTH FROM "fechaNacimiento") = $mes
        AND EXTRACT(DAY FROM "fechaNacimiento") = $dia
      ORDER BY apellidos ASC
    `;

    return {
      success: true,
      data: clientes.map((c) => ({
        id: c.id,
        nombreCompleto: `${c.nombres} ${c.apellidos}`,
        edad: hoy.getFullYear() - new Date(c.fechaNacimiento).getFullYear(),
        telefono: c.telefonoCelular,
        email: c.email,
      })),
    };
  } catch (error) {
    console.error("Error cumpleaños:", error);
    return { success: false, error: "Error al obtener cumpleaños" };
  }
}

export async function obtenerDistribucionEstadosTramites(
  filtro: FiltroFecha,
): Promise<ActionResult<EstadoTramitesDistribucion[]>> {
  try {
    const rango = buildDateRange(filtro);

    const distribucion = await db.tramite.groupBy({
      by: ["estadoActualId"],
      where: { deletedAt: null, createdAt: rango },
      _count: true,
    });

    const estadoIds = distribucion.map((d) => d.estadoActualId);
    const estados = await db.catalogoEstadoTramite.findMany({
      where: { id: { in: estadoIds } },
      select: { id: true, nombre: true, color: true },
    });
    const estadoMap = new Map(estados.map((e) => [e.id, e]));

    return {
      success: true,
      data: distribucion
        .map((d) => ({
          estado: estadoMap.get(d.estadoActualId)?.nombre ?? d.estadoActualId,
          color: estadoMap.get(d.estadoActualId)?.color ?? null,
          total: d._count,
        }))
        .sort((a, b) => b.total - a.total),
    };
  } catch (error) {
    console.error("Error distribución estados:", error);
    return {
      success: false,
      error: "Error al obtener distribución de estados",
    };
  }
}

export async function obtenerServiciosPopulares(
  filtro: FiltroFecha,
): Promise<ActionResult<ServicioPopular[]>> {
  try {
    const rango = buildDateRange(filtro);

    const servicios = await db.clienteServicio.groupBy({
      by: ["servicioId"],
      where: { deletedAt: null, createdAt: rango },
      _count: true,
      _sum: { precioFinal: true },
      orderBy: { _count: { servicioId: "desc" } },
      take: 6,
    });

    const servicioIds = servicios.map((s) => s.servicioId);
    const catalogos = await db.catalogoServicio.findMany({
      where: { id: { in: servicioIds } },
      select: { id: true, nombre: true, codigo: true },
    });
    const catalogoMap = new Map(catalogos.map((c) => [c.id, c]));

    return {
      success: true,
      data: servicios.map((s) => ({
        nombre: catalogoMap.get(s.servicioId)?.nombre ?? s.servicioId,
        codigo: catalogoMap.get(s.servicioId)?.codigo ?? "",
        total: s._count,
        ingresos: Number(s._sum.precioFinal ?? 0),
      })),
    };
  } catch (error) {
    console.error("Error servicios populares:", error);
    return { success: false, error: "Error al obtener servicios populares" };
  }
}
