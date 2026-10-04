import type { Metadata } from "next";
import Link from "next/link";
import { FranjaMarca, Logo } from "@/components/marca";
import { FormularioAcceso } from "./formulario";

export const metadata: Metadata = { title: "Acceso a reportes" };

// Pantalla 8 · Acceso a reportes
export default async function AccesoPage({ searchParams }: PageProps<"/reportes/acceso">) {
  const { volver } = await searchParams;

  return (
    <main className="flex flex-1 flex-col">
      <FranjaMarca />
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="flex w-full max-w-[420px] flex-col gap-6 rounded-2xl border border-linea px-8 py-9">
          <div className="flex items-center gap-3">
            <Logo size={44} />
            <div className="flex flex-col gap-0.5">
              <span className="text-base font-semibold">Checklist de flota</span>
              <span className="text-[13px] text-tinta-suave">FIFCO · CEDI</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-semibold">Reportes de inspección</h1>
            <p className="text-sm leading-relaxed text-tinta-suave">
              Ingrese la contraseña de acceso para consultar inspecciones, viajes y unidades.
            </p>
          </div>
          <FormularioAcceso volver={typeof volver === "string" ? volver : undefined} />
          <div className="flex items-center justify-between border-t border-linea pt-4 text-xs text-tinta-suave">
            <span>Acceso para supervisores y administración.</span>
            <Link href="/" className="font-medium text-marca">Volver</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
