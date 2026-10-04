"use server";

import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/supabase/server";
import {
  MAX_BYTES_IMAGEN,
  RE_RUTA_HALLAZGO,
  TIPOS_IMAGEN,
  borrarArchivos,
  nuevaRuta,
  subirArchivo,
} from "@/lib/supabase/storage";
import { notificarResultadoInspeccion } from "@/lib/correo/notificaciones";
import { urlBaseApp } from "@/lib/url";
import type { EstadoUnidad } from "@/lib/supabase/database.types";

// ---------------------------------------------------------------------------
// Subir una foto de hallazgo (se llama apenas el conductor toma la foto)
// ---------------------------------------------------------------------------
export type ResultadoSubida = { ok: true; ruta: string } | { ok: false; error: string };

export async function subirFotoHallazgo(formData: FormData): Promise<ResultadoSubida> {
  const archivo = formData.get("foto");
  if (!(archivo instanceof File)) return { ok: false, error: "No se recibió la fotografía." };
  const ext = TIPOS_IMAGEN[archivo.type];
  if (!ext) return { ok: false, error: "Formato de imagen no permitido." };
  if (archivo.size > MAX_BYTES_IMAGEN) return { ok: false, error: "La fotografía pesa más de 2 MB." };

  const ruta = nuevaRuta("hallazgos", ext);
  try {
    await subirArchivo(ruta, archivo, archivo.type);
    return { ok: true, ruta };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo subir la fotografía." };
  }
}

// ---------------------------------------------------------------------------
// Enviar la inspección completa
// ---------------------------------------------------------------------------
const uuid = z.uuid("Dato inválido");
const km = z.coerce.number({ error: "Ingrese el kilometraje" }).int("El kilometraje debe ser un número entero").min(0).max(9_999_999);

const respuesta = z
  .object({
    itemId: uuid,
    resultado: z.enum(["ok", "falla", "na"]),
    comentario: z.string().trim().max(1000).optional().default(""),
    fotos: z.array(z.string().regex(RE_RUTA_HALLAZGO, "Fotografía inválida")).max(4).default([]),
  })
  .refine((r) => r.resultado !== "falla" || r.comentario.length > 0, "Cada falla necesita una descripción.")
  .refine((r) => r.resultado !== "falla" || r.fotos.length > 0, "Cada falla necesita al menos una fotografía.");

const base = {
  iniciadaAt: z.iso.datetime(),
  observaciones: z.string().trim().max(2000).optional().default(""),
  respuestas: z.array(respuesta).min(1).max(50),
};

const esquema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("salida"), camionId: uuid, conductorId: uuid, rutaId: uuid, kilometraje: km, ...base }),
  z.object({
    tipo: z.literal("retorno"),
    viajeId: uuid,
    kilometraje: km,
    combustible: z.string().trim().min(1, "Indique el nivel de combustible").max(40),
    supervisorId: uuid,
    ...base,
  }),
]);

export type ResultadoEnvio =
  | { ok: true; folio: string; resultado: EstadoUnidad }
  | { ok: false; error: string };

function mensajeDb(error: { message: string; code?: string } | null, porDefecto: string): string {
  if (!error) return porDefecto;
  // Los triggers devuelven mensajes en español pensados para el usuario (código P0001).
  if (error.code === "P0001") return error.message;
  if (error.code === "23505") return "Ya existe un registro igual. Recargue la página e intente de nuevo.";
  return `${porDefecto} (${error.message})`;
}

async function firmaDesde(formData: FormData, campo: string): Promise<File | null> {
  const f = formData.get(campo);
  if (!(f instanceof File) || f.type !== "image/png" || f.size === 0 || f.size > 1024 * 1024) return null;
  return f;
}

