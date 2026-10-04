import type { MetadataRoute } from "next";

// Permite instalar la app en el celular del conductor como si fuera nativa.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Checklist de flota FIFCO",
    short_name: "Checklist",
    description: "Inspección de salida y retorno de camiones de reparto.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#026DB5",
    lang: "es",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
