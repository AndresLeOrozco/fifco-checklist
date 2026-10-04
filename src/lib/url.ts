import "server-only";
import { headers } from "next/headers";

// URL pública de la app, para los enlaces de los correos.
// Usa APP_URL si está definida; si no, la deduce de la petición actual.
export async function urlBaseApp(): Promise<string> {
  const configurada = process.env.APP_URL?.trim();
  if (configurada) return configurada.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
