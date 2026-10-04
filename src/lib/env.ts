import "server-only";
import { z } from "zod";

// Variables de entorno del servidor, validadas al primer uso.
// Si falta alguna, el error dice cuál y qué hacer, en vez de fallar más adelante.
const schema = z.object({
  SUPABASE_URL: z.url("SUPABASE_URL debe ser la URL del proyecto de Supabase"),
  SUPABASE_SECRET_KEY: z.string().min(20, "Falta SUPABASE_SECRET_KEY (secret key de Supabase)"),
  REPORTES_PASSWORD: z.string().min(8, "REPORTES_PASSWORD debe tener al menos 8 caracteres"),
  REPORTES_SESSION_SECRET: z.string().min(32, "REPORTES_SESSION_SECRET debe tener al menos 32 caracteres"),
});

export type Env = z.infer<typeof schema>;

let cache: Env | undefined;

export function env(): Env {
  if (cache) return cache;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const detalle = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(
      `Configuración incompleta. Revisa tu archivo .env.local (usa .env.example como guía):\n${detalle}`,
    );
  }
  cache = parsed.data;
  return cache;
}
