import Image from "next/image";

export const NOMBRE_OPERACION = "Heineken · Distribución Retail";

// Franja superior de marca (verde + azul), presente en todas las pantallas.
export function FranjaMarca() {
  return (
    <div aria-hidden="true">
      <div className="h-1.5 bg-marca" />
      <div className="h-0.5 bg-celeste" />
    </div>
  );
}

// Isotipo de Heineken Costa Rica (hoja). Para encabezados compactos.
// `size` es la altura; el ancho sigue la proporción del archivo (157 × 273).
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <Image
      src="/logo-heineken-hoja.png"
      alt="Heineken Costa Rica"
      width={Math.round((size * 157) / 273)}
      height={size}
      className="shrink-0"
      priority
    />
  );
}

// Logo completo (hoja + estrella + HEINEKEN COSTA RICA), 429 × 403.
export function LogoCompleto({ ancho = 120 }: { ancho?: number }) {
  return (
    <Image
      src="/logo-heineken.png"
      alt="Heineken Costa Rica"
      width={ancho}
      height={Math.round((ancho * 403) / 429)}
      className="shrink-0"
      priority
    />
  );
}
