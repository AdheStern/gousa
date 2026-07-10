// src/components/system/dashboard/desempeno-equipo.tsx

"use client";

import { BarChart3, LineChart as LineChartIcon, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type DesempenoUsuario,
  type FiltroFecha,
  type HistoricoUsuarioPunto,
  obtenerHistoricoUsuario,
  type UsuarioSelector,
} from "@/lib/actions/dashboard/dashboard-actions";

type TipoGraficoHistorico = "barras" | "lineas";

/**
 * Sección principal de desempeño del equipo.
 * Combina el ranking general del período con el histórico de actividad
 * de un usuario individual seleccionable.
 */
interface DesempenoEquipoProps {
  usuarios: DesempenoUsuario[];
  usuariosSelector: UsuarioSelector[];
  filtro: FiltroFecha;
}

export function DesempenoEquipo({
  usuarios,
  usuariosSelector,
  filtro,
}: DesempenoEquipoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4" />
          Desempeño del Equipo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <RankingUsuarios usuarios={usuarios} />
        <HistoricoUsuarioChart
          usuariosSelector={usuariosSelector}
          filtro={filtro}
        />
      </CardContent>
    </Card>
  );
}

// ─── Ranking de usuarios ────────────────────────────────────────────────────

function RankingUsuarios({ usuarios }: { usuarios: DesempenoUsuario[] }) {
  if (usuarios.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        Sin datos en el período
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {usuarios.map((u, index) => (
        <div key={u.id} className="flex items-center gap-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-xs font-bold shrink-0">
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{u.nombre}</p>
            <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
              <span>{u.clientesRegistrados} clientes</span>
              <span>{u.tramitesGestionados} trámites</span>
              <span>{u.citasGestionadas} citas</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-semibold text-green-600">
              {u.ingresosGenerados.toLocaleString("es-BO")} Bs.
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Histórico individual ───────────────────────────────────────────────────

function HistoricoUsuarioChart({
  usuariosSelector,
  filtro,
}: {
  usuariosSelector: UsuarioSelector[];
  filtro: FiltroFecha;
}) {
  const [usuarioId, setUsuarioId] = useState<string>("");
  const [tipoGrafico, setTipoGrafico] =
    useState<TipoGraficoHistorico>("barras");
  const [historico, setHistorico] = useState<HistoricoUsuarioPunto[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const cargarHistorico = useCallback(async () => {
    if (!usuarioId) {
      setHistorico([]);
      return;
    }

    setIsLoading(true);
    const resultado = await obtenerHistoricoUsuario(usuarioId, filtro);
    if (resultado.success && resultado.data) {
      setHistorico(resultado.data);
    }
    setIsLoading(false);
  }, [usuarioId, filtro]);

  useEffect(() => {
    cargarHistorico();
  }, [cargarHistorico]);

  return (
    <div className="border-t pt-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <Select value={usuarioId} onValueChange={setUsuarioId}>
          <SelectTrigger className="h-8 text-xs w-full sm:w-56">
            <SelectValue placeholder="Seleccionar usuario" />
          </SelectTrigger>
          <SelectContent>
            {usuariosSelector.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-1">
          <Button
            variant={tipoGrafico === "barras" ? "default" : "outline"}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setTipoGrafico("barras")}
          >
            <BarChart3 className="h-4 w-4" />
          </Button>
          <Button
            variant={tipoGrafico === "lineas" ? "default" : "outline"}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setTipoGrafico("lineas")}
          >
            <LineChartIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!usuarioId ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Selecciona un usuario para ver su histórico de actividad
        </p>
      ) : isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          {tipoGrafico === "barras" ? (
            <BarChart data={historico}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="clientesRegistrados"
                fill="#3b82f6"
                name="Clientes"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="tramitesGestionados"
                fill="#8b5cf6"
                name="Trámites"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="citasGestionadas"
                fill="#f59e0b"
                name="Citas"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          ) : (
            <LineChart data={historico}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="clientesRegistrados"
                stroke="#3b82f6"
                name="Clientes"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="tramitesGestionados"
                stroke="#8b5cf6"
                name="Trámites"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="citasGestionadas"
                stroke="#f59e0b"
                name="Citas"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  );
}
