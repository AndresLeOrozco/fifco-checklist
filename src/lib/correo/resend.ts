import "server-only";

// Envío de correo con la API HTTP de Resend (https://resend.com/docs/api-reference/emails/send-email).
// Se usa fetch directo: no requiere dependencias y funciona en cualquier hosting.

export type Correo = { para: string[]; asunto: string; html: string; texto: string };
export type ResultadoCorreo = { ok: true; id: string } | { ok: false; error: string };

export function correoConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.CORREO_REMITENTE?.trim());
}

export async function enviarCorreo(c: Correo): Promise<ResultadoCorreo> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const remitente = process.env.CORREO_REMITENTE?.trim();
  if (!apiKey || !remitente) {
    return { ok: false, error: "Correo no configurado: faltan RESEND_API_KEY o CORREO_REMITENTE." };
  }
  if (c.para.length === 0) return { ok: false, error: "No hay destinatarios activos para este tipo de correo." };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: remitente, to: c.para, subject: c.asunto, html: c.html, text: c.texto }),
      signal: AbortSignal.timeout(15_000),
    });
    const cuerpo = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (!res.ok || !cuerpo.id) {
      return { ok: false, error: `Resend respondió ${res.status}: ${cuerpo.message ?? cuerpo.name ?? "error desconocido"}` };
    }
    return { ok: true, id: cuerpo.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo contactar a Resend." };
  }
}
