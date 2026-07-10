// src/components/system/tramites/tramite-detalle-drawer.tsx

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { TramiteCitasSection } from "@/components/system/citas/tramite-citas-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  cambiarEstadoPagoServicio,
  obtenerEstadosPago,
} from "@/lib/actions/tramites/servicios-actions";
import {
  actualizarTramite,
  cambiarEstadoTramite,
  obtenerEstadosTramite,
  obtenerTramitePorId,
  obtenerUsuariosAsignables,
  type TramiteDetalle,
} from "@/lib/actions/tramites/tramites-actions";
import { useSession } from "@/lib/auth-client";
import {
  type CambiarEstadoPagoFormData,
  type CambiarEstadoTramiteFormData,
  cambiarEstadoPagoSchema,
  cambiarEstadoTramiteSchema,
  type UpdateTramiteFormData,
  updateTramiteSchema,
} from "@/validations/tramite-validations";

interface TramiteDetalleDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tramiteId: string;
  onSuccess: () => void;
}

type CatalogoItem = { id: string; nombre: string; color: string | null };

/**
 * Drawer de detalle de trámite con edición inline y cambio de estado.
 * Implementa patrón Command para cada operación sobre el trámite.
 */
export function TramiteDetalleDrawer({
  open,
  onOpenChange,
  tramiteId,
  onSuccess,
}: TramiteDetalleDrawerProps) {
  const { data: session } = useSession();
  const [tramite, setTramite] = useState<TramiteDetalle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [estados, setEstados] = useState<
    Array<CatalogoItem & { orden: number }>
  >([]);
  const [estadosPago, setEstadosPago] = useState<CatalogoItem[]>([]);
  const [usuarios, setUsuarios] = useState<Array<{ id: string; name: string }>>(
    [],
  );

  const cargar = async () => {
    setIsLoading(true);
    const [tResult, eResult, epResult, uResult] = await Promise.all([
      obtenerTramitePorId(tramiteId),
      obtenerEstadosTramite(),
      obtenerEstadosPago(),
      obtenerUsuariosAsignables(),
    ]);
    if (tResult.success && tResult.data) setTramite(tResult.data);
    if (eResult.success && eResult.data) setEstados(eResult.data);
    if (epResult.success && epResult.data) setEstadosPago(epResult.data);
    if (uResult.success && uResult.data) setUsuarios(uResult.data);
    setIsLoading(false);
  };

  useEffect(() => {
    if (open) cargar();
  }, [open, tramiteId]);

  if (!open) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-4">
        <SheetHeader>
          <SheetTitle>Detalle del Trámite</SheetTitle>
        </SheetHeader>

        {isLoading || !tramite ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <TramiteInfoHeader tramite={tramite} />
            <Separator />
            <CambiarEstadoForm
              tramite={tramite}
              estados={estados}
              usuarioId={session?.user?.id ?? ""}
              onSuccess={() => {
                cargar();
                onSuccess();
              }}
            />
            <Separator />
            <CambiarEstadoPagoForm
              clienteServicioId={tramite.clienteServicioId}
              estadoPagoActual={tramite.estadoPago}
              precioServicio={tramite.precioServicio}
              estadosPago={estadosPago}
              onSuccess={() => {
                cargar();
                onSuccess();
              }}
            />
            <Separator />
            <EditarDatosTramiteForm
              tramite={tramite}
              onSuccess={() => {
                cargar();
                onSuccess();
              }}
            />
            <Separator />
            <HistorialTramite tramite={tramite} />
            <Separator />
            <TramiteCitasSection
              tramiteId={tramite.id}
              regionId={tramite.cliente.regionId}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Info header ──────────────────────────────────────────────────────────────

function TramiteInfoHeader({ tramite }: { tramite: TramiteDetalle }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-lg">
            {tramite.cliente.nombres} {tramite.cliente.apellidos}
          </p>
          <p className="text-sm text-muted-foreground">
            {tramite.servicio.nombre} · {tramite.cliente.regionNombre}
          </p>
        </div>
        <div className="flex gap-2">
          <EstadoBadge
            nombre={tramite.estadoActual.nombre}
            color={tramite.estadoActual.color}
          />
          <EstadoBadge
            nombre={tramite.estadoPago.nombre}
            color={tramite.estadoPago.color}
          />
        </div>
      </div>
      {tramite.usuarioAsignado && (
        <p className="text-xs text-muted-foreground">
          Asignado a: {tramite.usuarioAsignado.name}
        </p>
      )}
    </div>
  );
}

// ─── Cambiar estado ───────────────────────────────────────────────────────────

function CambiarEstadoForm({
  tramite,
  estados,
  usuarioId,
  onSuccess,
}: {
  tramite: TramiteDetalle;
  estados: Array<CatalogoItem & { orden: number }>;
  usuarioId: string;
  onSuccess: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { control, handleSubmit, register, reset } =
    useForm<CambiarEstadoTramiteFormData>({
      resolver: zodResolver(cambiarEstadoTramiteSchema),
      defaultValues: { estadoId: tramite.estadoActual.id },
    });

  const onSubmit = handleSubmit(async (data) => {
    setIsSubmitting(true);
    const result = await cambiarEstadoTramite(tramite.id, data, usuarioId);
    setIsSubmitting(false);
    if (result.success) {
      toast.success("Estado actualizado");
      reset({ estadoId: data.estadoId, observacion: "" });
      onSuccess();
    } else {
      toast.error(result.error ?? "Error al cambiar estado");
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="font-medium text-sm">Cambiar Estado</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nuevo estado</Label>
          <Controller
            control={control}
            name="estadoId"
            render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {estados.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-2">
          <Label>Observación</Label>
          <Input
            placeholder="Motivo del cambio..."
            {...register("observacion")}
          />
        </div>
      </div>

      <Button type="submit" size="sm" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Actualizar Estado
      </Button>
    </form>
  );
}

// ─── Cambiar estado de pago ───────────────────────────────────────────────────

function CambiarEstadoPagoForm({
  clienteServicioId,
  estadoPagoActual,
  precioServicio,
  estadosPago,
  onSuccess,
}: {
  clienteServicioId: string;
  estadoPagoActual: CatalogoItem;
  precioServicio: number;
  estadosPago: CatalogoItem[];
  onSuccess: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { control, handleSubmit } = useForm<CambiarEstadoPagoFormData>({
    resolver: zodResolver(cambiarEstadoPagoSchema),
    defaultValues: { estadoPagoId: estadoPagoActual.id },
  });

  const onSubmit = handleSubmit(async (data) => {
    setIsSubmitting(true);
    const result = await cambiarEstadoPagoServicio(clienteServicioId, data);
    setIsSubmitting(false);
    if (result.success) {
      toast.success("Estado de pago actualizado");
      onSuccess();
    } else {
      toast.error(result.error ?? "Error al cambiar estado de pago");
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-medium text-sm">Estado de Pago</p>
        <p className="text-sm font-semibold text-green-600">
          {precioServicio.toLocaleString("es-BO")} Bs.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 items-end">
        <div className="space-y-2">
          <Label>Estado</Label>
          <Controller
            control={control}
            name="estadoPagoId"
            render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {estadosPago.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Actualizar Pago
        </Button>
      </div>
    </form>
  );
}

// ─── Editar datos del trámite ─────────────────────────────────────────────────

function EditarDatosTramiteForm({
  tramite,
  onSuccess,
}: {
  tramite: TramiteDetalle;
  onSuccess: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit } = useForm<UpdateTramiteFormData>({
    resolver: zodResolver(updateTramiteSchema),
    defaultValues: {
      codigoConfirmacionDs160: tramite.codigoConfirmacionDs160 ?? "",
      codigoSeguimientoCourier: tramite.codigoSeguimientoCourier ?? "",
      visaNumero: tramite.visaNumero ?? "",
      visaFechaEmision: tramite.visaFechaEmision
        ? (tramite.visaFechaEmision as Date).toISOString().split("T")[0]
        : "",
      visaFechaExpiracion: tramite.visaFechaExpiracion
        ? (tramite.visaFechaExpiracion as Date).toISOString().split("T")[0]
        : "",
      notas: tramite.notas ?? "",
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    setIsSubmitting(true);
    const result = await actualizarTramite(tramite.id, data);
    setIsSubmitting(false);
    if (result.success) {
      toast.success("Trámite actualizado");
      onSuccess();
    } else {
      toast.error(result.error ?? "Error al actualizar");
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="font-medium text-sm">Datos del Trámite</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Código DS-160</Label>
          <Input
            placeholder="AA000000000"
            {...register("codigoConfirmacionDs160")}
          />
        </div>
        <div className="space-y-2">
          <Label>Código Courier</Label>
          <Input
            placeholder="Código de seguimiento"
            {...register("codigoSeguimientoCourier")}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Número de Visa</Label>
          <Input placeholder="Nro. visa" {...register("visaNumero")} />
        </div>
        <div className="space-y-2">
          <Label>Emisión de Visa</Label>
          <Input type="date" {...register("visaFechaEmision")} />
        </div>
        <div className="space-y-2">
          <Label>Expiración de Visa</Label>
          <Input type="date" {...register("visaFechaExpiracion")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Notas</Label>
        <Textarea rows={3} {...register("notas")} />
      </div>

      <Button type="submit" size="sm" variant="outline" disabled={isSubmitting}>
        {isSubmitting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        Guardar Cambios
      </Button>
    </form>
  );
}

// ─── Historial ────────────────────────────────────────────────────────────────

function HistorialTramite({ tramite }: { tramite: TramiteDetalle }) {
  return (
    <div className="space-y-3">
      <p className="font-medium text-sm">Historial de Estados</p>
      {tramite.historial.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin historial</p>
      ) : (
        <div className="space-y-2">
          {tramite.historial.map((h) => (
            <div key={h.id} className="flex gap-3 text-sm">
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                <div className="w-px flex-1 bg-border mt-1" />
              </div>
              <div className="pb-3">
                <div className="flex items-center gap-2">
                  <EstadoBadge
                    nombre={h.estado.nombre}
                    color={h.estado.color}
                    size="sm"
                  />
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(h.createdAt), "dd MMM yyyy HH:mm", {
                      locale: es,
                    })}
                  </span>
                </div>
                {h.observacion && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {h.observacion}
                  </p>
                )}
                {h.usuario && (
                  <p className="text-xs text-muted-foreground">
                    por {h.usuario.name}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Badge de estado ──────────────────────────────────────────────────────────

function EstadoBadge({
  nombre,
  color,
  size = "default",
}: {
  nombre: string;
  color: string | null;
  size?: "default" | "sm";
}) {
  const style = color ? { backgroundColor: color, color: "#fff" } : undefined;
  return (
    <Badge
      style={style}
      variant={color ? undefined : "secondary"}
      className={size === "sm" ? "text-xs" : ""}
    >
      {nombre}
    </Badge>
  );
}
