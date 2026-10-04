import type { EstadoUnidad } from "@/lib/supabase/database.types";
import { ETIQUETA_ESTADO } from "@/lib/formato";

const ESTILOS: Record<EstadoUnidad, string> = {
  apto: "bg-apto-fondo text-apto",
  requiere_correccion: "bg-correccion-fondo text-correccion",
  no_apto: "bg-noapto-fondo text-noapto",
};

export function EstadoBadge({ estado, className = "" }: { estado: EstadoUnidad | null; className?: string }) {
  if (!estado) {
    return (
      <span className={`inline-block rounded-full bg-marca-suave px-2.5 py-0.5 text-xs font-semibold text-marca-oscuro ${className}`}>
        En progreso
      </span>
    );
  }
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTILOS[estado]} ${className}`}>
      {ETIQUETA_ESTADO[estado]}
    </span>
  );
}
