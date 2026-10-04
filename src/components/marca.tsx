// Franja superior de marca (azul + celeste), presente en todas las pantallas.
export function FranjaMarca() {
  return (
    <div aria-hidden="true">
      <div className="h-1.5 bg-marca" />
      <div className="h-0.5 bg-celeste" />
    </div>
  );
}

// Espacio reservado para el logo oficial de FIFCO.
// Reemplazar por <Image src="/logo-fifco.svg" ... /> cuando esté el archivo.
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-lg border border-dashed border-acero text-[10px] text-acero-oscuro"
    >
      Logo
    </div>
  );
}
