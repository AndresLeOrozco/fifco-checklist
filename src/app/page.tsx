import Link from "next/link";
import { connection } from "next/server";
import { FranjaMarca, Logo } from "@/components/marca";
import { IconoCamion, IconoFlecha, IconoRetorno } from "@/components/iconos";
import { unidadesEnRuta } from "@/lib/data/viajes";
import { formatoFechaCorta, formatoHora, saludo } from "@/lib/formato";

// Pantalla 1 · Inicio del conductor
export default async function InicioPage() {
  await connection(); // datos en vivo: se renderiza en cada visita
  const enRuta = await unidadesEnRuta();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <FranjaMarca />
      <header className="flex items-center gap-3 border-b border-linea px-5 py-3.5">
        <Logo />
        <div className="flex flex-1 flex-col">
          <span className="text-base font-semibold">Checklist de flota</span>
          <span className="text-xs text-tinta-suave">FIFCO · CEDI</span>
        </div>
        <span className="text-xs text-tinta-suave">{formatoFechaCorta()}</span>
      </header>

      <div className="flex flex-col gap-1.5 px-5 pb-2 pt-6">
        <span className="text-sm text-tinta-suave">{saludo()}</span>
        <h1 className="text-2xl font-semibold leading-tight">¿Qué inspección vas a registrar?</h1>
      </div>

      <div className="flex flex-col gap-3 px-5 py-4">
        <Link
          href="/inspeccion/salida"
          className="flex items-center gap-4 rounded-2xl bg-marca p-5 text-white transition-colors hover:bg-marca-oscuro"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white text-marca">
            <IconoCamion className="size-6" />
          </span>
          <span className="flex flex-1 flex-col gap-1">
            <span className="text-[17px] font-semibold">Inspección de salida</span>
            <span className="text-sm">Antes de cargar o despachar · 12 puntos</span>
          </span>
          <IconoFlecha className="size-5" />
        </Link>

        <Link
          href="/inspeccion/retorno"
          className="flex items-center gap-4 rounded-2xl border border-linea-fuerte p-5 transition-colors hover:border-acero"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-marca-suave text-marca">
            <IconoRetorno className="size-6" />
          </span>
          <span className="flex flex-1 flex-col gap-1">
            <span className="text-[17px] font-semibold">Inspección de retorno</span>
            <span className="text-sm text-tinta-suave">Al regresar al CEDI · 12 puntos</span>
          </span>
          <IconoFlecha className="size-5 text-marca" />
        </Link>
      </div>

      <section className="flex flex-col">
        <div className="flex items-baseline justify-between px-5 pt-4">
          <h2 className="text-[15px] font-semibold">Unidades en ruta hoy</h2>
          <span className="text-sm text-tinta-suave">
            {enRuta.length} {enRuta.length === 1 ? "unidad" : "unidades"}
          </span>
        </div>
        <ul className="flex flex-col gap-2 px-5 py-3">
          {enRuta.length === 0 && (
            <li className="rounded-xl border border-dashed border-linea-fuerte px-4 py-5 text-center text-sm text-tinta-suave">
              No hay unidades en ruta en este momento.
            </li>
          )}
          {enRuta.map((u) => (
            <li key={u.viajeId} className="flex items-center gap-3 rounded-xl border border-linea px-3.5 py-3">
              <span className="size-2 shrink-0 rounded-full bg-celeste" aria-hidden="true" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold">
                  Unidad {u.numeroUnidad}{" "}
                  <span className="font-mono text-[13px] font-medium text-tinta-suave">{u.placa}</span>
                </span>
                <span className="truncate text-xs text-tinta-suave">{u.ruta}</span>
              </span>
              <span className="whitespace-nowrap text-xs text-tinta-suave">Salió {formatoHora(u.salidaAt)}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex-1" />
      <footer className="flex justify-center border-t border-linea px-5 pb-6 pt-4">
        <Link href="/reportes" className="flex min-h-11 items-center text-sm font-medium text-marca hover:text-marca-oscuro">
          Acceso a reportes (supervisores)
        </Link>
      </footer>
    </main>
  );
}
