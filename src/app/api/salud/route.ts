import { db } from "@/lib/supabase/server";

// Chequeo de salud. Lo llama a diario el GitHub Action "mantener-activo" para que
// el proyecto gratuito de Supabase no se pause por inactividad (pausa a los 7 días).
// No expone datos: solo responde si la base contesta.
export async function GET() {
  const { error } = await db().from("checklist_items").select("id", { head: true, count: "exact" }).limit(1);
  return Response.json(
    { ok: !error, hora: new Date().toISOString() },
    { status: error ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
