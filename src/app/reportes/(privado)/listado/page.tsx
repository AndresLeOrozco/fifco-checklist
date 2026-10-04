import type { Metadata } from "next";
import Link from "next/link";
import { EstadoBadge } from "@/components/estado-badge";
import { POR_PAGINA, buscarInspecciones, opcionesFiltro } from "@/lib/data/reportes";
import { aQuery, leerFiltros } from "@/lib/reportes/filtros";
import { exigirSesionReportes } from "@/lib/reportes/guardia";
import { formatoFechaHora } from "@/lib/formato";

export const metadata: Metadata = { title: "Reportes" };

const campo = "h-[42px] w-full min-w-0 rounded-lg border border-linea-fuerte bg-white px-2.5 text-sm text-tinta";
const etiqueta = "text-xs font-medium text-tinta-suave";

// Pantalla 10 · Reportes con filtros (formulario GET: los filtros quedan en la URL)
export default async function ListadoPage({ searchParams }: PageProps<"/reportes/listado">) {
  await exigirSesionReportes();
  const f = leerFiltros(await searchParams);
  const [{ filas, total }, op] = await Promise.all([buscarInspecciones(f), opcionesFiltro()]);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const sinPagina: Partial<typeof f> = { ...f, pagina: undefined };
  const desdeN = total === 0 ? 0 : (f.pagina - 1) * POR_PAGINA + 1;
  const hastaN = Math.min(f.pagina * POR_PAGINA, total);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] text-tinta-suave">Inspecciones de salida y retorno</p>
          <h1 className="mt-1 text-[26px] font-semibold">Reportes</h1>
        </div>
        <a
          href={`/reportes/exportar${aQuery(sinPagina)}`}
          className="flex h-11 items-center rounded-[10px] border border-marca px-4 text-sm font-semibold text-marca hover:bg-marca-suave"
        >
          Exportar a Excel
        </a>
      </div>

      <form method="get" className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] items-end gap-3.5 rounded-2xl border border-linea p-5">
        <label className="flex flex-col gap-1.5"><span className={etiqueta}>Desde</span>
          <input type="date" name="desde" defaultValue={f.desde} className={campo} />
        </label>
        <label className="flex flex-col gap-1.5"><span className={etiqueta}>Hasta</span>
          <input type="date" name="hasta" defaultValue={f.hasta} className={campo} />
        </label>
        <label className="flex flex-col gap-1.5"><span className={etiqueta}>Placa o unidad</span>
          <select name="camion" defaultValue={f.camion ?? ""} className={campo}>
            <option value="">Todas</option>
            {op.camiones.map((c) => <option key={c.id} value={c.id}>{c.numero_unidad} · {c.placa}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5"><span className={etiqueta}>Conductor</span>
          <select name="conductor" defaultValue={f.conductor ?? ""} className={campo}>
            <option value="">Todos</option>
            {op.conductores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5"><span className={etiqueta}>Ruta</span>
          <select name="ruta" defaultValue={f.ruta ?? ""} className={campo}>
            <option value="">Todas</option>
            {op.rutas.map((r) => <option key={r.id} value={r.id}>{r.codigo} · {r.descripcion}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5"><span className={etiqueta}>Estado</span>
          <select name="estado" defaultValue={f.estado ?? ""} className={campo}>
            <option value="">Todos</option>
            <option value="apto">Apto</option>
            <option value="requiere_correccion">Requiere corrección</option>
            <option value="no_apto">No apto</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5"><span className={etiqueta}>Tipo</span>
          <select name="tipo" defaultValue={f.tipo ?? ""} className={campo}>
            <option value="">Salida y retorno</option>
            <option value="salida">Salida</option>
            <option value="retorno">Retorno</option>
          </select>
        </label>
        <div className="flex gap-2">
          <button type="submit" className="h-[42px] flex-1 rounded-lg bg-marca text-sm font-semibold text-white hover:bg-marca-oscuro">Aplicar</button>
          <Link href="/reportes/listado" className="flex h-[42px] items-center rounded-lg border border-linea-fuerte px-3 text-sm text-tinta-suave">Limpiar</Link>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-tinta-suave">
        <span><strong className="text-tinta">{total} {total === 1 ? "resultado" : "resultados"}</strong></span>
        <span>Ordenado por fecha, más reciente primero</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-linea">
        <table className="w-full min-w-[1000px] text-left text-[13px]">
          <thead className="bg-fondo-suave text-xs text-tinta-suave">
            <tr>
              {["Folio", "Fecha", "Tipo", "Unidad", "Placa", "Conductor", "Ruta", "Estado", "Hallazgos", ""].map((h, i) => (
                <th key={i} scope="col" className="px-4 py-3 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-tinta-suave">No hay inspecciones con estos filtros.</td></tr>
            )}
            {filas.map((r) => (
              <tr key={r.id} className="border-t border-[#EEF2F7]">
                <td className="px-4 py-3 font-mono text-xs">{r.folio}</td>
                <td className="whitespace-nowrap px-4 py-3">{formatoFechaHora(r.iniciada_at)}</td>
                <td className="px-4 py-3 capitalize">{r.tipo}</td>
                <td className="px-4 py-3 font-semibold">{r.numero_unidad}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.placa}</td>
                <td className="px-4 py-3">{r.conductor}</td>
                <td className="px-4 py-3">{r.ruta_codigo} · {r.ruta}</td>
                <td className="px-4 py-3"><EstadoBadge estado={r.resultado} /></td>
                <td className="px-4 py-3 text-center">{r.hallazgos}</td>
                <td className="px-4 py-3">
                  <Link href={`/reportes/viajes/${r.viaje_id}`} className="font-semibold text-marca">Ver</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] text-tinta-suave">Mostrando {desdeN} a {hastaN} de {total}</span>
        <nav className="flex gap-1.5" aria-label="Paginación">
          {f.pagina > 1 ? (
            <Link href={`/reportes/listado${aQuery({ ...sinPagina, pagina: f.pagina - 1 })}`} className="flex h-10 min-w-10 items-center justify-center rounded-lg border border-linea-fuerte px-3 text-sm" aria-label="Página anterior">‹</Link>
          ) : null}
          <span className="flex h-10 min-w-10 items-center justify-center rounded-lg border border-marca bg-marca px-3 text-sm font-semibold text-white">{f.pagina}</span>
          <span className="flex h-10 items-center px-1 text-sm text-tinta-suave">de {paginas}</span>
          {f.pagina < paginas ? (
            <Link href={`/reportes/listado${aQuery({ ...sinPagina, pagina: f.pagina + 1 })}`} className="flex h-10 min-w-10 items-center justify-center rounded-lg border border-linea-fuerte px-3 text-sm" aria-label="Página siguiente">›</Link>
          ) : null}
        </nav>
      </div>
    </>
  );
}
