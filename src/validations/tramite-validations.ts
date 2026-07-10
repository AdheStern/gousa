// src/validations/tramite-validations.ts

import { z } from "zod";
import { optionalDateSchema } from "@/lib/validations/date-helpers";

export const createClienteServicioSchema = z.object({
  clienteId: z.string().min(1),
  servicioId: z.string().min(1, "El servicio es requerido"),
  precioAcordado: z
    .number({ invalid_type_error: "El precio debe ser un número" })
    .min(0, "El precio no puede ser negativo"),
  descuentoAplicado: z.number().min(0).optional().nullable(),
  precioFinal: z
    .number({ invalid_type_error: "El precio final debe ser un número" })
    .min(0),
  estadoPagoId: z.string().min(1, "El estado de pago es requerido"),
  notas: z.string().max(2000).trim().optional().nullable(),
});

export const updateClienteServicioSchema = z.object({
  precioAcordado: z.number().min(0).optional(),
  descuentoAplicado: z.number().min(0).optional().nullable(),
  precioFinal: z.number().min(0).optional(),
  estadoPagoId: z.string().optional(),
  notas: z.string().max(2000).trim().optional().nullable(),
});

export const createTramiteSchema = z.object({
  clienteId: z.string().min(1),
  clienteServicioId: z.string().min(1),
  estadoActualId: z.string().min(1, "El estado inicial es requerido"),
  usuarioAsignadoId: z.string().optional().nullable(),
  notas: z.string().max(2000).trim().optional().nullable(),
});

export const updateTramiteSchema = z.object({
  usuarioAsignadoId: z.string().optional().nullable(),
  codigoConfirmacionDs160: z.string().max(255).trim().optional().nullable(),
  codigoSeguimientoCourier: z.string().max(255).trim().optional().nullable(),
  visaNumero: z.string().max(100).trim().optional().nullable(),
  visaFechaEmision: optionalDateSchema,
  visaFechaExpiracion: optionalDateSchema,
  notas: z.string().max(2000).trim().optional().nullable(),
});

export const cambiarEstadoTramiteSchema = z.object({
  estadoId: z.string().min(1, "El estado es requerido"),
  observacion: z.string().max(2000).trim().optional().nullable(),
});

export type CreateClienteServicioFormData = z.infer<
  typeof createClienteServicioSchema
>;
export type UpdateClienteServicioFormData = z.infer<
  typeof updateClienteServicioSchema
>;
export type CreateTramiteFormData = z.infer<typeof createTramiteSchema>;
export type UpdateTramiteFormData = z.infer<typeof updateTramiteSchema>;
export type CambiarEstadoTramiteFormData = z.infer<
  typeof cambiarEstadoTramiteSchema
>;

export const cambiarEstadoPagoSchema = z.object({
  estadoPagoId: z.string().min(1, "Debes seleccionar un estado de pago"),
});

export type CambiarEstadoPagoFormData = z.infer<typeof cambiarEstadoPagoSchema>;
