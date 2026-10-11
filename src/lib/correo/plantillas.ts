import "server-only";
import type { DetalleViaje, InspeccionDetalle } from "@/lib/data/detalle-viaje";
import type { EstadoUnidad } from "@/lib/supabase/database.types";
import { ETIQUETA_ESTADO, formatoFechaLarga, formatoHora, formatoKm } from "@/lib/formato";

// Plantillas HTML de correo con estilos en línea (lo que mejor soportan
// Outlook, Gmail y los clientes móviles). Todo texto variable se escapa.

const esc = (s: string | number | null | undefined) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const COLOR_ESTADO: Record<EstadoUnidad, [string, string]> = {
  apto: ["#E7F4EC", "#17643A"],
  requiere_correccion: ["#FDF1D8", "#7A4D00"],
  no_apto: ["#FCE8E6", "#A11D12"],
};

const chip = (e: EstadoUnidad | null) => {
  if (!e) return "";
  const [bg, fg] = COLOR_ESTADO[e];
  return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${bg};color:${fg};font-size:13px;font-weight:600">${esc(ETIQUETA_ESTADO[e])}</span>`;
};

const fila = (k: string, v: string) =>
  `<tr><td style="padding:9px 0;border-bottom:1px solid #EDF3F1;color:#4A5E63;font-size:14px">${esc(k)}</td><td style="padding:9px 0;border-bottom:1px solid #EDF3F1;text-align:right;font-size:14px;color:#0B2A33">${v}</td></tr>`;

const conteo = (i: InspeccionDetalle | null) => (i ? `${i.conteo.ok} OK · ${i.conteo.falla} Falla · ${i.conteo.na} N/A` : "—");

function bloqueHallazgos(v: DetalleViaje): string {
  const hallazgos = [v.salida, v.retorno].flatMap((i) =>
    i ? i.respuestas.filter((r) => r.resultado === "falla").map((r) => ({ tipo: i.tipo, r })) : [],
  );
  if (hallazgos.length === 0) return `<p style="margin:0;font-size:14px;color:#4A5E63">Sin hallazgos registrados.</p>`;
  return hallazgos
    .map(
      ({ tipo, r }) => `
      <div style="border:1px solid ${r.critico ? "#F1C9C4" : "#F0D49A"};background:${r.critico ? "#FFF7F6" : "#FFFBF2"};border-radius:10px;padding:12px 14px;margin-bottom:8px">
        <div style="font-size:14px;font-weight:600;color:#0B2A33">${tipo === "salida" ? "Salida" : "Retorno"} · ${esc(r.titulo)}${r.critico ? ' <span style="color:#A11D12">(crítico)</span>' : ""}</div>
        <div style="font-size:14px;line-height:1.45;color:#0B2A33;margin-top:4px">${esc(r.comentario)}</div>
        <div style="font-size:12px;color:#4A5E63;margin-top:4px">${r.fotos.length} fotografía(s) en el reporte</div>
      </div>`,
    )
    .join("");
}

function marco(encabezado: { linea1: string; titulo: string; linea3: string }, cuerpo: string, pie: string) {
  return `<!doctype html><html lang="es"><body style="margin:0;padding:0;background:#F3F8F5">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F8F5;padding:24px 0"><tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;font-family:'IBM Plex Sans',Segoe UI,Arial,sans-serif;color:#0B2A33">
    <tr><td style="background:#028132;color:#FFFFFF;padding:26px 30px">
      <div style="font-size:13px">${esc(encabezado.linea1)}</div>
      <div style="font-size:24px;font-weight:600;margin-top:4px">${esc(encabezado.titulo)}</div>
      <div style="font-size:14px;margin-top:4px">${esc(encabezado.linea3)}</div>
    </td></tr>
    <tr><td style="height:3px;background:#0E8CBC;line-height:3px;font-size:0">&nbsp;</td></tr>
    <tr><td style="padding:26px 30px">${cuerpo}</td></tr>
    <tr><td style="padding:18px 30px 26px;border-top:1px solid #DDE7E4;font-size:12px;line-height:1.5;color:#4A5E63">${pie}</td></tr>
  </table></td></tr></table></body></html>`;
}

const boton = (url: string, texto: string) =>
  `<a href="${esc(url)}" style="display:inline-block;background:#028132;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;padding:13px 24px;border-radius:10px">${esc(texto)}</a>`;

