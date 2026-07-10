// src/components/system/dashboard/dashboard-container.tsx

"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Calendar,
  CalendarCheck,
  Gift,
  Loader2,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DesempenoEquipo } from "@/components/system/dashboard/desempeno-equipo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type CumpleanosHoy,
  type DesempenoUsuario,
  type EstadoTramitesDistribucion,
  type EvolucionMensual,
  type FiltroFecha,
  type KpiGeneral,
  obtenerCumpleanosHoy,
  obtenerDesempenoUsuarios,
  obtenerDistribucionEstadosTramites,
  obtenerEvolucionMensual,
  obtenerKpisGenerales,
  obtenerProximasCitas,
  obtenerServiciosPopulares,
  obtenerUsuariosActivos,
  type ProximaCita,
  type ServicioPopular,
  type UsuarioSelector,
} from "@/lib/actions/dashboard/dashboard-actions";
import {
  defaultFiltro,
  FILTROS_RAPIDOS,
} from "@/lib/utils/dashboard-filtros-rapidos";

const COLORES_GRAFICOS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];

/**
 * Dashboard para roles con acceso gerencial.
 * Implementa patrón Facade para consolidar múltiples fuentes de datos.
 */
interface DashboardContainerProps {
  nombreUsuario: string;
  rol: string;
}

