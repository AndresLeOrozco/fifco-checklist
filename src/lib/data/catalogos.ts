import "server-only";
import { db } from "@/lib/supabase/server";
import type { Tabla, TipoInspeccion } from "@/lib/supabase/database.types";

function fallo(que: string, error: { message: string } | null): never {
  throw new Error(`No se pudo cargar ${que}: ${error?.message ?? "error desconocido"}`);
}

export async function camionesActivos() {
  const [{ data, error }, abiertos] = await Promise.all([
    db().from("camiones").select("*").eq("activo", true).order("numero_unidad"),
    db().from("viajes").select("camion_id").eq("estado", "en_ruta"),
  ]);
  if (error) fallo("los camiones", error);
  if (abiertos.error) fallo("los viajes abiertos", abiertos.error);
  const enRuta = new Set(abiertos.data.map((v) => v.camion_id));
  return data.map((c) => ({ ...c, en_ruta: enRuta.has(c.id) }));
}

export async function personalActivo() {
  const { data, error } = await db().from("personal").select("*").eq("activo", true).order("nombre");
  if (error) fallo("el personal", error);
  return {
    conductores: data.filter((p) => p.rol === "conductor"),
    supervisores: data.filter((p) => p.rol === "supervisor"),
  };
}

export async function rutasActivas() {
  const { data, error } = await db().from("rutas").select("*").eq("activo", true).order("codigo");
  if (error) fallo("las rutas", error);
  return data;
}

export async function puntosChecklist(tipo: TipoInspeccion): Promise<Tabla<"checklist_items">[]> {
  const { data, error } = await db().from("checklist_items").select("*").eq("tipo", tipo).eq("activo", true).order("orden");
  if (error) fallo("el checklist", error);
  return data;
}

export type ViajeAbierto = {
  id: string;
  folio: string;
  kmInicial: number;
  salidaAt: string;
  camion: { numero: string; placa: string; tipo: Tabla<"camiones">["tipo"] };
  conductor: string;
  ruta: string;
  resultadoSalida: Tabla<"inspecciones">["resultado"];
};

export async function viajesAbiertos(): Promise<ViajeAbierto[]> {
  const { data, error } = await db()
    .from("viajes")
    .select(
      "id, folio, km_inicial, salida_at, camiones!viajes_camion_id_fkey(numero_unidad, placa, tipo), personal!viajes_conductor_id_fkey(nombre), rutas!viajes_ruta_id_fkey(codigo, descripcion), inspecciones!inspecciones_viaje_id_fkey(tipo, resultado)",
    )
    .eq("estado", "en_ruta")
    .order("salida_at");
  if (error) fallo("los viajes abiertos", error);
  return data.map((v) => ({
    id: v.id,
    folio: v.folio,
    kmInicial: v.km_inicial,
    salidaAt: v.salida_at,
    camion: { numero: v.camiones.numero_unidad, placa: v.camiones.placa, tipo: v.camiones.tipo },
    conductor: v.personal.nombre,
    ruta: `${v.rutas.codigo} · ${v.rutas.descripcion}`,
    resultadoSalida: v.inspecciones.find((i) => i.tipo === "salida")?.resultado ?? null,
  }));
}
