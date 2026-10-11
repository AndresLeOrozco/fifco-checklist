import type { MetadataRoute } from "next";

// Permite instalar la app en el celular del conductor como si fuera nativa.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Checklist de flota · Heineken Distribución Retail",
    short_name: "Checklist",
    description: "Inspección de salida y retorno de camiones de reparto.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#028132",
    lang: "es",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
