// src/lib/utils/date-format-helper.ts

/**
 * Convierte una fecha a formato string YYYY-MM-DD para inputs de tipo date.
 * Usa métodos UTC para evitar desfase de zona horaria al leer componentes de fecha.
 */
export function formatDateForInput(
  date: Date | string | null | undefined,
): string | null {
  if (!date) return null;
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    if (Number.isNaN(dateObj.getTime())) {
      return null;
    }
    const year = dateObj.getUTCFullYear();
    const month = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch {
    return null;
  }
}

/**
 * Convierte múltiples campos de fecha en un objeto usando formatDateForInput.
 */
export function formatDatesForInput<T extends Record<string, unknown>>(
  obj: T,
  dateFields: Array<keyof T>,
): T {
  const result = { ...obj };
  for (const field of dateFields) {
    const value = obj[field];
    if (value instanceof Date || typeof value === "string") {
      // @ts-expect-error - Conversión de Date a string YYYY-MM-DD
      result[field] = formatDateForInput(value);
    }
  }
  return result;
}
