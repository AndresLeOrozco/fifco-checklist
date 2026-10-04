import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EstadoBadge } from "@/components/estado-badge";
import { FranjaMarca } from "@/components/marca";
import { db } from "@/lib/supabase/server";
import { formatoFechaCorta, formatoHora } from "@/lib/formato";
import type { EstadoUnidad } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Inspección enviada" };

const MENSAJES: Record<"salida" | "retorno", Record<EstadoUnidad, string>> = {
  salida: {
    apto: "La unidad puede salir a ruta. La inspección quedó registrada.",
    requiere_correccion: "Se registró un hallazgo menor. La unidad sale solo con la autorización del supervisor.",
    no_apto: "La unidad NO sale a ruta: queda inmovilizada y el viaje se canceló. Se notifica por correo al supervisor.",
  },
  retorno: {
    apto: "Viaje cerrado. El reporte del viaje se envía por correo.",
    requiere_correccion: "Viaje cerrado con hallazgos pendientes. El reporte se envía por correo al supervisor.",
    no_apto: "Viaje cerrado. La unidad queda inmovilizada hasta su liberación. El reporte y una alerta se envían por correo.",
  },
};

const ICONO: Record<EstadoUnidad, string> = {
  apto: "bg-apto-fondo text-apto",
  requiere_correccion: "bg-correccion-fondo text-correccion",
  no_apto: "bg-noapto-fondo text-noapto",
};

// Pantalla 5 · Inspección enviada (los datos se leen de la base, no de la URL)
export default async function EnviadaPage({ params }: PageProps<"/inspeccion/enviada/[folio]">) {
  const { folio } = await params;
  const { data: i } = await db()
    .from("inspecciones")
    .select("folio, tipo, resultado, finalizada_at, camiones!inspecciones_camion_id_fkey(numero_unidad), rutas!inspecciones_ruta_id_fkey(codigo)")
    .eq("folio", decodeURIComponent(folio))
    .not("finalizada_at", "is", null)
    .maybeSingle();
  if (!i || !i.resultado || !i.finalizada_at) notFound();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <FranjaMarca />
      <div className="flex flex-col items-center gap-4 px-6 pt-12 text-center">
        <div className={`flex size-[72px] items-center justify-center rounded-full ${ICONO[i.resultado]}`}>
          <svg viewBox="0 0 24 24" className="size-9" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12l5 5 9-10" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold">{i.tipo === "salida" ? "Inspección enviada" : "Viaje cerrado"}</h1>
        <EstadoBadge estado={i.resultado} className="text-sm" />
        <p className="max-w-80 text-[15px] leading-relaxed text-tinta-suave">{MENSAJES[i.tipo][i.resultado]}</p>
      </div>
      <div className="px-5 pt-7">
        <div className="rounded-xl border border-linea px-3.5 py-1 text-[13px]">
          <div className="flex justify-between border-b border-[#EEF2F7] py-3">
            <span className="text-tinta-suave">Folio</span>
            <span className="font-mono">{i.folio}</span>
          </div>
          <div className="flex justify-between border-b border-[#EEF2F7] py-3">
            <span className="text-tinta-suave">Unidad</span>
            <span className="font-semibold">{i.camiones.numero_unidad} · {i.rutas.codigo}</span>
          </div>
          <div className="flex justify-between py-3">
            <span className="text-tinta-suave">Enviado</span>
            <span className="font-semibold">{formatoFechaCorta(new Date(i.finalizada_at))} · {formatoHora(i.finalizada_at)}</span>
          </div>
        </div>
      </div>
      <div className="flex-1" />
      <div className="flex flex-col gap-2.5 px-5 pb-7 pt-6">
        <Link href="/" className="flex h-[52px] items-center justify-center rounded-xl bg-marca text-base font-semibold text-white hover:bg-marca-oscuro">
          Volver al inicio
        </Link>
        <Link href={`/inspeccion/${i.tipo}`} className="flex h-[52px] items-center justify-center rounded-xl border border-linea-fuerte text-base font-semibold text-marca">
          Nueva inspección de {i.tipo}
        </Link>
      </div>
    </main>
  );
}
