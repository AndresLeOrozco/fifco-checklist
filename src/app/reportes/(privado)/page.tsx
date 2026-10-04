import type { Metadata } from "next";
import { EstadoBadge } from "@/components/estado-badge";
import { resumenPanel } from "@/lib/data/panel";
import { exigirSesionReportes } from "@/lib/reportes/guardia";
import { formatoFechaHora, formatoFechaLarga } from "@/lib/formato";

export const metadata: Metadata = { title: "Panel" };

// Pantalla 9 · Panel de flota
export default async function PanelPage() {
  await exigirSesionReportes();
  const r = await resumenPanel();

  const kpis = [
    { etiqueta: "Inspecciones hoy", valor: r.inspeccionesHoy, detalle: `${r.salidasHoy} salidas · ${r.retornosHoy} retornos`, color: "text-tinta" },
    { etiqueta: "Unidades en ruta", valor: r.enRuta, detalle: `de ${r.unidadesActivas} unidades activas`, color: "text-marca" },
    { etiqueta: "Requieren corrección", valor: r.requierenCorreccion, detalle: "Pendientes de autorización", color: "text-correccion" },
    { etiqueta: "No aptas", valor: r.noAptas, detalle: "Inmovilizadas hasta liberación", color: "text-noapto" },
  ];

  return (
    <>
      <div>
        <p className="text-[13px] text-tinta-suave">{formatoFechaLarga()}</p>
        <h1 className="mt-1 text-[26px] font-semibold">Panel de flota</h1>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
        {kpis.map((k) => (
          <div key={k.etiqueta} className="flex flex-col gap-1.5 rounded-2xl border border-linea px-5 py-4">
            <span className="text-[13px] text-tinta-suave">{k.etiqueta}</span>
            <span className={`text-3xl font-semibold leading-tight ${k.color}`}>{k.valor}</span>
            <span className="text-xs text-tinta-suave">{k.detalle}</span>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-3.5 rounded-2xl border border-linea p-5">
        <h2 className="text-base font-semibold">Unidades con hallazgos pendientes</h2>
        {r.unidadesBloqueadas.length === 0 ? (
          <p className="text-sm text-tinta-suave">Todas las unidades activas están aptas.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {r.unidadesBloqueadas.map((u) => (
              <li key={u.id} className="flex items-center gap-3.5 rounded-xl border border-linea p-3.5">
                <span className="flex-1 text-sm font-semibold">
                  Unidad {u.numeroUnidad} <span className="font-mono font-medium text-tinta-suave">{u.placa}</span>
                </span>
                <EstadoBadge estado={u.estado} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-linea">
        <div className="border-b border-linea px-5 py-4">
          <h2 className="text-base font-semibold">Inspecciones recientes</h2>
        </div>
        {r.recientes.length === 0 ? (
          <p className="px-5 py-6 text-sm text-tinta-suave">Aún no hay inspecciones registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <thead className="bg-fondo-suave text-xs text-tinta-suave">
                <tr>
                  {["Fecha", "Tipo", "Unidad", "Conductor", "Ruta", "Estado"].map((h) => (
                    <th key={h} scope="col" className="px-5 py-2.5 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.recientes.map((f) => (
                  <tr key={f.id} className="border-t border-linea/70">
                    <td className="px-5 py-3">{formatoFechaHora(f.iniciada_at)}</td>
                    <td className="px-5 py-3 capitalize">{f.tipo}</td>
                    <td className="px-5 py-3">
                      {f.numero_unidad} <span className="font-mono text-tinta-suave">{f.placa}</span>
                    </td>
                    <td className="px-5 py-3">{f.conductor}</td>
                    <td className="px-5 py-3">{f.ruta_codigo} · {f.ruta}</td>
                    <td className="px-5 py-3"><EstadoBadge estado={f.resultado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
