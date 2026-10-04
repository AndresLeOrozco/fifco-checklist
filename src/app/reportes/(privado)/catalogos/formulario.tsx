"use client";

import { useActionState } from "react";
import type { EstadoForm } from "./acciones";

export type CampoDef =
  | { tipo: "texto" | "email" | "numero"; nombre: string; etiqueta: string; requerido?: boolean; valor?: string | number | null; mono?: boolean }
  | { tipo: "select"; nombre: string; etiqueta: string; opciones: { valor: string; texto: string }[]; valor?: string }
  | { tipo: "casilla"; nombre: string; etiqueta: string; valor?: boolean };

const campo = "h-[42px] w-full min-w-0 rounded-lg border border-linea-fuerte bg-white px-2.5 text-sm text-tinta outline-none focus:border-marca";

// Formulario reutilizable para agregar o editar un registro de catálogo.
export function FormularioCatalogo({
  accion,
  campos,
  id,
  textoBoton,
}: {
  accion: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  campos: CampoDef[];
  id?: string;
  textoBoton: string;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, {});
  return (
    // La key con el contador de guardados limpia el formulario de alta después de agregar.
    <form key={id ? undefined : estado.n} action={enviar} className="flex flex-col gap-3">
      {id && <input type="hidden" name="id" value={id} />}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] items-end gap-3">
        {campos.map((c) =>
          c.tipo === "casilla" ? (
            <label key={c.nombre} className="flex h-[42px] items-center gap-2 text-sm">
              <input type="checkbox" name={c.nombre} defaultChecked={c.valor ?? true} className="size-4 accent-marca" />
              {c.etiqueta}
            </label>
          ) : c.tipo === "select" ? (
            <label key={c.nombre} className="flex flex-col gap-1.5 text-xs font-medium text-tinta-suave">
              {c.etiqueta}
              <select name={c.nombre} defaultValue={c.valor ?? c.opciones[0]?.valor} className={campo}>
                {c.opciones.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
              </select>
            </label>
          ) : (
            <label key={c.nombre} className="flex flex-col gap-1.5 text-xs font-medium text-tinta-suave">
              {c.etiqueta}
              <input
                name={c.nombre}
                type={c.tipo === "email" ? "email" : "text"}
                inputMode={c.tipo === "numero" ? "numeric" : undefined}
                required={c.requerido}
                defaultValue={c.valor ?? ""}
                className={`${campo} ${c.mono ? "font-mono" : ""}`}
              />
            </label>
          ),
        )}
        <button type="submit" disabled={pendiente} className="h-[42px] rounded-lg bg-marca px-4 text-sm font-semibold text-white hover:bg-marca-oscuro disabled:opacity-60">
          {pendiente ? "Guardando…" : textoBoton}
        </button>
      </div>
      {estado.error && <p role="alert" className="text-[13px] text-noapto">{estado.error}</p>}
      {estado.ok && <p role="status" className="text-[13px] font-medium text-apto">{estado.ok}</p>}
    </form>
  );
}
