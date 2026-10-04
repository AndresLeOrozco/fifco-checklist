"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/supabase/server";
import { exigirSesionReportes } from "@/lib/reportes/guardia";
import { enviarReporteViaje } from "@/lib/correo/notificaciones";
import { urlBaseApp } from "@/lib/url";

export type EstadoAccion = { ok?: string; error?: string };

const esquemaLiberacion = z.object({
  viajeId: z.uuid(),
  camionId: z.uuid(),
  inspeccionId: z.uuid().optional().or(z.literal("").transform(() => undefined)),
  decision: z.enum(["autorizada_hallazgo_menor", "corregida_liberada"], { error: "Seleccione la decisión." }),
  responsable: z.string().trim().min(3, "Indique el nombre del responsable.").max(120),
  accion: z.string().trim().min(5, "Describa la acción tomada.").max(1000),
});

export async function registrarLiberacion(_prev: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await exigirSesionReportes();
  const p = esquemaLiberacion.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Datos inválidos." };

  const { error } = await db().from("liberaciones").insert({
    camion_id: p.data.camionId,
    inspeccion_id: p.data.inspeccionId ?? null,
    decision: p.data.decision,
    responsable_nombre: p.data.responsable,
    accion_tomada: p.data.accion,
    estado_anterior: "requiere_correccion", // lo reemplaza un trigger con el estado real
  });
  if (error) return { error: error.code === "P0001" ? error.message : `No se pudo registrar: ${error.message}` };

  revalidatePath(`/reportes/viajes/${p.data.viajeId}`);
  revalidatePath("/reportes");
  return { ok: "Unidad liberada. Ya puede iniciar un nuevo viaje." };
}

export async function reenviarReporte(_prev: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await exigirSesionReportes();
  const viajeId = z.uuid().safeParse(fd.get("viajeId"));
  if (!viajeId.success) return { error: "Viaje inválido." };
  const res = await enviarReporteViaje(viajeId.data, await urlBaseApp());
  revalidatePath(`/reportes/viajes/${viajeId.data}`);
  return res.ok ? { ok: "Correo enviado." } : { error: res.error };
}
