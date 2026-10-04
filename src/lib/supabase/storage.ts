import "server-only";
import { BUCKET_INSPECCIONES, db } from "./server";

export const TIPOS_IMAGEN: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};
export const MAX_BYTES_IMAGEN = 2 * 1024 * 1024; // igual al límite del bucket

// Rutas válidas generadas por el servidor (nunca se acepta una ruta arbitraria del navegador).
export const RE_RUTA_HALLAZGO = /^hallazgos\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.(webp|jpg|png)$/;

export function nuevaRuta(carpeta: "hallazgos" | "firmas", ext: string) {
  const ahora = new Date();
  const mes = String(ahora.getUTCMonth() + 1).padStart(2, "0");
  return `${carpeta}/${ahora.getUTCFullYear()}/${mes}/${crypto.randomUUID()}.${ext}`;
}

export async function subirArchivo(ruta: string, archivo: Blob, contentType: string) {
  const { error } = await db().storage.from(BUCKET_INSPECCIONES).upload(ruta, archivo, { contentType, upsert: false });
  if (error) throw new Error(`No se pudo guardar la imagen: ${error.message}`);
}

export async function borrarArchivos(rutas: string[]) {
  if (rutas.length === 0) return;
  await db().storage.from(BUCKET_INSPECCIONES).remove(rutas);
}

// URLs temporales para mostrar imágenes privadas en reportes.
export async function urlsFirmadas(rutas: string[], segundos = 60 * 60): Promise<Record<string, string>> {
  if (rutas.length === 0) return {};
  const { data, error } = await db().storage.from(BUCKET_INSPECCIONES).createSignedUrls(rutas, segundos);
  if (error || !data) return {};
  const mapa: Record<string, string> = {};
  for (const d of data) if (d.path && d.signedUrl) mapa[d.path] = d.signedUrl;
  return mapa;
}