export function DashboardContainer({
  nombreUsuario,
  rol,
}: DashboardContainerProps) {
  const [filtro, setFiltro] = useState<FiltroFecha>(defaultFiltro);
  const [isLoading, setIsLoading] = useState(true);

  const [kpis, setKpis] = useState<KpiGeneral | null>(null);
  const [evolucion, setEvolucion] = useState<EvolucionMensual[]>([]);
  const [usuarios, setUsuarios] = useState<DesempenoUsuario[]>([]);
  const [usuariosSelector, setUsuariosSelector] = useState<UsuarioSelector[]>(
    [],
  );
  const [proximasCitas, setProximasCitas] = useState<ProximaCita[]>([]);
  const [cumpleanos, setCumpleanos] = useState<CumpleanosHoy[]>([]);
  const [estadosTramites, setEstadosTramites] = useState<
    EstadoTramitesDistribucion[]
  >([]);
  const [serviciosPopulares, setServiciosPopulares] = useState<
    ServicioPopular[]
  >([]);

  const cargar = useCallback(async () => {
    setIsLoading(true);
    const [kR, eR, uR, cR, bR, etR, spR, usR] = await Promise.all([
      obtenerKpisGenerales(filtro),
      obtenerEvolucionMensual(filtro),
      obtenerDesempenoUsuarios(filtro),
      obtenerProximasCitas(8),
      obtenerCumpleanosHoy(),
      obtenerDistribucionEstadosTramites(filtro),
      obtenerServiciosPopulares(filtro),
      obtenerUsuariosActivos(),
    ]);

    if (kR.success && kR.data) setKpis(kR.data);
    if (eR.success && eR.data) setEvolucion(eR.data);
    if (uR.success && uR.data) setUsuarios(uR.data);
    if (cR.success && cR.data) setProximasCitas(cR.data);
    if (bR.success && bR.data) setCumpleanos(bR.data);
    if (etR.success && etR.data) setEstadosTramites(etR.data);
    if (spR.success && spR.data) setServiciosPopulares(spR.data);
    if (usR.success && usR.data) setUsuariosSelector(usR.data);

    setIsLoading(false);
  }, [filtro]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
            {nombreUsuario}
          </p>
          <p className="text-muted-foreground">
            Resumen operativo y financiero
          </p>
        </div>

        <FiltroFechas
          filtro={filtro}
          onFiltroChange={setFiltro}
          isLoading={isLoading}
        />
      </div>

      {isLoading && !kpis ? (
        <SkeletonDashboard />
      ) : (
        <>
          <KpisRow kpis={kpis} />

          <DesempenoEquipo
            usuarios={usuarios}
            usuariosSelector={usuariosSelector}
            filtro={filtro}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <EvolucionChart data={evolucion} />
            </div>
            <DistribucionEstados data={estadosTramites} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ServiciosChart data={serviciosPopulares} />
            </div>
            <ClientesPorRegionChart data={kpis?.clientesPorRegion ?? []} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ProximasCitasList citas={proximasCitas} />
            <CumpleanosList cumpleanos={cumpleanos} />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Filtro de fechas ─────────────────────────────────────────────────────────

function FiltroFechas({
  filtro,
  onFiltroChange,
  isLoading,
}: {
  filtro: FiltroFecha;
  onFiltroChange: (f: FiltroFecha) => void;
  isLoading: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {FILTROS_RAPIDOS.map((estrategia) => (
          <Button
            key={estrategia.id}
            variant="outline"
            size="sm"
            onClick={() => onFiltroChange(estrategia.calcular())}
            disabled={isLoading}
          >
            {estrategia.etiqueta}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Desde</Label>
          <Input
            type="date"
            value={filtro.desde}
            onChange={(e) =>
              onFiltroChange({ ...filtro, desde: e.target.value })
            }
            className="h-8 text-xs"
            disabled={isLoading}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Hasta</Label>
          <Input
            type="date"
            value={filtro.hasta}
            onChange={(e) =>
              onFiltroChange({ ...filtro, hasta: e.target.value })
            }
            className="h-8 text-xs"
            disabled={isLoading}
          />
        </div>
        {isLoading && (
          <Loader2 className="h-4 w-4 animate-spin mt-4 text-muted-foreground" />
        )}
      </div>
    </div>
  );
}

// ─── KPIs Row ─────────────────────────────────────────────────────────────────

function KpisRow({ kpis }: { kpis: KpiGeneral | null }) {
  const items = [
    {
      titulo: "Ingresos Totales",
      valor: `${(kpis?.ingresosTotales ?? 0).toLocaleString("es-BO")} Bs.`,
      sub: `Servicios: ${(kpis?.ingresosServicios ?? 0).toLocaleString("es-BO")} · Citas: ${(kpis?.ingresosCitas ?? 0).toLocaleString("es-BO")}`,
      icon: Wallet,
      color: "text-green-600",
    },
    {
      titulo: "Clientes",
      valor: kpis?.totalClientes ?? 0,
      sub: `+${kpis?.clientesNuevos ?? 0} nuevos en el período`,
      icon: Users,
      color: "text-blue-600",
    },
    {
      titulo: "Trámites",
      valor: kpis?.totalTramites ?? 0,
      sub: `${kpis?.tramitesActivos ?? 0} activos · ${kpis?.tramitesCompletados ?? 0} completados`,
      icon: TrendingUp,
      color: "text-purple-600",
    },
    {
      titulo: "Citas",
      valor: kpis?.totalCitas ?? 0,
      sub: `${kpis?.citasProgramadas ?? 0} programadas · Asistencia: ${kpis?.tasaAsistencia ?? 0}%`,
      icon: CalendarCheck,
      color: "text-orange-600",
    },
    {
      titulo: "Grupos Familiares",
      valor: kpis?.gruposFamiliares ?? 0,
      sub: "Total registrados",
      icon: Users,
      color: "text-cyan-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {items.map(({ titulo, valor, sub, icon: Icon, color }) => (
        <Card key={titulo}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">
                  {titulo}
                </p>
                <p className={`text-2xl font-bold ${color}`}>{valor}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
                  {sub}
                </p>
              </div>
              <Icon className={`h-8 w-8 shrink-0 opacity-20 ${color}`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Evolución mensual ────────────────────────────────────────────────────────

function EvolucionChart({ data }: { data: EvolucionMensual[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Evolución Mensual</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11 }}
            />
            <Tooltip />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="clientes"
              stroke="#3b82f6"
              name="Clientes"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="tramites"
              stroke="#8b5cf6"
              name="Trámites"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="citas"
              stroke="#f59e0b"
              name="Citas"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="ingresos"
              stroke="#22c55e"
              name="Ingresos (Bs.)"
              strokeWidth={2}
              dot={false}
              strokeDasharray="4 2"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── Distribución estados trámites ────────────────────────────────────────────

function DistribucionEstados({ data }: { data: EstadoTramitesDistribucion[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Estados de Trámites
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              dataKey="total"
              nameKey="estado"
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.estado}
                  fill={
                    entry.color ??
                    COLORES_GRAFICOS[index % COLORES_GRAFICOS.length]
                  }
                />
              ))}
            </Pie>
            <Tooltip formatter={(v, n) => [v, n]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-1 mt-2">
          {data.map((item, index) => (
            <div
              key={item.estado}
              className="flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    backgroundColor:
                      item.color ??
                      COLORES_GRAFICOS[index % COLORES_GRAFICOS.length],
                  }}
                />
                <span className="text-muted-foreground">{item.estado}</span>
              </div>
              <span className="font-medium">{item.total}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Servicios populares ──────────────────────────────────────────────────────

function ServiciosChart({ data }: { data: ServicioPopular[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Servicios más Contratados
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid
              strokeDasharray="3 3"
              opacity={0.3}
              horizontal={false}
            />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="nombre"
              tick={{ fontSize: 11 }}
              width={120}
            />
            <Tooltip
              formatter={(value, name) => [
                name === "ingresos"
                  ? `${Number(value).toLocaleString("es-BO")} Bs.`
                  : value,
                name === "ingresos" ? "Ingresos" : "Contratos",
              ]}
            />
            <Legend />
            <Bar
              dataKey="total"
              fill="#3b82f6"
              name="Contratos"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── Clientes por región ──────────────────────────────────────────────────────

function ClientesPorRegionChart({
  data,
}: {
  data: Array<{ region: string; total: number }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Clientes por Región
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={80}
              dataKey="total"
              nameKey="region"
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORES_GRAFICOS[index % COLORES_GRAFICOS.length]}
                />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-1 mt-2">
          {data.map((item, index) => (
            <div
              key={item.region}
              className="flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    backgroundColor:
                      COLORES_GRAFICOS[index % COLORES_GRAFICOS.length],
                  }}
                />
                <span className="text-muted-foreground">{item.region}</span>
              </div>
              <span className="font-medium">{item.total}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Próximas citas ───────────────────────────────────────────────────────────

function ProximasCitasList({ citas }: { citas: ProximaCita[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Próximas Citas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {citas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Sin citas programadas
          </p>
        ) : (
          <div className="space-y-2">
            {citas.map((c) => (
              <div key={c.id} className="flex items-start gap-3 py-1">
                <div className="text-center shrink-0 w-10">
                  <p className="text-xs font-bold text-primary leading-none">
                    {format(new Date(c.fechaHora), "dd")}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {format(new Date(c.fechaHora), "MMM", { locale: es })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(c.fechaHora), "HH:mm")}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.tipoCita}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.cliente ?? c.grupoFamiliar ?? "—"}
                    {c.lugar && ` · ${c.lugar}`}
                  </p>
                  {c.participantes > 1 && (
                    <Badge variant="outline" className="text-xs mt-0.5">
                      {c.participantes} participantes
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Cumpleaños de hoy ────────────────────────────────────────────────────────

function CumpleanosList({ cumpleanos }: { cumpleanos: CumpleanosHoy[] }) {
  if (cumpleanos.length === 0) return null;

  return (
    <Card className="border-orange-200">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-orange-600">
          <Gift className="h-4 w-4" />
          Cumpleaños Hoy ({cumpleanos.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {cumpleanos.map((c) => (
            <div key={c.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{c.nombreCompleto}</p>
                <p className="text-xs text-muted-foreground">
                  {c.edad} años
                  {c.telefono && ` · ${c.telefono}`}
                </p>
              </div>
              <span className="text-lg">🎂</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={`kpi-${i}`} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-96" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="lg:col-span-2 h-72" />
        <Skeleton className="h-72" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="lg:col-span-2 h-72" />
        <Skeleton className="h-72" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
