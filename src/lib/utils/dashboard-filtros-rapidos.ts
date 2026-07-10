// src/lib/utils/dashboard-filtros-rapidos.ts

import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import type { FiltroFecha } from "@/lib/actions/dashboard/dashboard-actions";

type NumeroTrimestre = 1 | 2 | 3 | 4;

/**
 * Estrategia de cálculo de un filtro de fechas rápido.
 * Cada estrategia encapsula la lógica para derivar un rango de fechas concreto,
 * permitiendo agregar nuevos filtros sin modificar los componentes que los consumen.
 */
export interface FiltroRapidoStrategy {
  id: string;
  etiqueta: string;
  calcular: () => FiltroFecha;
}

function calcularMesActual(): FiltroFecha {
  const hoy = new Date();
  return {
    desde: format(startOfMonth(hoy), "yyyy-MM-dd"),
    hasta: format(endOfMonth(hoy), "yyyy-MM-dd"),
  };
}

function calcularUltimos6Meses(): FiltroFecha {
  const hoy = new Date();
  return {
    desde: format(startOfMonth(subMonths(hoy, 5)), "yyyy-MM-dd"),
    hasta: format(endOfMonth(hoy), "yyyy-MM-dd"),
  };
}

function calcularAnoActual(): FiltroFecha {
  const hoy = new Date();
  return {
    desde: `${hoy.getFullYear()}-01-01`,
    hasta: format(endOfMonth(hoy), "yyyy-MM-dd"),
  };
}

function calcularTrimestre(numeroTrimestre: NumeroTrimestre): FiltroFecha {
  const anoActual = new Date().getFullYear();
  const mesInicio = (numeroTrimestre - 1) * 3;
  const inicioTrimestre = new Date(anoActual, mesInicio, 1);
  const finTrimestre = endOfMonth(new Date(anoActual, mesInicio + 2, 1));

  return {
    desde: format(inicioTrimestre, "yyyy-MM-dd"),
    hasta: format(finTrimestre, "yyyy-MM-dd"),
  };
}

export const FILTROS_RAPIDOS: FiltroRapidoStrategy[] = [
  { id: "mes-actual", etiqueta: "Este mes", calcular: calcularMesActual },
  {
    id: "ultimos-6-meses",
    etiqueta: "6 meses",
    calcular: calcularUltimos6Meses,
  },
  { id: "ano-actual", etiqueta: "Este año", calcular: calcularAnoActual },
  { id: "trimestre-1", etiqueta: "T1", calcular: () => calcularTrimestre(1) },
  { id: "trimestre-2", etiqueta: "T2", calcular: () => calcularTrimestre(2) },
  { id: "trimestre-3", etiqueta: "T3", calcular: () => calcularTrimestre(3) },
  { id: "trimestre-4", etiqueta: "T4", calcular: () => calcularTrimestre(4) },
];

/**
 * Rango de fechas por defecto al cargar el dashboard.
 */
export function defaultFiltro(): FiltroFecha {
  return calcularUltimos6Meses();
}
