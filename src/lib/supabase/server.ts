import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "./database.types";

// Cliente de Supabase con la secret key. SOLO se usa en el servidor
// (Server Components, Server Actions y Route Handlers). El import de
// "server-only" hace fallar el build si alguien lo importa desde el navegador.
//
// Fase 1 no tiene usuarios: no hay sesión que persistir ni refrescar.

let client: SupabaseClient<Database> | undefined;

export function db(): SupabaseClient<Database> {
  if (client) return client;
  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = env();
  client = createClient<Database>(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}

export const BUCKET_INSPECCIONES = "inspecciones";
