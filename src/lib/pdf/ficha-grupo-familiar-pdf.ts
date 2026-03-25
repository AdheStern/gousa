// src/lib/pdf/ficha-grupo-familiar-pdf.ts

import type { ClienteCompleto } from "@/types/cliente-types";

type GrupoFamiliar = {
  id: string;
  nombre: string;
  descripcion: string | null;
};

type MiembroConDatos = {
  esTitular: boolean;
  parentesco: { nombre: string };
  cliente: ClienteCompleto;
};

/**
 * Formatea una fecha extrayendo sus componentes en UTC para evitar desfase
 * de zona horaria cuando PostgreSQL entrega fechas como medianoche UTC.
 */
function formatDateUTC(val: Date | string | null | undefined): string | null {
  if (!val) return null;
  try {
    const d = typeof val === "string" ? new Date(val) : val;
    if (Number.isNaN(d.getTime())) return null;
    const day = String(d.getUTCDate()).padStart(2, "0");
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return null;
  }
}

/**
 * Genera un PDF único con fichas individuales para cada miembro del grupo familiar.
 * Patrón Composite: agrupa múltiples fichas en un solo documento descargable.
 */
export async function descargarFichasGrupoFamiliarPdf(
  grupo: GrupoFamiliar,
  miembros: MiembroConDatos[],
): Promise<void> {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let primeraFicha = true;

  for (const miembro of miembros) {
    if (!primeraFicha) {
      doc.addPage();
    }
    primeraFicha = false;
    await generarFichaEnDoc(doc, miembro.cliente, miembro, grupo);
  }

  const nombreArchivo = `grupo-${grupo.nombre
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")}-${new Date().toISOString().slice(0, 10)}.pdf`;

  doc.save(nombreArchivo);
}

/**
 * Renderiza la ficha de un miembro dentro de un documento jsPDF existente.
 */
async function generarFichaEnDoc(
  doc: any,
  cliente: ClienteCompleto,
  miembro: MiembroConDatos,
  grupo: GrupoFamiliar,
): Promise<void> {
  const MARGEN_IZQ = 15;
  const MARGEN_DER = 195;
  const COLOR_PRIMARIO: [number, number, number] = [30, 64, 175];
  const COLOR_TEXTO: [number, number, number] = [30, 30, 30];
  const COLOR_LABEL: [number, number, number] = [80, 80, 80];

  let y = 20;

  doc.setFillColor(...COLOR_PRIMARIO);
  doc.rect(0, 0, 210, 18, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("FICHA DE CLIENTE - GRUPO FAMILIAR", MARGEN_IZQ, 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(grupo.nombre, MARGEN_DER, 11, { align: "right" });

  doc.setTextColor(...COLOR_TEXTO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const rol = miembro.esTitular
    ? "TITULAR"
    : miembro.parentesco.nombre.toUpperCase();
  doc.text(rol, MARGEN_IZQ, y + 6);
  y += 10;

  doc.setFontSize(14);
  doc.text(`${cliente.nombres} ${cliente.apellidos}`, MARGEN_IZQ, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const agregarCampo = (label: string, valor: string | null | undefined) => {
    if (valor) {
      doc.setTextColor(...COLOR_LABEL);
      doc.text(`${label}:`, MARGEN_IZQ, y);
      doc.setTextColor(...COLOR_TEXTO);
      doc.text(valor, MARGEN_IZQ + 50, y);
      y += 6;
    }
  };

  agregarCampo("Tipo", cliente.tipoCliente === "ADULTO" ? "Adulto" : "Infante");
  agregarCampo("CI", cliente.numeroCi);
  agregarCampo("Pasaporte", cliente.numeroPasaporte);
  agregarCampo("Email", cliente.email);
  agregarCampo("Teléfono", cliente.telefonoCelular);
  agregarCampo("Región", cliente.region?.nombre);
  agregarCampo("Fecha Nacimiento", formatDateUTC(cliente.fechaNacimiento));

  y = 280;
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_LABEL);
  doc.text(
    `Grupo: ${grupo.nombre} • Generado: ${new Date().toLocaleDateString("es-BO", { timeZone: "America/La_Paz" })}`,
    105,
    y,
    { align: "center" },
  );
}
