import "server-only";
import { db } from "@/lib/supabase/server";

export type UnidadEnRuta = {
  viajeId: string;
  numeroUnidad: string;
  placa: string;
  ruta: string;
  salidaAt: string;
};

// Viajes abiertos (unidades que salieron y aún no registran retorno).
export async function unidadesEnRuta(): Promise<UnidadEnRuta[]> {
  const { data, error } = await db()
    .from("viajes")
    .select("id, salida_at, camiones!viajes_camion_id_fkey(numero_unidad, placa), rutas!viajes_ruta_id_fkey(codigo, descripcion)")
    .eq("estado", "en_ruta")
    .order("salida_at", { ascending: true });

  if (error) throw new Error(`No se pudieron cargar las unidades en ruta: ${error.message}`);

  return data.map((v) => ({
    viajeId: v.id,
    numeroUnidad: v.camiones.numero_unidad,
    placa: v.camiones.placa,
    ruta: `${v.rutas.codigo} · ${v.rutas.descripcion}`,
    salidaAt: v.salida_at,
  }));
}
