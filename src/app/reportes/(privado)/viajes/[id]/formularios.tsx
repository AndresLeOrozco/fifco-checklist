"use client";

import { useActionState } from "react";
import { registrarLiberacion, reenviarReporte, type EstadoAccion } from "./acciones";

const campo = "w-full min-w-0 rounded-lg border border-linea-fuerte bg-white px-2.5 text-sm text-tinta outline-none focus:border-marca";

function Mensaje({ estado }: { estado: EstadoAccion }) {
  if (estado.ok) return <p role="status" className="text-[13px] font-medium text-apto">{estado.ok}</p>;
  if (estado.error) return <p role="alert" className="text-[13px] text-noapto">{estado.error}</p>;
  return null;
}

export function FormularioLiberacion({ viajeId, camionId, inspeccionId }: { viajeId: string; camionId: string; inspeccionId?: string }) {
  const [estado, accion, pendiente] = useActionState(registrarLiberacion, {});
  return (
    <form action={accion} className="flex flex-col gap-3.5">
      <input type="hidden" name="viajeId" value={viajeId} />
      <input type="hidden" name="camionId" value={camionId} />
      <input type="hidden" name="inspeccionId" value={inspeccionId ?? ""} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-tinta-suave">
          Responsable
          <input name="responsable" required className={`${campo} h-[42px]`} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-tinta-suave">
          Decisión
          <select name="decision" required defaultValue="" className={`${campo} h-[42px]`}>
            <option value="" disabled>Seleccione</option>
            <option value="autorizada_hallazgo_menor">Autorizada con hallazgo menor</option>
            <option value="corregida_liberada">Corregida y liberada</option>
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-xs font-medium text-tinta-suave">
        Acción tomada
        <textarea name="accion" required rows={3} className={`${campo} resize-none py-2.5`} />
      </label>
      <Mensaje estado={estado} />
      <button type="submit" disabled={pendiente} className="h-11 self-start rounded-[10px] bg-marca px-4 text-sm font-semibold text-white hover:bg-marca-oscuro disabled:opacity-60">
        {pendiente ? "Registrando…" : "Registrar liberación"}
      </button>
    </form>
  );
}

export function BotonReenviar({ viajeId }: { viajeId: string }) {
  const [estado, accion, pendiente] = useActionState(reenviarReporte, {});
  return (
    <form action={accion} className="flex flex-col items-end gap-1">
      <input type="hidden" name="viajeId" value={viajeId} />
      <button type="submit" disabled={pendiente} className="h-11 rounded-[10px] border border-linea-fuerte bg-white px-4 text-sm font-semibold text-tinta hover:border-acero disabled:opacity-60">
        {pendiente ? "Enviando…" : "Reenviar correo"}
      </button>
      <Mensaje estado={estado} />
    </form>
  );
}
