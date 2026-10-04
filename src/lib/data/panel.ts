import "server-only";
import { db } from "@/lib/supabase/server";
import { inicioDeHoyCR } from "@/lib/formato";
import type { Database, EstadoUnidad } from "@/lib/supabase/database.types";

type FilaReporte = Database["public"]["Views"]["v_reporte_inspecciones"]["Row"];

export type ResumenPanel = {
  inspeccionesHoy: number;
  salidasHoy: number;
  retornosHoy: number;
  enRuta: number;
  unidadesActivas: number;
  requierenCorreccion: number;
  noAptas: number;
  unidadesBloqueadas: { id: string; numeroUnidad: string; placa: string; estado: EstadoUnidad }[];
  recientes: FilaReporte[];
};

function fallo(que: string, error: { message: string } | null): never {
  throw new Error(`No se pudo cargar ${que}: ${error?.message ?? "error desconocido"}`);
}

export async function resumenPanel(): Promise<ResumenPanel> {
  const cliente = db();
  const hoy = inicioDeHoyCR();

  const [inspHoy, enRuta, camiones, recientes] = await Promise.all([
    cliente.from("inspecciones").select("tipo").gte("iniciada_at", hoy).not("finalizada_at", "is", null),
    cliente.from("viajes").select("id", { count: "exact", head: true }).eq("estado", "en_ruta"),
    cliente.from("camiones").select("id, numero_unidad, placa, estado_actual").eq("activo", true),
    cliente
      .from("v_reporte_inspecciones")
      .select("*")
      .not("finalizada_at", "is", null)
      .order("iniciada_at", { ascending: false })
      .limit(8),
  ]);

  if (inspHoy.error) fallo("las inspecciones de hoy", inspHoy.error);
  if (enRuta.error) fallo("las unidades en ruta", enRuta.error);
  if (camiones.error) fallo("los camiones", camiones.error);
  if (recientes.error) fallo("las inspecciones recientes", recientes.error);

  const bloqueadas = camiones.data
    .filter((c) => c.estado_actual !== "apto")
    .sort((a, b) => (a.estado_actual === "no_apto" ? -1 : 1) - (b.estado_actual === "no_apto" ? -1 : 1))
    .map((c) => ({ id: c.id, numeroUnidad: c.numero_unidad, placa: c.placa, estado: c.estado_actual }));

  return {
    inspeccionesHoy: inspHoy.data.length,
    salidasHoy: inspHoy.data.filter((i) => i.tipo === "salida").length,
    retornosHoy: inspHoy.data.filter((i) => i.tipo === "retorno").length,
    enRuta: enRuta.count ?? 0,
    unidadesActivas: camiones.data.length,
    requierenCorreccion: camiones.data.filter((c) => c.estado_actual === "requiere_correccion").length,
    noAptas: camiones.data.filter((c) => c.estado_actual === "no_apto").length,
    unidadesBloqueadas: bloqueadas,
    recientes: recientes.data,
  };
}
