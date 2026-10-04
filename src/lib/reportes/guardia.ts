import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_REPORTES, tokenSesionValido } from "./sesion";

// Segunda verificación, en el servidor, antes de leer datos de reportes.
// No depende solo de proxy.ts (la documentación de Next recomienda no usar
// el proxy como única barrera de autorización).
export async function exigirSesionReportes(): Promise<void> {
  const token = (await cookies()).get(COOKIE_REPORTES)?.value;
  if (!(await tokenSesionValido(token))) redirect("/reportes/acceso");
}
