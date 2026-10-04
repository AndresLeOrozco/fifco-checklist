"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/supabase/server";
import { exigirSesionReportes } from "@/lib/reportes/guardia";

export type EstadoForm = { ok?: string; error?: string; n?: number };

const texto = (min: number, max: number, msg: string) => z.string().trim().min(min, msg).max(max);
const idOpcional = z.uuid().optional().or(z.literal("").transform(() => undefined));
const casilla = z.preprocess((v) => v === "on" || v === "true", z.boolean());

function respuesta(error: { code?: string; message: string } | null, okMsg: string, prev: EstadoForm): EstadoForm {
  if (!error) {
    revalidatePath("/reportes/catalogos");
    return { ok: okMsg, n: (prev.n ?? 0) + 1 };
  }
  if (error.code === "23505") return { error: "Ya existe un registro con ese dato (placa, número, código o correo repetido)." };
  return { error: `No se pudo guardar: ${error.message}` };
}

function primerError(e: z.ZodError) {
  return { error: e.issues[0]?.message ?? "Datos inválidos." };
}

// ----------------------------- Camiones -----------------------------
const camion = z.object({
  id: idOpcional,
  numero_unidad: texto(1, 20, "Indique el número de unidad."),
  placa: texto(3, 20, "Indique la placa.").transform((s) => s.toUpperCase()),
  tipo: z.enum(["refrigerado", "seco"]),
  ultimo_km: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().int().min(0).optional()),
});

export async function guardarCamion(prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  await exigirSesionReportes();
  const p = camion.safeParse(Object.fromEntries(fd));
  if (!p.success) return primerError(p.error);
  const { id, ultimo_km, ...datos } = p.data;
  const { error } = id
    ? await db().from("camiones").update(datos).eq("id", id)
    : await db().from("camiones").insert({ ...datos, ultimo_km: ultimo_km ?? null });
  return respuesta(error, id ? "Camión actualizado." : "Camión agregado.", prev);
}

// ----------------------------- Personal -----------------------------
const persona = z.object({
  id: idOpcional,
  codigo_empleado: texto(1, 20, "Indique el código de empleado."),
  nombre: texto(3, 120, "Indique el nombre completo."),
  rol: z.enum(["conductor", "supervisor"]),
  email: z.union([z.literal("").transform(() => null), z.email("Correo inválido.")]).optional().default(null),
});

export async function guardarPersona(prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  await exigirSesionReportes();
  const p = persona.safeParse(Object.fromEntries(fd));
  if (!p.success) return primerError(p.error);
  const { id, ...datos } = p.data;
  const { error } = id ? await db().from("personal").update(datos).eq("id", id) : await db().from("personal").insert(datos);
  return respuesta(error, id ? "Datos actualizados." : "Persona agregada.", prev);
}

// ------------------------------ Rutas -------------------------------
const ruta = z.object({
  id: idOpcional,
  codigo: texto(1, 20, "Indique el código de ruta.").transform((s) => s.toUpperCase()),
  descripcion: texto(2, 160, "Indique la descripción."),
  zona: z.string().trim().max(80).optional().transform((s) => s || null),
});

export async function guardarRuta(prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  await exigirSesionReportes();
  const p = ruta.safeParse(Object.fromEntries(fd));
  if (!p.success) return primerError(p.error);
  const { id, ...datos } = p.data;
  const { error } = id ? await db().from("rutas").update(datos).eq("id", id) : await db().from("rutas").insert(datos);
  return respuesta(error, id ? "Ruta actualizada." : "Ruta agregada.", prev);
}

// -------------------------- Destinatarios ---------------------------
const destinatario = z.object({
  id: idOpcional,
  email: z.email("Correo inválido.").transform((s) => s.toLowerCase()),
  nombre: z.string().trim().max(120).optional().transform((s) => s || null),
  recibe_reportes: casilla,
  recibe_alertas: casilla,
});

export async function guardarDestinatario(prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  await exigirSesionReportes();
  const p = destinatario.safeParse({ recibe_reportes: "", recibe_alertas: "", ...Object.fromEntries(fd) });
  if (!p.success) return primerError(p.error);
  const { id, ...datos } = p.data;
  const { error } = id
    ? await db().from("destinatarios_correo").update(datos).eq("id", id)
    : await db().from("destinatarios_correo").insert(datos);
  return respuesta(error, id ? "Destinatario actualizado." : "Destinatario agregado.", prev);
}

// --------------------------- Activar / desactivar ---------------------------
const TABLAS = ["camiones", "personal", "rutas", "destinatarios_correo"] as const;

export async function cambiarActivo(fd: FormData) {
  await exigirSesionReportes();
  const p = z
    .object({ tabla: z.enum(TABLAS), id: z.uuid(), activo: z.enum(["true", "false"]) })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return;
  await db().from(p.data.tabla).update({ activo: p.data.activo === "true" }).eq("id", p.data.id);
  revalidatePath("/reportes/catalogos");
}
