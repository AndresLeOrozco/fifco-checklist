import "server-only";
import { db } from "@/lib/supabase/server";
import { detalleViaje } from "@/lib/data/detalle-viaje";
import { correoAlertaNoApto, correoReporteViaje } from "./plantillas";
import { enviarCorreo, type Correo } from "./resend";

type TipoNotificacion = "reporte_viaje" | "alerta_no_apto";

// Registra el envío en la bitácora, lo intenta y guarda el resultado.
// Nunca lanza excepciones: un correo fallido no debe romper la inspección.
async function enviarYRegistrar(
  tipo: TipoNotificacion,
  ids: { viajeId: string; inspeccionId: string | null },
  armar: (para: string[]) => Correo,
) {
  const cliente = db();
  const campo = tipo === "reporte_viaje" ? "recibe_reportes" : "recibe_alertas";
  const { data: dest } = await cliente.from("destinatarios_correo").select("email").eq("activo", true).eq(campo, true);
  const para = (dest ?? []).map((d) => d.email);

  const { data: reg } = await cliente
    .from("notificaciones_correo")
    .insert({ tipo, viaje_id: ids.viajeId, inspeccion_id: ids.inspeccionId, destinatarios: para })
    .select("id")
    .single();

  const res = await enviarCorreo(armar(para));
  if (reg) {
    await cliente
      .from("notificaciones_correo")
      .update(
        res.ok
          ? { estado: "enviado", proveedor_id: res.id, enviado_at: new Date().toISOString(), error: null }
          : { estado: "error", error: res.error },
      )
      .eq("id", reg.id);
  }
  if (!res.ok) console.error(`[correo] ${tipo} no enviado: ${res.error}`);
  return res;
}

export async function enviarReporteViaje(viajeId: string, urlBase: string) {
  const v = await detalleViaje(viajeId);
  if (!v) return { ok: false as const, error: "Viaje no encontrado." };
  const url = `${urlBase}/reportes/viajes/${v.id}`;
  return enviarYRegistrar("reporte_viaje", { viajeId: v.id, inspeccionId: v.retorno?.id ?? null }, (para) => ({
    para,
    ...correoReporteViaje(v, url),
  }));
}

export async function enviarAlertaNoApto(inspeccionId: string, urlBase: string) {
  const { data: ins } = await db().from("inspecciones").select("viaje_id").eq("id", inspeccionId).single();
  if (!ins) return { ok: false as const, error: "Inspección no encontrada." };
  const v = await detalleViaje(ins.viaje_id);
  const i = v && [v.salida, v.retorno].find((x) => x?.id === inspeccionId);
  if (!v || !i) return { ok: false as const, error: "Inspección no encontrada." };
  const url = `${urlBase}/reportes/viajes/${v.id}`;
  return enviarYRegistrar("alerta_no_apto", { viajeId: v.id, inspeccionId }, (para) => ({
    para,
    ...correoAlertaNoApto(v, i, url),
  }));
}

// Reglas de envío al finalizar una inspección:
//  · Resultado No apto (salida o retorno) → alerta inmediata.
//  · Retorno (cierre del viaje)           → reporte del viaje completo.
export async function notificarResultadoInspeccion(inspeccionId: string, urlBase: string) {
  try {
    const { data: ins } = await db().from("inspecciones").select("tipo, resultado, viaje_id").eq("id", inspeccionId).single();
    if (!ins) return;
    if (ins.resultado === "no_apto") await enviarAlertaNoApto(inspeccionId, urlBase);
    if (ins.tipo === "retorno") await enviarReporteViaje(ins.viaje_id, urlBase);
  } catch (e) {
    console.error("[correo] error al notificar:", e);
  }
}
