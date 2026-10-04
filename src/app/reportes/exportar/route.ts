import { cookies } from "next/headers";
import { todasLasInspecciones } from "@/lib/data/reportes";
import { leerFiltros } from "@/lib/reportes/filtros";
import { COOKIE_REPORTES, tokenSesionValido } from "@/lib/reportes/sesion";
import { ETIQUETA_ESTADO, ZONA_HORARIA } from "@/lib/formato";

// Exporta el listado filtrado como CSV que Excel abre directamente
// (UTF-8 con BOM y punto y coma, el separador que usa Excel en español).
export async function GET(request: Request) {
  if (!(await tokenSesionValido((await cookies()).get(COOKIE_REPORTES)?.value))) {
    return new Response("No autorizado", { status: 401 });
  }

  const filtros = leerFiltros(new URL(request.url).searchParams);
  const filas = await todasLasInspecciones(filtros);

  const fecha = new Intl.DateTimeFormat("es-CR", { timeZone: ZONA_HORARIA, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
  const celda = (v: string | number | null | undefined) => {
    const s = String(v ?? "");
    // Evita que Excel interprete el texto como fórmula
    const seguro = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[;"\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
  };

  const encabezado = ["Folio", "Viaje", "Fecha", "Tipo", "Unidad", "Placa", "Tipo de unidad", "Conductor", "Ruta", "Supervisor", "Kilometraje", "Km recorridos", "Estado", "Hallazgos"];
  const lineas = filas.map((r) =>
    [
      r.folio,
      r.viaje_folio,
      fecha.format(new Date(r.iniciada_at)).replace(",", ""),
      r.tipo === "salida" ? "Salida" : "Retorno",
      r.numero_unidad,
      r.placa,
      r.tipo_unidad === "refrigerado" ? "Refrigerado" : "Seco",
      r.conductor,
      `${r.ruta_codigo} ${r.ruta}`,
      r.supervisor,
      r.kilometraje,
      r.km_recorridos,
      r.resultado ? ETIQUETA_ESTADO[r.resultado] : "",
      r.hallazgos,
    ]
      .map(celda)
      .join(";"),
  );

  const csv = "﻿" + [encabezado.join(";"), ...lineas].join("\r\n");
  const hoy = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inspecciones-${hoy}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
