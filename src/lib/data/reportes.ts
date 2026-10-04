import "server-only";
import { db } from "@/lib/supabase/server";
import { finDiaCR, inicioDiaCR, type Filtros } from "@/lib/reportes/filtros";

export const POR_PAGINA = 20;

function consulta(f: Filtros) {
  let q = db().from("v_reporte_inspecciones").select("*", { count: "exact" }).not("finalizada_at", "is", null);
  if (f.desde) q = q.gte("iniciada_at", inicioDiaCR(f.desde));
  if (f.hasta) q = q.lt("iniciada_at", finDiaCR(f.hasta));
  if (f.camion) q = q.eq("camion_id", f.camion);
  if (f.conductor) q = q.eq("conductor_id", f.conductor);
  if (f.ruta) q = q.eq("ruta_id", f.ruta);
  if (f.estado) q = q.eq("resultado", f.estado);
  if (f.tipo) q = q.eq("tipo", f.tipo);
  return q.order("iniciada_at", { ascending: false });
}

export async function buscarInspecciones(f: Filtros) {
  const desde = (f.pagina - 1) * POR_PAGINA;
  const { data, count, error } = await consulta(f).range(desde, desde + POR_PAGINA - 1);
  if (error) throw new Error(`No se pudieron cargar los reportes: ${error.message}`);
  return { filas: data, total: count ?? 0 };
}

// Para exportar: hasta 5 000 filas en bloques de 1 000 (límite por consulta de Supabase).
export async function todasLasInspecciones(f: Filtros) {
  const filas = [];
  for (let desde = 0; desde < 5000; desde += 1000) {
    const { data, error } = await consulta(f).range(desde, desde + 999);
    if (error) throw new Error(`No se pudo exportar: ${error.message}`);
    filas.push(...data);
    if (data.length < 1000) break;
  }
  return filas;
}

// Opciones de los filtros (incluye registros inactivos, para consultar historial)
export async function opcionesFiltro() {
  const [c, p, r] = await Promise.all([
    db().from("camiones").select("id, numero_unidad, placa").order("numero_unidad"),
    db().from("personal").select("id, nombre").eq("rol", "conductor").order("nombre"),
    db().from("rutas").select("id, codigo, descripcion").order("codigo"),
  ]);
  return { camiones: c.data ?? [], conductores: p.data ?? [], rutas: r.data ?? [] };
}
