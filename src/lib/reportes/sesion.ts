import "server-only";
import { env } from "@/lib/env";

// Sesión de la sección de reportes (fase 1, sin cuentas de usuario).
// La cookie guarda "<vencimiento>.<firma HMAC-SHA256>". Sin la clave del
// servidor no se puede fabricar una cookie válida.
// Usa Web Crypto para funcionar igual en Node, Cloudflare o Netlify.

export const COOKIE_REPORTES = "reportes_sesion";
export const DURACION_SESION_SEG = 60 * 60 * 12; // 12 horas

const encoder = new TextEncoder();

async function clave(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(env().REPORTES_SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function aHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function deHex(hex: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[0-9a-f]+$/.test(hex) || hex.length % 2 !== 0) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function crearTokenSesion(): Promise<string> {
  const vence = Math.floor(Date.now() / 1000) + DURACION_SESION_SEG;
  const firma = await crypto.subtle.sign("HMAC", await clave(), encoder.encode(String(vence)));
  return `${vence}.${aHex(firma)}`;
}

export async function tokenSesionValido(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [venceTxt, firmaHex] = token.split(".");
  const vence = Number(venceTxt);
  if (!Number.isInteger(vence) || vence < Math.floor(Date.now() / 1000)) return false;
  const firma = firmaHex ? deHex(firmaHex) : null;
  if (!firma) return false;
  // verify() compara en tiempo constante
  return crypto.subtle.verify("HMAC", await clave(), firma, encoder.encode(venceTxt));
}

// Compara la contraseña en tiempo constante (comparando HMAC de ambos lados).
export async function contrasenaCorrecta(intento: string): Promise<boolean> {
  const k = await clave();
  const [a, b] = await Promise.all([
    crypto.subtle.sign("HMAC", k, encoder.encode(intento)),
    crypto.subtle.sign("HMAC", k, encoder.encode(env().REPORTES_PASSWORD)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