export async function enviarInspeccion(formData: FormData): Promise<ResultadoEnvio> {
  // 1. Validación
  let datos: z.infer<typeof esquema>;
  try {
    datos = esquema.parse(JSON.parse(String(formData.get("datos") ?? "")));
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : undefined;
    return { ok: false, error: msg ?? "Los datos del formulario no son válidos." };
  }

  const firmaConductor = await firmaDesde(formData, "firmaConductor");
  if (!firmaConductor) return { ok: false, error: "Falta la firma del conductor." };
  const firmaSupervisor = datos.tipo === "retorno" ? await firmaDesde(formData, "firmaSupervisor") : null;
  if (datos.tipo === "retorno" && !firmaSupervisor) return { ok: false, error: "Falta la firma del supervisor." };

  const cliente = db();
  let viajeCreadoId: string | null = null;
  let inspeccionId: string | null = null;
  const firmasSubidas: string[] = [];

  // Si algo falla a mitad de camino, se deshace lo creado para no dejar registros a medias.
  async function deshacer() {
    if (inspeccionId) await cliente.from("inspecciones").delete().eq("id", inspeccionId);
    if (viajeCreadoId) await cliente.from("viajes").delete().eq("id", viajeCreadoId);
    await borrarArchivos(firmasSubidas);
  }

  try {
    // 2. Viaje
    let viajeId: string;
    let conductorId: string;
    if (datos.tipo === "salida") {
      const abierto = await cliente.from("viajes").select("folio").eq("camion_id", datos.camionId).eq("estado", "en_ruta").maybeSingle();
      if (abierto.data) {
        return { ok: false, error: "Esta unidad ya tiene un viaje abierto. Registre primero su inspección de retorno." };
      }
      const v = await cliente
        .from("viajes")
        .insert({ camion_id: datos.camionId, conductor_id: datos.conductorId, ruta_id: datos.rutaId, km_inicial: datos.kilometraje })
        .select("id")
        .single();
      if (v.error) return { ok: false, error: mensajeDb(v.error, "No se pudo registrar la salida") };
      viajeId = v.data.id;
      viajeCreadoId = viajeId;
      conductorId = datos.conductorId;
    } else {
      const v = await cliente.from("viajes").select("id, estado, km_inicial, conductor_id").eq("id", datos.viajeId).single();
      if (v.error || !v.data) return { ok: false, error: "No se encontró el viaje seleccionado." };
      if (v.data.estado !== "en_ruta") return { ok: false, error: "Ese viaje ya fue cerrado." };
      if (datos.kilometraje < v.data.km_inicial) {
        return { ok: false, error: `El kilometraje final no puede ser menor al inicial (${v.data.km_inicial} km).` };
      }
      viajeId = v.data.id;
      conductorId = v.data.conductor_id;
    }

    // 3. Inspección
    const ins = await cliente
      .from("inspecciones")
      .insert({
        viaje_id: viajeId,
        tipo: datos.tipo,
        kilometraje: datos.kilometraje,
        iniciada_at: datos.iniciadaAt,
        observaciones: datos.observaciones || null,
        combustible: datos.tipo === "retorno" ? datos.combustible : null,
        supervisor_id: datos.tipo === "retorno" ? datos.supervisorId : null,
      })
      .select("id, folio")
      .single();
    if (ins.error) {
      await deshacer();
      return { ok: false, error: mensajeDb(ins.error, "No se pudo registrar la inspección") };
    }
    inspeccionId = ins.data.id;

    // 4. Respuestas
    const resp = await cliente
      .from("respuestas_inspeccion")
      .insert(
        datos.respuestas.map((r) => ({
          inspeccion_id: ins.data.id,
          checklist_item_id: r.itemId,
          resultado: r.resultado,
          comentario: r.comentario || null,
        })),
      )
      .select("id, checklist_item_id");
    if (resp.error) {
      await deshacer();
      return { ok: false, error: mensajeDb(resp.error, "No se pudieron guardar las respuestas") };
    }

    // 5. Fotos de hallazgos (ya subidas; aquí solo se enlazan)
    const idPorItem = new Map(resp.data.map((r) => [r.checklist_item_id, r.id]));
    const fotos = datos.respuestas.flatMap((r) =>
      r.resultado === "falla" ? r.fotos.map((ruta) => ({ respuesta_id: idPorItem.get(r.itemId)!, storage_path: ruta })) : [],
    );
    if (fotos.length > 0) {
      const f = await cliente.from("fotos_hallazgo").insert(fotos);
      if (f.error) {
        await deshacer();
        return { ok: false, error: mensajeDb(f.error, "No se pudieron enlazar las fotografías") };
      }
    }

    // 6. Firmas
    const firmas: { tipo: "conductor" | "supervisor"; personalId: string; archivo: File }[] = [
      { tipo: "conductor", personalId: conductorId, archivo: firmaConductor },
    ];
    if (datos.tipo === "retorno" && firmaSupervisor) {
      firmas.push({ tipo: "supervisor", personalId: datos.supervisorId, archivo: firmaSupervisor });
    }
    for (const firma of firmas) {
      const ruta = nuevaRuta("firmas", "png");
      await subirArchivo(ruta, firma.archivo, "image/png");
      firmasSubidas.push(ruta);
      const fi = await cliente
        .from("firmas")
        .insert({ inspeccion_id: ins.data.id, tipo: firma.tipo, personal_id: firma.personalId, storage_path: ruta });
      if (fi.error) {
        await deshacer();
        return { ok: false, error: mensajeDb(fi.error, "No se pudo guardar la firma") };
      }
    }

    // 7. Finalizar: valida, calcula el resultado y actualiza unidad y viaje (todo en la base)
    const fin = await cliente.rpc("finalizar_inspeccion", { p_inspeccion_id: ins.data.id });
    if (fin.error) {
      await deshacer();
      return { ok: false, error: mensajeDb(fin.error, "No se pudo finalizar la inspección") };
    }

    // 8. Correos, después de responder al conductor (no lo hace esperar)
    const base = await urlBaseApp();
    const idFinal = ins.data.id;
    after(() => notificarResultadoInspeccion(idFinal, base));

    return { ok: true, folio: ins.data.folio, resultado: fin.data };
  } catch (e) {
    await deshacer();
    return { ok: false, error: e instanceof Error ? e.message : "Ocurrió un error inesperado." };
  }
}
