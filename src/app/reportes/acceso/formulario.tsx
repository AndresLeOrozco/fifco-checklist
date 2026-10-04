"use client";

import { useActionState } from "react";
import { ingresarReportes, type EstadoAcceso } from "../acciones";

export function FormularioAcceso({ volver }: { volver?: string }) {
  const [estado, accion, enviando] = useActionState<EstadoAcceso, FormData>(ingresarReportes, {});

  return (
    <form action={accion} className="flex flex-col gap-4">
      {volver && <input type="hidden" name="volver" value={volver} />}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="clave" className="text-[13px] font-medium">Contraseña de acceso</label>
        <input
          id="clave"
          name="clave"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={estado.error ? true : undefined}
          aria-describedby={estado.error ? "clave-error" : undefined}
          className="h-12 rounded-[10px] border border-linea-fuerte px-3.5 text-[15px] outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
        />
        {estado.error && (
          <p id="clave-error" role="alert" className="text-[13px] text-noapto">{estado.error}</p>
        )}
      </div>
      <button
        type="submit"
        disabled={enviando}
        className="h-12 rounded-[10px] bg-marca text-[15px] font-semibold text-white transition-colors hover:bg-marca-oscuro disabled:opacity-60"
      >
        {enviando ? "Verificando…" : "Ingresar"}
      </button>
    </form>
  );
}