export function correoReporteViaje(v: DetalleViaje, urlDetalle: string) {
  const resultadoGlobal = v.camion.estadoActual;
  const asunto = `Reporte de viaje · Unidad ${v.camion.numero} · ${ETIQUETA_ESTADO[resultadoGlobal]}`;
  const cuerpo = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px"><tr>
      <td width="50%" style="padding-right:6px"><div style="border:1px solid #DDE7E4;border-radius:10px;padding:12px 14px">
        <div style="font-size:12px;color:#4A5E63;margin-bottom:6px">Salida · ${v.salida?.finalizadaAt ? esc(formatoHora(v.salida.finalizadaAt)) : "—"}</div>${chip(v.salida?.resultado ?? null)}</div></td>
      <td width="50%" style="padding-left:6px"><div style="border:1px solid #DDE7E4;border-radius:10px;padding:12px 14px">
        <div style="font-size:12px;color:#4A5E63;margin-bottom:6px">Retorno · ${v.retorno?.finalizadaAt ? esc(formatoHora(v.retorno.finalizadaAt)) : "—"}</div>${chip(v.retorno?.resultado ?? null)}</div></td>
    </tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px">
      ${fila("Estado actual de la unidad", chip(resultadoGlobal))}
      ${fila("Kilometraje", `${esc(formatoKm(v.kmInicial))} → ${esc(formatoKm(v.kmFinal))} (${esc(formatoKm(v.kmRecorridos))})`)}
      ${fila("Combustible final", esc(v.retorno?.combustible ?? "—"))}
      ${fila("Salida", esc(conteo(v.salida)))}
      ${fila("Retorno", esc(conteo(v.retorno)))}
      ${fila("Recibió la unidad", esc(v.retorno?.supervisor ?? "—"))}
    </table>
    <div style="font-size:16px;font-weight:600;margin-bottom:10px">Hallazgos</div>
    ${bloqueHallazgos(v)}
    <div style="margin-top:22px">${boton(urlDetalle, "Ver reporte completo")}</div>`;
  const html = marco(
    { linea1: `Reporte de viaje · ${formatoFechaLarga(new Date(v.salidaAt))}`, titulo: `Unidad ${v.camion.numero} · ${v.camion.placa}`, linea3: `${v.ruta} · ${v.conductor}` },
    cuerpo,
    `Mensaje automático del checklist de flota · Heineken · Distribución Retail. Folio ${esc(v.folio)}. No responda a este correo.`,
  );
  const texto = [
    `Reporte de viaje ${v.folio}`,
    `Unidad ${v.camion.numero} (${v.camion.placa}) · ${v.ruta} · ${v.conductor}`,
    `Salida: ${v.salida?.resultado ? ETIQUETA_ESTADO[v.salida.resultado] : "—"} · Retorno: ${v.retorno?.resultado ? ETIQUETA_ESTADO[v.retorno.resultado] : "—"}`,
    `Estado actual: ${ETIQUETA_ESTADO[resultadoGlobal]}`,
    `Kilometraje: ${formatoKm(v.kmInicial)} → ${formatoKm(v.kmFinal)} (${formatoKm(v.kmRecorridos)})`,
    `Ver reporte completo: ${urlDetalle}`,
  ].join("\n");
  return { asunto, html, texto };
}

export function correoAlertaNoApto(v: DetalleViaje, i: InspeccionDetalle, urlDetalle: string) {
  const asunto = `ALERTA · Unidad ${v.camion.numero} No apta para operar`;
  const fallas = i.respuestas.filter((r) => r.resultado === "falla");
  const cuerpo = `
    <div style="border:1px solid #F1C9C4;background:#FFF7F6;border-radius:12px;padding:16px;margin-bottom:20px">
      ${chip("no_apto")}
      <p style="margin:10px 0 0;font-size:14px;line-height:1.5">La inspección de ${i.tipo} registró una falla crítica. La unidad queda <strong>inmovilizada</strong> y no podrá iniciar un nuevo viaje hasta que se registre su liberación.</p>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
      ${fila("Inspección", `${esc(i.folio)} · ${esc(formatoHora(i.finalizadaAt ?? i.iniciadaAt))}`)}
      ${fila("Conductor", esc(v.conductor))}
      ${fila("Ruta", esc(v.ruta))}
      ${fila("Kilometraje", esc(formatoKm(i.kilometraje)))}
    </table>
    <div style="font-size:16px;font-weight:600;margin-bottom:10px">Fallas registradas</div>
    ${fallas
      .map(
        (r) => `<div style="border:1px solid #DDE7E4;border-radius:10px;padding:12px 14px;margin-bottom:8px">
          <div style="font-size:14px;font-weight:600">${esc(r.titulo)}${r.critico ? ' <span style="color:#A11D12">(crítico)</span>' : ""}</div>
          <div style="font-size:14px;margin-top:4px">${esc(r.comentario)}</div></div>`,
      )
      .join("")}
    <div style="margin-top:22px">${boton(urlDetalle, "Gestionar liberación")}</div>`;
  const html = marco(
    { linea1: "Alerta de inspección", titulo: `Unidad ${v.camion.numero} · ${v.camion.placa}`, linea3: "No apta para operar" },
    cuerpo,
    `Mensaje automático del checklist de flota · Heineken · Distribución Retail. No responda a este correo.`,
  );
  const texto = [
    `ALERTA: Unidad ${v.camion.numero} (${v.camion.placa}) No apta para operar.`,
    `Inspección ${i.folio} (${i.tipo}) · ${v.conductor} · ${v.ruta}`,
    ...fallas.map((r) => `- ${r.titulo}: ${r.comentario ?? ""}`),
    `Gestionar liberación: ${urlDetalle}`,
  ].join("\n");
  return { asunto, html, texto };
}
