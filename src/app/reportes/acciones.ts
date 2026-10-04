"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_REPORTES, DURACION_SESION_SEG, contrasenaCorrecta, crearTokenSesion } from "@/lib/reportes/sesion";

export type EstadoAcceso = { error?: string };

// Solo se permite volver a rutas internas de reportes (evita redirecciones abiertas).
function destinoSeguro(volver: FormDataEntryValue | null): string {
  return typeof volver === "string" && /^\/reportes(\/[\w-]*)*$/.test(volver) ? volver : "/reportes";
}

export async function ingresarReportes(_prev: EstadoAcceso, formData: FormData): Promise<EstadoAcceso> {
  const clave = formData.get("clave");
  if (typeof clave !== "string" || clave.length === 0) return { error: "Ingrese la contraseña." };

  if (!(await contrasenaCorrecta(clave))) {
    await new Promise((r) => setTimeout(r, 600)); // frena intentos repetidos
    return { error: "Contraseña incorrecta." };
  }

  (await cookies()).set(COOKIE_REPORTES, await crearTokenSesion(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_SESION_SEG,
  });

  redirect(destinoSeguro(formData.get("volver")));
}

export async function salirReportes() {
  (await cookies()).delete(COOKIE_REPORTES);
  redirect("/reportes/acceso");
}
