import type { Metadata, Viewport } from "next";
// Fuentes alojadas en el propio proyecto (no dependen de Google Fonts al compilar).
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Checklist de flota · FIFCO",
    template: "%s · Checklist de flota",
  },
  description: "Inspección de salida y retorno de camiones de reparto.",
  applicationName: "Checklist de flota",
};

export const viewport: Viewport = {
  themeColor: "#026DB5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
