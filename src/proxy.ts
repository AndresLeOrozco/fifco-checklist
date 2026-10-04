import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_REPORTES, tokenSesionValido } from "@/lib/reportes/sesion";

// Protege la sección de reportes con la contraseña compartida (fase 1).
// Es un chequeo rápido de la cookie firmada; las páginas de reportes
// vuelven a verificarla en el servidor antes de leer datos.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/reportes/acceso") return NextResponse.next();

  const valido = await tokenSesionValido(request.cookies.get(COOKIE_REPORTES)?.value);
  if (valido) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/reportes/acceso";
  url.search = pathname === "/reportes" ? "" : `?volver=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/reportes", "/reportes/:path*"],
};
