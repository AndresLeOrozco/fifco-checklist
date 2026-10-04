import Link from "next/link";
import { FranjaMarca, Logo } from "@/components/marca";
import { exigirSesionReportes } from "@/lib/reportes/guardia";
import { salirReportes } from "../acciones";

// Estructura de escritorio de reportes: menú lateral + contenido.
// En el celular el menú se apila arriba (flex-wrap).
export default async function ReportesLayout({ children }: LayoutProps<"/reportes">) {
  await exigirSesionReportes();

  const enlaces = [
    { href: "/reportes", texto: "Panel", listo: true },
    { href: "/reportes/listado", texto: "Reportes", listo: false },
    { href: "/reportes/catalogos", texto: "Catálogos", listo: false },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <FranjaMarca />
      <div className="flex flex-1 flex-wrap">
        <aside className="flex flex-[1_1_240px] flex-col gap-6 border-r border-linea px-4 py-5">
          <div className="flex items-center gap-2.5 px-2">
            <Logo />
            <div className="flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold">Checklist de flota</span>
              <span className="text-xs text-tinta-suave">FIFCO · CEDI</span>
            </div>
          </div>
          <nav className="flex flex-col gap-1" aria-label="Secciones de reportes">
            {enlaces.map((e) =>
              e.listo ? (
                <Link key={e.href} href={e.href} className="rounded-lg bg-marca-suave px-3 py-2.5 text-sm font-semibold text-marca">
                  {e.texto}
                </Link>
              ) : (
                <span key={e.href} className="flex items-center justify-between px-3 py-2.5 text-sm text-tinta-suave" title="Próximo paso">
                  {e.texto}
                  <span className="text-[11px]">Pronto</span>
                </span>
              ),
            )}
          </nav>
          <div className="flex-1" />
          <form action={salirReportes}>
            <button type="submit" className="px-3 py-2.5 text-[13px] text-tinta-suave hover:text-tinta">
              Salir de reportes
            </button>
          </form>
        </aside>
        <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-6 px-8 pb-12 pt-7">{children}</main>
      </div>
    </div>
  );
}
