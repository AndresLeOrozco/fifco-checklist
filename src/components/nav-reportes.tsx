"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ENLACES = [
  { href: "/reportes", texto: "Panel", activo: (p: string) => p === "/reportes" },
  { href: "/reportes/listado", texto: "Reportes", activo: (p: string) => p.startsWith("/reportes/listado") || p.startsWith("/reportes/viajes") },
  { href: "/reportes/catalogos", texto: "Catálogos", activo: (p: string) => p.startsWith("/reportes/catalogos") },
];

export function NavReportes() {
  const ruta = usePathname();
  return (
    <nav className="flex flex-col gap-1" aria-label="Secciones de reportes">
      {ENLACES.map((e) => {
        const activo = e.activo(ruta);
        return (
          <Link
            key={e.href}
            href={e.href}
            aria-current={activo ? "page" : undefined}
            className={`rounded-lg px-3 py-2.5 text-sm ${activo ? "bg-marca-suave font-semibold text-marca" : "font-medium text-tinta hover:bg-fondo-suave"}`}
          >
            {e.texto}
          </Link>
        );
      })}
    </nav>
  );
}
