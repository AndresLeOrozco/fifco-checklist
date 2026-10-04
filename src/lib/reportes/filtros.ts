import "server-only";
import type { EstadoUnidad, TipoInspeccion } from "@/lib/supabase/database.types";

export type Filtros = {
  desde?: string; // YYYY-MM-DD (fecha de Costa Rica)
  hasta?: string;
  camion?: string;
  conductor?: string;
  ruta?: string;
  estado?: EstadoUnidad;
  tipo?: TipoInspeccion;
  pagina: number;
};

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_UUID = /^[0-9a-f-]{36}$/i;
const ESTADOS = ["apto", "requiere_correccion", "no_apto"] as const;
const TIPOS = ["salida", "retorno"] as const;

type Parametros = Record<string, string | string[] | undefined>;
const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

// Lee y valida los filtros de la URL (lo que no es válido se ignora).
export function leerFiltros(sp: Parametros | URLSearchParams): Filtros {
  const get = (k: string) => (sp instanceof URLSearchParams ? sp.get(k) ?? undefined : uno(sp[k]));
  const desde = get("desde");
  const hasta = get("hasta");
  const estado = get("estado");
  const tipo = get("tipo");
  const pagina = Number(get("pagina") ?? 1);
  const id = (k: string) => {
    const v = get(k);
    return v && RE_UUID.test(v) ? v : undefined;
  };
  return {
    desde: desde && RE_FECHA.test(desde) ? desde : undefined,
    hasta: hasta && RE_FECHA.test(hasta) ? hasta : undefined,
    camion: id("camion"),
    conductor: id("conductor"),
    ruta: id("ruta"),
    estado: ESTADOS.find((e) => e === estado),
    tipo: TIPOS.find((t) => t === tipo),
    pagina: Number.isInteger(pagina) && pagina > 0 ? pagina : 1,
  };
}

// Fecha de Costa Rica (UTC-6) → instante UTC
export const inicioDiaCR = (fecha: string) => `${fecha}T06:00:00.000Z`;
export function finDiaCR(fecha: string) {
  const d = new Date(`${fecha}T06:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

export function aQuery(f: Partial<Filtros>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== "" && !(k === "pagina" && v === 1)) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}
