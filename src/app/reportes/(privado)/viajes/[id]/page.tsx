import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EstadoBadge } from "@/components/estado-badge";
import { detalleViaje, type InspeccionDetalle } from "@/lib/data/detalle-viaje";
import { db } from "@/lib/supabase/server";
import { urlsFirmadas } from "@/lib/supabase/storage";
import { exigirSesionReportes } from "@/lib/reportes/guardia";
import { formatoFechaHora, formatoFechaLarga, formatoHora, formatoKm } from "@/lib/formato";
import { BotonReenviar, FormularioLiberacion } from "./formularios";

export const metadata: Metadata = { title: "Detalle del viaje" };

const ESTILO_RES = {
  ok: "bg-marca-suave text-marca-oscuro",
  falla: "bg-noapto-fondo text-noapto",
  na: "bg-[#F1F3F6] text-tinta-suave",
} as const;
const TEXTO_RES = { ok: "OK", falla: "Falla", na: "N/A" } as const;
const DECISION = { autorizada_hallazgo_menor: "Autorizada con hallazgo menor", corregida_liberada: "Corregida y liberada" } as const;

function TablaInspeccion({ titulo, i, vacio }: { titulo: string; i: InspeccionDetalle | null; vacio?: string }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-linea">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-linea px-4 py-3.5">
        <h2 className="text-[15px] font-semibold">{titulo}</h2>
        {i ? (
          <span className="text-xs text-tinta-suave">{i.conteo.ok} OK · {i.conteo.falla} Falla · {i.conteo.na} N/A</span>
        ) : (
          <span className="text-xs text-tinta-suave">Pendiente</span>
        )}
      </div>
      {i ? (
        <ul>
          {i.respuestas.map((r) => (
            <li key={r.id} className="flex items-center gap-3 border-t border-[#EEF2F7] px-4 py-2.5 text-[13px] first:border-t-0">
              <span className="w-5 text-tinta-suave">{r.orden}</span>
              <span className="flex-1">{r.titulo}{r.critico && <span className="ml-1.5 text-[11px] text-acero-oscuro">crítico</span>}</span>
              <span className={`min-w-11 rounded-full px-2.5 py-0.5 text-center text-xs font-semibold ${ESTILO_RES[r.resultado]}`}>{TEXTO_RES[r.resultado]}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-6 text-[13px] text-tinta-suave">{vacio ?? "La unidad aún no registra la inspección de retorno."}</p>
      )}
    </section>
  );
}

// Pantalla 11 · Detalle del viaje y liberación
export default async function DetalleViajePage({ params }: PageProps<"/reportes/viajes/[id]">) {
  await exigirSesionReportes();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const v = await detalleViaje(id);
  if (!v) notFound();

  const inspecciones = [v.salida, v.retorno].filter((x): x is InspeccionDetalle => Boolean(x));
  const hallazgos = inspecciones.flatMap((i) => i.respuestas.filter((r) => r.resultado === "falla").map((r) => ({ i, r })));
  const firmas = inspecciones.flatMap((i) => i.firmas.map((f) => ({ ...f, inspeccion: i.tipo })));
  const urls = await urlsFirmadas([...hallazgos.flatMap((h) => h.r.fotos), ...firmas.map((f) => f.ruta)]);

  const [{ data: liberaciones }, { data: notificaciones }] = await Promise.all([
    db().from("liberaciones").select("*").eq("camion_id", v.camion.id).gte("created_at", v.salidaAt).order("created_at", { ascending: false }),
    db().from("notificaciones_correo").select("*").eq("viaje_id", v.id).order("created_at", { ascending: false }).limit(10),
  ]);

  const ultimaInspeccion = v.retorno ?? v.salida;
  const requiereLiberacion = v.camion.estadoActual !== "apto";

  return (
    <>
      <nav className="text-[13px] text-tinta-suave" aria-label="Ruta de navegación">
        <Link href="/reportes/listado" className="font-medium text-marca">Reportes</Link> › Viaje <span className="font-mono">{v.folio}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[26px] font-semibold">
            Unidad {v.camion.numero} · <span className="font-mono font-medium">{v.camion.placa}</span>
          </h1>
          <p className="text-sm text-tinta-suave">
            {v.conductor} · {v.ruta} · {v.camion.tipo === "refrigerado" ? "Refrigerado" : "Seco"} · {formatoFechaLarga(new Date(v.salidaAt))}
          </p>
        </div>
        {v.retorno && <BotonReenviar viajeId={v.id} />}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <div className="flex flex-col gap-1.5 rounded-xl border border-linea px-4 py-3.5">
          <span className="text-xs text-tinta-suave">Salida{v.salida?.finalizadaAt ? ` · ${formatoHora(v.salida.finalizadaAt)}` : ""}</span>
          <EstadoBadge estado={v.salida?.resultado ?? null} className="self-start text-[13px]" />
        </div>
        <div className="flex flex-col gap-1.5 rounded-xl border border-linea px-4 py-3.5">
          <span className="text-xs text-tinta-suave">Retorno{v.retorno?.finalizadaAt ? ` · ${formatoHora(v.retorno.finalizadaAt)}` : ""}</span>
          {v.retorno ? (
            <EstadoBadge estado={v.retorno.resultado} className="self-start text-[13px]" />
          ) : v.estado === "cancelado" ? (
            <span className="text-[13px] font-semibold text-noapto">Viaje cancelado</span>
          ) : (
            <span className="text-[13px] font-semibold text-marca">En ruta</span>
          )}
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-linea px-4 py-3.5">
          <span className="text-xs text-tinta-suave">Kilometraje</span>
          <span className="font-mono text-sm">{formatoKm(v.kmInicial)} → {formatoKm(v.kmFinal)}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-marca bg-marca-suave px-4 py-3.5">
          <span className="text-xs text-marca-oscuro">Recorridos</span>
          <span className="text-xl font-semibold text-marca-oscuro">{formatoKm(v.kmRecorridos)}</span>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-4">
        <TablaInspeccion titulo="Inspección de salida" i={v.salida} />
        <TablaInspeccion
          titulo="Inspección de retorno"
          i={v.retorno}
          vacio={v.estado === "cancelado" ? "Viaje cancelado: la salida resultó No apta y la unidad no salió a ruta." : undefined}
        />
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border border-linea p-5">
        <h2 className="text-[15px] font-semibold">Hallazgos</h2>
        {hallazgos.length === 0 && <p className="text-[13px] text-tinta-suave">Sin hallazgos en este viaje.</p>}
        {hallazgos.map(({ i, r }) => (
          <div key={r.id} className="flex flex-wrap gap-5 border-t border-[#EEF2F7] pt-4 first:border-t-0 first:pt-0">
            <div className="flex flex-wrap gap-2.5">
              {r.fotos.map((ruta, n) =>
                urls[ruta] ? (
                  <a key={ruta} href={urls[ruta]} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Storage */}
                    <img src={urls[ruta]} alt={`Fotografía ${n + 1}: ${r.titulo}`} className="h-[120px] w-40 rounded-[10px] border border-linea object-cover" />
                  </a>
                ) : (
                  <div key={ruta} className="flex h-[120px] w-40 items-center justify-center rounded-[10px] border border-linea bg-[#EAF0F6] text-xs text-tinta-suave">Sin vista previa</div>
                ),
              )}
            </div>
            <div className="flex min-w-[240px] flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{i.tipo === "salida" ? "Salida" : "Retorno"} · {r.orden} {r.titulo}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.critico ? "bg-noapto-fondo text-noapto" : "bg-correccion-fondo text-correccion"}`}>
                  {r.critico ? "Crítico" : "Menor"}
                </span>
              </div>
              <p className="text-sm leading-relaxed">{r.comentario}</p>
              <span className="text-xs text-tinta-suave">Inspección {i.folio} · {formatoHora(i.iniciadaAt)}</span>
            </div>
          </div>
        ))}
        {inspecciones.some((i) => i.observaciones) && (
          <div className="flex flex-col gap-1 border-t border-[#EEF2F7] pt-4">
            <span className="text-xs font-medium text-tinta-suave">Observaciones</span>
            {inspecciones.filter((i) => i.observaciones).map((i) => (
              <p key={i.id} className="text-sm"><strong className="font-semibold">{i.tipo === "salida" ? "Salida" : "Retorno"}:</strong> {i.observaciones}</p>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(380px,1fr))] gap-4">
        <section className="flex flex-col gap-3.5 rounded-2xl border border-linea p-5">
          <h2 className="text-[15px] font-semibold">Firmas</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
            {firmas.map((f) => (
              <div key={f.ruta} className="flex flex-col gap-1.5">
                <div className="flex h-20 items-center justify-center rounded-[10px] border border-linea bg-white">
                  {urls[f.ruta] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Storage
                    <img src={urls[f.ruta]} alt={`Firma de ${f.nombre}`} className="max-h-[72px] max-w-full object-contain" />
                  ) : (
                    <span className="text-xs text-tinta-suave">No disponible</span>
                  )}
                </div>
                <span className="text-xs font-semibold">{f.nombre}</span>
                <span className="text-xs text-tinta-suave">{f.tipo === "conductor" ? "Conductor" : "Supervisor"} · {f.inspeccion}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3.5 rounded-2xl border border-linea p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold">Autorización y liberación de la unidad</h2>
            <span className="flex items-center gap-2 text-xs text-tinta-suave">Estado actual <EstadoBadge estado={v.camion.estadoActual} /></span>
          </div>
          {requiereLiberacion ? (
            <>
              <p className="text-[13px] leading-relaxed text-tinta-suave">
                Registre la corrección o autorización del hallazgo.
                {v.camion.estadoActual === "no_apto" && " La unidad está bloqueada para nuevas salidas hasta este registro."}
              </p>
              <FormularioLiberacion viajeId={v.id} camionId={v.camion.id} inspeccionId={ultimaInspeccion?.id} />
            </>
          ) : (
            <p className="text-[13px] text-tinta-suave">La unidad está apta. No hay hallazgos pendientes de liberar.</p>
          )}
          {liberaciones && liberaciones.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-[#EEF2F7] pt-3.5">
              <span className="text-xs font-medium text-tinta-suave">Historial</span>
              {liberaciones.map((l) => (
                <div key={l.id} className="text-[13px] leading-relaxed">
                  <strong className="font-semibold">{DECISION[l.decision]}</strong> · {l.responsable_nombre} · {formatoFechaHora(l.created_at)}
                  <p className="text-tinta-suave">{l.accion_tomada}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {notificaciones && notificaciones.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border border-linea p-5">
          <h2 className="text-[15px] font-semibold">Correos enviados</h2>
          {notificaciones.map((n) => (
            <div key={n.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#EEF2F7] pt-2 text-[13px] first:border-t-0 first:pt-0">
              <span className="font-medium">{n.tipo === "reporte_viaje" ? "Reporte de viaje" : n.tipo === "alerta_no_apto" ? "Alerta No apto" : "Resumen"}</span>
              <span className="text-tinta-suave">{formatoFechaHora(n.created_at)}</span>
              <span className={n.estado === "enviado" ? "text-apto" : n.estado === "error" ? "text-noapto" : "text-tinta-suave"}>
                {n.estado === "enviado" ? `Enviado a ${n.destinatarios.length}` : n.estado === "error" ? `No enviado: ${n.error}` : "Pendiente"}
              </span>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
