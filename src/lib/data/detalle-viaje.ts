import "server-only";
import { db } from "@/lib/supabase/server";
import type { EstadoUnidad, ResultadoItem, Tabla, TipoInspeccion } from "@/lib/supabase/database.types";

export type RespuestaDetalle = {
  id: string;
  orden: number;
  titulo: string;
  critico: boolean;
  resultado: ResultadoItem;
  comentario: string | null;
  fotos: string[]; // rutas en storage
};

export type InspeccionDetalle = {
  id: string;
  folio: string;
  tipo: TipoInspeccion;
  iniciadaAt: string;
  finalizadaAt: string | null;
  resultado: EstadoUnidad | null;
  kilometraje: number;
  combustible: string | null;
  observaciones: string | null;
  supervisor: string | null;
  respuestas: RespuestaDetalle[];
  firmas: { tipo: "conductor" | "supervisor"; nombre: string; ruta: string; firmadoAt: string }[];
  conteo: { ok: number; falla: number; na: number };
};

export type DetalleViaje = {
  id: string;
  folio: string;
  estado: Tabla<"viajes">["estado"];
  kmInicial: number;
  kmFinal: number | null;
  kmRecorridos: number | null;
  salidaAt: string;
  retornoAt: string | null;
  camion: { id: string; numero: string; placa: string; tipo: Tabla<"camiones">["tipo"]; estadoActual: EstadoUnidad };
  conductor: string;
  ruta: string;
  salida: InspeccionDetalle | null;
  retorno: InspeccionDetalle | null;
};

export async function detalleViaje(viajeId: string): Promise<DetalleViaje | null> {
  const cliente = db();
  const { data: v, error } = await cliente
    .from("viajes")
    .select(
      "*, camiones!viajes_camion_id_fkey(id, numero_unidad, placa, tipo, estado_actual), personal!viajes_conductor_id_fkey(nombre), rutas!viajes_ruta_id_fkey(codigo, descripcion)",
    )
    .eq("id", viajeId)
    .maybeSingle();
  if (error) throw new Error(`No se pudo cargar el viaje: ${error.message}`);
  if (!v) return null;

  const { data: inspecciones, error: e2 } = await cliente
    .from("inspecciones")
    .select(
      "*, supervisor:personal!inspecciones_supervisor_id_fkey(nombre), respuestas_inspeccion(id, resultado, comentario, item_titulo, item_critico, checklist_items(orden), fotos_hallazgo(storage_path)), firmas(tipo, storage_path, firmado_at, personal(nombre))",
    )
    .eq("viaje_id", viajeId)
    .not("finalizada_at", "is", null);
  if (e2) throw new Error(`No se pudieron cargar las inspecciones: ${e2.message}`);

  const armar = (tipo: TipoInspeccion): InspeccionDetalle | null => {
    const i = inspecciones.find((x) => x.tipo === tipo);
    if (!i) return null;
    const respuestas = i.respuestas_inspeccion
      .map((r) => ({
        id: r.id,
        orden: r.checklist_items?.orden ?? 0,
        titulo: r.item_titulo,
        critico: r.item_critico,
        resultado: r.resultado,
        comentario: r.comentario,
        fotos: r.fotos_hallazgo.map((f) => f.storage_path),
      }))
      .sort((a, b) => a.orden - b.orden);
    return {
      id: i.id,
      folio: i.folio,
      tipo: i.tipo,
      iniciadaAt: i.iniciada_at,
      finalizadaAt: i.finalizada_at,
      resultado: i.resultado,
      kilometraje: i.kilometraje,
      combustible: i.combustible,
      observaciones: i.observaciones,
      supervisor: i.supervisor?.nombre ?? null,
      respuestas,
      firmas: i.firmas.map((f) => ({ tipo: f.tipo, nombre: f.personal?.nombre ?? "", ruta: f.storage_path, firmadoAt: f.firmado_at })),
      conteo: {
        ok: respuestas.filter((r) => r.resultado === "ok").length,
        falla: respuestas.filter((r) => r.resultado === "falla").length,
        na: respuestas.filter((r) => r.resultado === "na").length,
      },
    };
  };

  return {
    id: v.id,
    folio: v.folio,
    estado: v.estado,
    kmInicial: v.km_inicial,
    kmFinal: v.km_final,
    kmRecorridos: v.km_recorridos,
    salidaAt: v.salida_at,
    retornoAt: v.retorno_at,
    camion: {
      id: v.camiones.id,
      numero: v.camiones.numero_unidad,
      placa: v.camiones.placa,
      tipo: v.camiones.tipo,
      estadoActual: v.camiones.estado_actual,
    },
    conductor: v.personal.nombre,
    ruta: `${v.rutas.codigo} · ${v.rutas.descripcion}`,
    salida: armar("salida"),
    retorno: armar("retorno"),
  };
}
