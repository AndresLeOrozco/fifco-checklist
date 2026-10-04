import type { EstadoUnidad } from "@/lib/supabase/database.types";

export const ZONA_HORARIA = "America/Costa_Rica";

const hora = new Intl.DateTimeFormat("es-CR", { timeZone: ZONA_HORARIA, hour: "2-digit", minute: "2-digit", hour12: false });
const fechaLarga = new Intl.DateTimeFormat("es-CR", { timeZone: ZONA_HORARIA, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fechaCorta = new Intl.DateTimeFormat("es-CR", { timeZone: ZONA_HORARIA, weekday: "short", day: "numeric", month: "short" });
const fechaHora = new Intl.DateTimeFormat("es-CR", { timeZone: ZONA_HORARIA, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
const numero = new Intl.NumberFormat("es-CR");

export const formatoHora = (iso: string) => hora.format(new Date(iso));
export const formatoFechaHora = (iso: string) => fechaHora.format(new Date(iso)).replace(",", " ·");
export const formatoKm = (km: number | null | undefined) => (km == null ? "—" : `${numero.format(km)} km`);

export function formatoFechaLarga(d = new Date()) {
  const t = fechaLarga.format(d);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function formatoFechaCorta(d = new Date()) {
  const t = fechaCorta.format(d).replace(/\./g, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Inicio del día de hoy en Costa Rica (UTC-6, sin horario de verano), en ISO UTC.
export function inicioDeHoyCR(ahora = new Date()): string {
  const cr = new Date(ahora.getTime() - 6 * 3600_000);
  cr.setUTCHours(0, 0, 0, 0);
  return new Date(cr.getTime() + 6 * 3600_000).toISOString();
}

export const ETIQUETA_ESTADO: Record<EstadoUnidad, string> = {
  apto: "Apto",
  requiere_correccion: "Requiere corrección",
  no_apto: "No apto",
};

export function saludo(ahora = new Date()) {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: ZONA_HORARIA, hour: "numeric", hour12: false }).format(ahora));
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}
