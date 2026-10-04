"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { EstadoBadge } from "@/components/estado-badge";
import { FranjaMarca } from "@/components/marca";
import { PanelFirma } from "@/components/panel-firma";
import { comprimirFoto, dataUrlABlob } from "@/lib/imagen";
import type { EstadoUnidad, ResultadoItem, TipoInspeccion, TipoUnidad } from "@/lib/supabase/database.types";
import { enviarInspeccion, subirFotoHallazgo } from "../acciones";

// ---------------------------------------------------------------------------
// Tipos que llegan del servidor
// ---------------------------------------------------------------------------
export type Punto = {
  id: string;
  orden: number;
  titulo: string;
  descripcion: string;
  critico: boolean;
  critico_si_refrigerado: boolean;
};
export type OpcionCamion = {
  id: string;
  numero_unidad: string;
  placa: string;
  tipo: TipoUnidad;
  estado_actual: EstadoUnidad;
  ultimo_km: number | null;
  en_ruta: boolean;
};
export type OpcionPersona = { id: string; nombre: string; codigo_empleado: string };
export type OpcionRuta = { id: string; codigo: string; descripcion: string };
export type OpcionViaje = {
  id: string;
  folio: string;
  kmInicial: number;
  salidaAt: string;
  camion: { numero: string; placa: string; tipo: TipoUnidad };
  conductor: string;
  ruta: string;
  resultadoSalida: EstadoUnidad | null;
};

type Props = {
  tipo: TipoInspeccion;
  puntos: Punto[];
  camiones: OpcionCamion[];
  conductores: OpcionPersona[];
  supervisores: OpcionPersona[];
  rutas: OpcionRuta[];
  viajes: OpcionViaje[];
};

// ---------------------------------------------------------------------------
// Estado del formulario (se guarda como borrador en el teléfono)
// ---------------------------------------------------------------------------
type Foto = { ruta: string; miniatura: string };
type Respuesta = { resultado?: ResultadoItem; comentario: string; fotos: Foto[] };
type Borrador = {
  v: 1;
  guardadoAt: string;
  iniciadaAt: string;
  paso: number;
  camionId: string;
  conductorId: string;
  rutaId: string;
  viajeId: string;
  kilometraje: string;
  combustible: string;
  observaciones: string;
  supervisorId: string;
  respuestas: Record<string, Respuesta>;
  firmaConductor: string | null;
  firmaSupervisor: string | null;
  confirmado: boolean;
};

const COMBUSTIBLE = ["Reserva", "1/4 tanque", "1/2 tanque", "3/4 tanque", "Lleno"];
const MAX_FOTOS = 3;
const VIGENCIA_BORRADOR_MS = 24 * 3600_000;

function borradorVacio(): Borrador {
  return {
    v: 1,
    guardadoAt: new Date().toISOString(),
    iniciadaAt: new Date().toISOString(),
    paso: 0,
    camionId: "",
    conductorId: "",
    rutaId: "",
    viajeId: "",
    kilometraje: "",
    combustible: "",
    observaciones: "",
    supervisorId: "",
    respuestas: {},
    firmaConductor: null,
    firmaSupervisor: null,
    confirmado: false,
  };
}

const horaCR = (iso: string) =>
  new Intl.DateTimeFormat("es-CR", { timeZone: "America/Costa_Rica", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
const fechaHoraCR = (iso: string) =>
  new Intl.DateTimeFormat("es-CR", {
    timeZone: "America/Costa_Rica",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
function sinClave(obj: Record<string, string>, clave: string) {
  if (!(clave in obj)) return obj;
  const copia = { ...obj };
  delete copia[clave];
  return copia;
}

const km = (n: number) => `${new Intl.NumberFormat("es-CR").format(n)} km`;

// ---------------------------------------------------------------------------
export function FormularioInspeccion(props: Props) {
  const { tipo, puntos } = props;
  const esSalida = tipo === "salida";
  const pasos = esSalida ? ["Datos generales", "Checklist de inspección", "Resumen y firma"] : ["Revisión al regresar", "Cierre del viaje"];
  const claveBorrador = `fifco-checklist-borrador-${tipo}`;

  const router = useRouter();
  const [f, setF] = useState<Borrador>(borradorVacio);
  const [cargado, setCargado] = useState(false);
  const [recuperado, setRecuperado] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<Record<string, boolean>>({});
  const [enviando, iniciarEnvio] = useTransition();
  const arriba = useRef<HTMLDivElement>(null);

  // Recupera el borrador guardado en este teléfono
  useEffect(() => {
    try {
      const txt = localStorage.getItem(claveBorrador);
      if (txt) {
        const b = JSON.parse(txt) as Borrador;
        if (b.v === 1 && Date.now() - new Date(b.guardadoAt).getTime() < VIGENCIA_BORRADOR_MS) {
          setF(b);
          setRecuperado(b.guardadoAt);
        } else localStorage.removeItem(claveBorrador);
      }
    } catch {
      /* sin almacenamiento disponible: se trabaja sin borrador */
    }
    setCargado(true);
  }, [claveBorrador]);

  // Guarda el borrador en cada cambio
  useEffect(() => {
    if (!cargado) return;
    try {
      localStorage.setItem(claveBorrador, JSON.stringify({ ...f, guardadoAt: new Date().toISOString() }));
    } catch {
      /* almacenamiento lleno o bloqueado */
    }
  }, [f, cargado, claveBorrador]);

  const set = <K extends keyof Borrador>(k: K, v: Borrador[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrores((e) => sinClave(e, k as string));
  };

  const setRespuesta = (id: string, cambio: Partial<Respuesta>) => {
    setF((p) => {
      const actual = p.respuestas[id] ?? { comentario: "", fotos: [] };
      return { ...p, respuestas: { ...p.respuestas, [id]: { ...actual, ...cambio } } };
    });
    setErrores((e) => sinClave(e, `item-${id}`));
  };

  // Datos derivados
  const camion = props.camiones.find((c) => c.id === f.camionId);
  const viaje = props.viajes.find((v) => v.id === f.viajeId);
  const tipoUnidad: TipoUnidad | undefined = esSalida ? camion?.tipo : viaje?.camion.tipo;
  const esCritico = (p: Punto) => p.critico || (p.critico_si_refrigerado && tipoUnidad === "refrigerado");

  const resumen = useMemo(() => {
    let revisados = 0, ok = 0, falla = 0, na = 0, fallaCritica = false;
    for (const p of puntos) {
      const r = f.respuestas[p.id]?.resultado;
      if (!r) continue;
      revisados++;
      if (r === "ok") ok++;
      if (r === "na") na++;
      if (r === "falla") {
        falla++;
        if (p.critico || (p.critico_si_refrigerado && tipoUnidad === "refrigerado")) fallaCritica = true;
      }
    }
    const estado: EstadoUnidad | null = fallaCritica
      ? "no_apto"
      : falla > 0
        ? "requiere_correccion"
        : revisados === puntos.length
          ? "apto"
          : null;
    return { revisados, ok, falla, na, estado };
  }, [f.respuestas, puntos, tipoUnidad]);

  // ---------------------------------------------------------------------------
  // Validación por paso
  // ---------------------------------------------------------------------------
  function validarDatos(e: Record<string, string>) {
    const n = Number(f.kilometraje.replace(/\s|\./g, ""));
    if (esSalida) {
      if (!f.camionId) e.camionId = "Seleccione la unidad.";
      else if (camion?.en_ruta) e.camionId = "Esta unidad tiene un viaje abierto. Registre primero su retorno.";
      else if (camion?.estado_actual === "no_apto") e.camionId = "Unidad No apta: requiere liberación antes de salir.";
      if (!f.conductorId) e.conductorId = "Seleccione el conductor.";
      if (!f.rutaId) e.rutaId = "Seleccione la ruta.";
      if (!f.kilometraje || !Number.isInteger(n) || n < 0) e.kilometraje = "Ingrese el kilometraje inicial.";
      else if (camion?.ultimo_km != null && n < camion.ultimo_km) e.kilometraje = `No puede ser menor al último registro (${km(camion.ultimo_km)}).`;
    } else {
      if (!f.viajeId) e.viajeId = "Seleccione la unidad que regresa.";
      if (!f.kilometraje || !Number.isInteger(n) || n < 0) e.kilometraje = "Ingrese el kilometraje final.";
      else if (viaje && n < viaje.kmInicial) e.kilometraje = `No puede ser menor al inicial (${km(viaje.kmInicial)}).`;
      if (!f.combustible) e.combustible = "Seleccione el nivel.";
    }
  }

  function validarChecklist(e: Record<string, string>) {
    for (const p of puntos) {
      const r = f.respuestas[p.id];
      if (!r?.resultado) e[`item-${p.id}`] = "Marque OK, Falla o N/A.";
      else if (r.resultado === "falla" && (!r.comentario.trim() || r.fotos.length === 0)) {
        e[`item-${p.id}`] = "La descripción y al menos una fotografía son obligatorias.";
      }
    }
    if (Object.values(subiendo).some(Boolean)) e.subida = "Espere a que terminen de subir las fotografías.";
  }

  function validarFirmas(e: Record<string, string>) {
    if (!f.firmaConductor) e.firmaConductor = "Falta la firma del conductor.";
    if (!esSalida) {
      if (!f.supervisorId) e.supervisorId = "Seleccione el supervisor.";
      if (!f.firmaSupervisor) e.firmaSupervisor = "Falta la firma del supervisor.";
    }
    if (esSalida && !f.confirmado) e.confirmado = "Debe confirmar la inspección.";
  }

  function validarPaso(paso: number) {
    const e: Record<string, string> = {};
    if (esSalida) {
      if (paso === 0) validarDatos(e);
      if (paso === 1) validarChecklist(e);
      if (paso === 2) validarFirmas(e);
    } else {
      if (paso === 0) {
        validarDatos(e);
        validarChecklist(e);
      }
      if (paso === 1) validarFirmas(e);
    }
    setErrores(e);
    if (Object.keys(e).length > 0) {
      const primero = Object.keys(e)[0];
      requestAnimationFrame(() => document.getElementById(`campo-${primero}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return false;
    }
    return true;
  }

  function irA(paso: number) {
    set("paso", paso);
    arriba.current?.scrollIntoView({ block: "start" });
  }

  // ---------------------------------------------------------------------------
  // Fotos
  // ---------------------------------------------------------------------------
  async function agregarFoto(puntoId: string, archivo: File) {
    setSubiendo((s) => ({ ...s, [puntoId]: true }));
    try {
      const { archivo: comprimido, miniatura } = await comprimirFoto(archivo);
      const fd = new FormData();
      fd.append("foto", comprimido);
      const res = await subirFotoHallazgo(fd);
      if (!res.ok) throw new Error(res.error);
      setF((p) => {
        const actual = p.respuestas[puntoId] ?? { comentario: "", fotos: [] };
        return {
          ...p,
          respuestas: { ...p.respuestas, [puntoId]: { ...actual, fotos: [...actual.fotos, { ruta: res.ruta, miniatura }] } },
        };
      });
      setErrores((e) => sinClave(e, `item-${puntoId}`));
    } catch (err) {
      const sinRed = typeof navigator !== "undefined" && !navigator.onLine;
      setErrores((e) => ({
        ...e,
        [`item-${puntoId}`]: sinRed
          ? "Sin conexión: la fotografía no se pudo subir. Intente de nuevo cuando tenga señal."
          : err instanceof Error
            ? err.message
            : "No se pudo subir la fotografía.",
      }));
    } finally {
      setSubiendo((s) => ({ ...s, [puntoId]: false }));
    }
  }

  // ---------------------------------------------------------------------------
  // Envío
  // ---------------------------------------------------------------------------
  function enviar() {
    if (!validarPaso(f.paso)) return;
    setErrorEnvio(null);
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setErrorEnvio("Sin conexión. La inspección quedó guardada en este teléfono; envíela cuando tenga señal.");
      return;
    }
    iniciarEnvio(async () => {
      const respuestas = puntos.map((p) => {
        const r = f.respuestas[p.id]!;
        return {
          itemId: p.id,
          resultado: r.resultado!,
          comentario: r.resultado === "falla" ? r.comentario.trim() : r.comentario.trim() || undefined,
          fotos: r.resultado === "falla" ? r.fotos.map((x) => x.ruta) : [],
        };
      });
      const kilometraje = Number(f.kilometraje.replace(/\s|\./g, ""));
      const datos = esSalida
        ? { tipo, camionId: f.camionId, conductorId: f.conductorId, rutaId: f.rutaId, kilometraje, iniciadaAt: f.iniciadaAt, observaciones: f.observaciones, respuestas }
        : { tipo, viajeId: f.viajeId, kilometraje, combustible: f.combustible, supervisorId: f.supervisorId, iniciadaAt: f.iniciadaAt, observaciones: f.observaciones, respuestas };

      const fd = new FormData();
      fd.append("datos", JSON.stringify(datos));
      fd.append("firmaConductor", new File([await dataUrlABlob(f.firmaConductor!)], "firma-conductor.png", { type: "image/png" }));
      if (!esSalida && f.firmaSupervisor) {
        fd.append("firmaSupervisor", new File([await dataUrlABlob(f.firmaSupervisor)], "firma-supervisor.png", { type: "image/png" }));
      }

      try {
        const res = await enviarInspeccion(fd);
        if (!res.ok) {
          setErrorEnvio(res.error);
          return;
        }
        try {
          localStorage.removeItem(claveBorrador);
        } catch {}
        router.push(`/inspeccion/enviada/${encodeURIComponent(res.folio)}`);
      } catch {
        setErrorEnvio("No se pudo enviar. Revise la conexión e intente de nuevo; los datos siguen guardados.");
      }
    });
  }

  function descartarBorrador() {
    try {
      localStorage.removeItem(claveBorrador);
    } catch {}
    setF(borradorVacio());
    setRecuperado(null);
    setErrores({});
  }

  // ---------------------------------------------------------------------------
  // Vista
  // ---------------------------------------------------------------------------
  const ultimoPaso = f.paso === pasos.length - 1;
  const subtitulo = esSalida
    ? camion
      ? `Inspección de salida · Unidad ${camion.numero_unidad}`
      : "Inspección de salida"
    : viaje
      ? `Inspección de retorno · Unidad ${viaje.camion.numero}`
      : "Inspección de retorno";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col" ref={arriba}>
      <FranjaMarca />
      <div className="flex flex-col gap-2.5 border-b border-linea px-5 pb-4 pt-2">
        <div className="flex items-center justify-between">
          {f.paso === 0 ? (
            <Link href="/" className="flex min-h-11 items-center text-sm font-medium text-marca">‹ Inicio</Link>
          ) : (
            <button type="button" onClick={() => irA(f.paso - 1)} className="flex min-h-11 items-center text-sm font-medium text-marca">
              ‹ {pasos[f.paso - 1]}
            </button>
          )}
          <span className="text-xs text-tinta-suave">Paso {f.paso + 1} de {pasos.length}</span>
        </div>
        <div>
          <p className="text-[13px] font-semibold text-marca">{subtitulo}</p>
          <h1 className="mt-0.5 text-[22px] font-semibold">{pasos[f.paso]}</h1>
        </div>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${pasos.length}, minmax(0, 1fr))` }} aria-hidden="true">
          {pasos.map((p, i) => (
            <div key={p} className={`h-1 rounded-full ${i <= f.paso ? "bg-marca" : "bg-linea"}`} />
          ))}
        </div>
      </div>

      {recuperado && (
        <div className="mx-5 mt-4 flex items-center justify-between gap-3 rounded-xl border border-linea bg-fondo-suave px-3.5 py-2.5 text-[13px]">
          <span>Se recuperó el borrador de las {horaCR(recuperado)}.</span>
          <button type="button" onClick={descartarBorrador} className="min-h-11 shrink-0 font-semibold text-marca">
            Empezar de nuevo
          </button>
        </div>
      )}

      {/* --------------------------- Paso: datos --------------------------- */}
      {f.paso === 0 && (
        <div className="flex flex-col gap-4 px-5 pt-5">
          <div className="flex items-center gap-3 rounded-xl border border-linea bg-fondo-suave px-3.5 py-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-tinta-suave">Fecha y hora de inicio (automático)</span>
              <span className="text-[15px] font-semibold">{cargado ? fechaHoraCR(f.iniciadaAt) : "—"}</span>
            </div>
          </div>

          {esSalida ? (
            <>
              <Campo id="camionId" etiqueta="Placa y número de unidad" error={errores.camionId}>
                <select id="camionId" value={f.camionId} onChange={(e) => set("camionId", e.target.value)} className={claseSelect(errores.camionId)}>
                  <option value="">Seleccione la unidad</option>
                  {props.camiones.map((c) => (
                    <option key={c.id} value={c.id} disabled={c.en_ruta || c.estado_actual === "no_apto"}>
                      Unidad {c.numero_unidad} · {c.placa} · {c.tipo === "refrigerado" ? "Refrigerado" : "Seco"}
                      {c.en_ruta ? " · en ruta" : c.estado_actual === "no_apto" ? " · No apta" : ""}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo id="conductorId" etiqueta="Nombre del conductor" error={errores.conductorId}>
                <select id="conductorId" value={f.conductorId} onChange={(e) => set("conductorId", e.target.value)} className={claseSelect(errores.conductorId)}>
                  <option value="">Seleccione el conductor</option>
                  {props.conductores.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre} · Cód. {p.codigo_empleado}</option>
                  ))}
                </select>
              </Campo>
              <Campo id="rutaId" etiqueta="Número de ruta" error={errores.rutaId}>
                <select id="rutaId" value={f.rutaId} onChange={(e) => set("rutaId", e.target.value)} className={claseSelect(errores.rutaId)}>
                  <option value="">Seleccione la ruta</option>
                  {props.rutas.map((r) => (
                    <option key={r.id} value={r.id}>{r.codigo} · {r.descripcion}</option>
                  ))}
                </select>
              </Campo>
              <Campo
                id="kilometraje"
                etiqueta="Kilometraje inicial"
                error={errores.kilometraje}
                ayuda={camion?.ultimo_km != null ? `Último registro de esta unidad: ${km(camion.ultimo_km)}` : undefined}
              >
                <EntradaKm valor={f.kilometraje} onCambio={(v) => set("kilometraje", v)} error={errores.kilometraje} />
              </Campo>
            </>
          ) : (
            <>
              <Campo id="viajeId" etiqueta="Unidad que regresa" error={errores.viajeId}>
                <select id="viajeId" value={f.viajeId} onChange={(e) => set("viajeId", e.target.value)} className={claseSelect(errores.viajeId)}>
                  <option value="">{props.viajes.length ? "Seleccione la unidad" : "No hay unidades en ruta"}</option>
                  {props.viajes.map((v) => (
                    <option key={v.id} value={v.id}>
                      Unidad {v.camion.numero} · {v.camion.placa} · en ruta desde {horaCR(v.salidaAt)}
                    </option>
                  ))}
                </select>
              </Campo>
              {viaje && (
                <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-xl border border-linea bg-fondo-suave px-3.5 py-3">
                  <Dato k="Conductor" v={viaje.conductor} />
                  <Dato k="Ruta" v={viaje.ruta} />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-tinta-suave">Salida</span>
                    <span className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold">
                      {horaCR(viaje.salidaAt)} <EstadoBadge estado={viaje.resultadoSalida} />
                    </span>
                  </div>
                  <Dato k="Km inicial" v={km(viaje.kmInicial)} mono />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2.5">
                <Campo id="kilometraje" etiqueta="Km final" error={errores.kilometraje}>
                  <EntradaKm valor={f.kilometraje} onCambio={(v) => set("kilometraje", v)} error={errores.kilometraje} />
                </Campo>
                <Campo id="combustible" etiqueta="Combustible final" error={errores.combustible}>
                  <select id="combustible" value={f.combustible} onChange={(e) => set("combustible", e.target.value)} className={claseSelect(errores.combustible)}>
                    <option value="">Nivel</option>
                    {COMBUSTIBLE.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Campo>
              </div>
            </>
          )}
        </div>
      )}

      {/* ------------------------- Paso: checklist ------------------------- */}
      {((esSalida && f.paso === 1) || (!esSalida && f.paso === 0)) && (
        <div className="flex flex-col gap-2.5 px-5 pt-4">
          <div className="flex flex-col gap-2.5 rounded-xl border border-linea p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{resumen.revisados} de {puntos.length} revisados</span>
              <EstadoBadge estado={resumen.estado} />
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#EAF0F6]">
              <div className="h-1.5 rounded-full bg-celeste transition-[width]" style={{ width: `${(resumen.revisados / puntos.length) * 100}%` }} />
            </div>
            <span className="text-xs text-tinta-suave">Una falla en un punto crítico deja la unidad como No apta.</span>
          </div>
          {errores.subida && <p className="text-[13px] text-noapto">{errores.subida}</p>}

          {puntos.map((p) => {
            const r = f.respuestas[p.id] ?? { comentario: "", fotos: [] };
            const err = errores[`item-${p.id}`];
            return (
              <fieldset
                key={p.id}
                id={`campo-item-${p.id}`}
                className={`flex flex-col gap-3 rounded-xl border p-3.5 ${r.resultado === "falla" || err ? "border-[#E4A39C]" : "border-linea"}`}
              >
                <legend className="sr-only">{p.orden}. {p.titulo}</legend>
                <div className="flex items-start gap-2.5">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-marca-suave text-[13px] font-semibold text-marca">{p.orden}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-semibold">{p.titulo}</span>
                      {esCritico(p) && (
                        <span className="rounded-full border border-acero px-2 text-[11px] font-semibold text-acero-oscuro">Crítico</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[13px] leading-snug text-tinta-suave">{p.descripcion}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(["ok", "falla", "na"] as const).map((op) => {
                    const activo = r.resultado === op;
                    const color = op === "ok" ? "bg-marca border-marca" : op === "falla" ? "bg-falla border-falla" : "bg-tinta-suave border-tinta-suave";
                    return (
                      <button
                        key={op}
                        type="button"
                        aria-pressed={activo}
                        onClick={() => setRespuesta(p.id, { resultado: activo ? undefined : op })}
                        className={`h-11 rounded-[10px] border text-sm font-semibold transition-colors ${activo ? `${color} text-white` : "border-linea-fuerte bg-white text-tinta-suave"}`}
                      >
                        {op === "ok" ? "OK" : op === "falla" ? "Falla" : "N/A"}
                      </button>
                    );
                  })}
                </div>
                {r.resultado === "falla" && (
                  <div className="flex flex-col gap-2.5 pt-1">
                    <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                      Descripción del hallazgo
                      <textarea
                        rows={3}
                        value={r.comentario}
                        onChange={(e) => setRespuesta(p.id, { comentario: e.target.value })}
                        placeholder="Describa la falla observada"
                        className="resize-none rounded-[10px] border border-linea-fuerte px-3 py-2.5 text-sm font-normal outline-none focus:border-marca"
                      />
                    </label>
                    <div className="flex flex-wrap items-center gap-2.5">
                      {r.fotos.map((foto, i) => (
                        <div key={foto.ruta} className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element -- miniatura local en data URL */}
                          <img src={foto.miniatura} alt={`Fotografía ${i + 1} del hallazgo`} className="size-[72px] rounded-[10px] border border-linea object-cover" />
                          <button
                            type="button"
                            aria-label={`Quitar fotografía ${i + 1}`}
                            onClick={() => setRespuesta(p.id, { fotos: r.fotos.filter((x) => x.ruta !== foto.ruta) })}
                            className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-tinta text-xs text-white"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {r.fotos.length < MAX_FOTOS && (
                        <label
                          className={`flex h-[72px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-dashed border-acero text-sm font-semibold text-marca ${subiendo[p.id] ? "opacity-60" : ""}`}
                        >
                          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M4 8h3l2-2h6l2 2h3v11H4z" /><circle cx="12" cy="13" r="3.5" />
                          </svg>
                          {subiendo[p.id] ? "Subiendo…" : "Agregar fotografía"}
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="sr-only"
                            disabled={subiendo[p.id]}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.target.value = "";
                              if (file) agregarFoto(p.id, file);
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                )}
                {err && <p role="alert" className="text-xs text-noapto">{err}</p>}
              </fieldset>
            );
          })}
        </div>
      )}

      {/* --------------------- Paso: resumen y firmas ---------------------- */}
      {ultimoPaso && (
        <div className="flex flex-col gap-4 px-5 pt-5">
          <TarjetaResultado estado={resumen.estado} tipo={tipo} />
          <div className="grid grid-cols-3 gap-2">
            <Contador n={resumen.ok} etiqueta="OK" color="text-marca" />
            <Contador n={resumen.falla} etiqueta="Falla" color="text-falla" />
            <Contador n={resumen.na} etiqueta="N/A" color="text-tinta-suave" />
          </div>

          {resumen.falla > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-[15px] font-semibold">Hallazgos</h2>
              {puntos
                .filter((p) => f.respuestas[p.id]?.resultado === "falla")
                .map((p) => {
                  const r = f.respuestas[p.id]!;
                  return (
                    <div key={p.id} className="flex gap-3 rounded-xl border border-linea p-3">
                      {r.fotos[0] && (
                        // eslint-disable-next-line @next/next/no-img-element -- miniatura local en data URL
                        <img src={r.fotos[0].miniatura} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
                      )}
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-semibold">{p.orden} · {p.titulo}</span>
                        <span className="text-[13px] leading-snug text-tinta-suave">{r.comentario}</span>
                      </div>
                    </div>
                  );
                })}
            </section>
          )}

          <div className="rounded-xl border border-linea px-3.5 py-1">
            {esSalida ? (
              <>
                <FilaResumen k="Unidad" v={camion ? `${camion.numero_unidad} · ${camion.placa}` : "—"} />
                <FilaResumen k="Conductor" v={props.conductores.find((c) => c.id === f.conductorId)?.nombre ?? "—"} />
                <FilaResumen k="Ruta" v={(() => { const r = props.rutas.find((x) => x.id === f.rutaId); return r ? `${r.codigo} · ${r.descripcion}` : "—"; })()} />
                <FilaResumen k="Kilometraje inicial" v={f.kilometraje ? km(Number(f.kilometraje)) : "—"} />
              </>
            ) : (
              viaje && (
                <>
                  <FilaResumen k="Km inicial → final" v={`${km(viaje.kmInicial)} → ${km(Number(f.kilometraje))}`} />
                  <FilaResumen k="Recorridos" v={km(Number(f.kilometraje) - viaje.kmInicial)} />
                  <FilaResumen k="Combustible final" v={f.combustible} />
                  <FilaResumen k="Conductor" v={viaje.conductor} />
                </>
              )
            )}
            <FilaResumen k="Inicio" v={horaCR(f.iniciadaAt)} ultimo />
          </div>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Observaciones (opcional)
            <textarea
              rows={2}
              value={f.observaciones}
              onChange={(e) => set("observaciones", e.target.value)}
              className="resize-none rounded-[10px] border border-linea-fuerte px-3 py-2.5 text-sm font-normal outline-none focus:border-marca"
            />
          </label>

          <div id="campo-firmaConductor">
            <PanelFirma etiqueta="Firma del conductor" valor={f.firmaConductor} onCambio={(v) => set("firmaConductor", v)} error={errores.firmaConductor} />
          </div>

          {!esSalida && (
            <>
              <Campo id="supervisorId" etiqueta="Supervisor que recibe la unidad" error={errores.supervisorId}>
                <select id="supervisorId" value={f.supervisorId} onChange={(e) => set("supervisorId", e.target.value)} className={claseSelect(errores.supervisorId)}>
                  <option value="">Seleccione el supervisor</option>
                  {props.supervisores.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </Campo>
              <div id="campo-firmaSupervisor">
                <PanelFirma etiqueta="Firma del supervisor" valor={f.firmaSupervisor} onCambio={(v) => set("firmaSupervisor", v)} error={errores.firmaSupervisor} />
              </div>
              <p className="text-[13px] leading-relaxed text-tinta-suave">
                Al cerrar, se envía por correo el reporte del viaje completo (salida y retorno).
              </p>
            </>
          )}

          {esSalida && (
            <div id="campo-confirmado">
              <label className="flex min-h-11 items-start gap-2.5 text-[13px] leading-relaxed">
                <input
                  type="checkbox"
                  checked={f.confirmado}
                  onChange={(e) => set("confirmado", e.target.checked)}
                  className="mt-0.5 size-5 shrink-0 accent-marca"
                />
                Confirmo que realicé la inspección y que la información registrada es correcta.
              </label>
              {errores.confirmado && <p className="text-xs text-noapto">{errores.confirmado}</p>}
            </div>
          )}
        </div>
      )}

      <div className="flex-1" />
      <div className="sticky bottom-0 mt-6 flex flex-col gap-2 border-t border-linea bg-white px-5 pb-6 pt-4">
        {errorEnvio && (
          <p role="alert" className="rounded-lg bg-noapto-fondo px-3 py-2 text-[13px] text-noapto">{errorEnvio}</p>
        )}
        {ultimoPaso ? (
          <button
            type="button"
            onClick={enviar}
            disabled={enviando}
            className="h-[52px] rounded-xl bg-marca text-base font-semibold text-white transition-colors hover:bg-marca-oscuro disabled:opacity-60"
          >
            {enviando ? "Enviando…" : esSalida ? "Enviar inspección" : "Cerrar viaje y enviar reporte"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => validarPaso(f.paso) && irA(f.paso + 1)}
            className="h-[52px] rounded-xl bg-marca text-base font-semibold text-white transition-colors hover:bg-marca-oscuro"
          >
            Continuar a {pasos[f.paso + 1].toLowerCase()}
          </button>
        )}
        <span className="text-center text-xs text-tinta-suave">El borrador se guarda en este teléfono aunque no haya señal.</span>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------
const claseSelect = (error?: string) =>
  `h-12 w-full min-w-0 rounded-[10px] border bg-white px-3 text-[15px] text-tinta outline-none focus:border-marca ${error ? "border-falla" : "border-linea-fuerte"}`;

function Campo({ id, etiqueta, error, ayuda, children }: { id: string; etiqueta: string; error?: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <div id={`campo-${id}`} className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium">{etiqueta}</label>
      {children}
      {error ? <p className="text-xs text-noapto">{error}</p> : ayuda ? <p className="text-xs text-tinta-suave">{ayuda}</p> : null}
    </div>
  );
}

function EntradaKm({ valor, onCambio, error }: { valor: string; onCambio: (v: string) => void; error?: string }) {
  return (
    <div className={`flex h-12 items-center rounded-[10px] border px-3 focus-within:border-marca ${error ? "border-falla" : "border-linea-fuerte"}`}>
      <input
        id="kilometraje"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={valor}
        onChange={(e) => onCambio(e.target.value.replace(/[^\d]/g, ""))}
        className="min-w-0 flex-1 bg-transparent font-mono text-base outline-none"
      />
      <span className="text-[13px] text-tinta-suave">km</span>
    </div>
  );
}

function Dato({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-tinta-suave">{k}</span>
      <span className={`text-[13px] font-semibold ${mono ? "font-mono font-medium" : ""}`}>{v}</span>
    </div>
  );
}

function FilaResumen({ k, v, ultimo }: { k: string; v: string; ultimo?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-2.5 text-[13px] ${ultimo ? "" : "border-b border-[#EEF2F7]"}`}>
      <span className="text-tinta-suave">{k}</span>
      <span className="text-right font-semibold">{v}</span>
    </div>
  );
}

function Contador({ n, etiqueta, color }: { n: number; etiqueta: string; color: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-linea p-3">
      <span className={`text-[22px] font-semibold ${color}`}>{n}</span>
      <span className="text-xs text-tinta-suave">{etiqueta}</span>
    </div>
  );
}

function TarjetaResultado({ estado, tipo }: { estado: EstadoUnidad | null; tipo: TipoInspeccion }) {
  const textos: Record<EstadoUnidad, string> = {
    apto: tipo === "salida" ? "Inspección completa y sin fallas. La unidad puede salir a ruta." : "Sin hallazgos nuevos en el retorno.",
    requiere_correccion: "Hay un hallazgo menor. El supervisor debe evaluarlo, corregirlo o autorizarlo según el procedimiento de mantenimiento.",
    no_apto: "Falla crítica: la unidad quedará inmovilizada hasta que se registre su liberación. Se enviará una alerta por correo.",
  };
  const borde = estado === "no_apto" ? "border-[#F1C9C4] bg-[#FFF7F6]" : estado === "requiere_correccion" ? "border-[#F0D49A] bg-[#FFFBF2]" : "border-[#B9DDC7] bg-[#F6FBF8]";
  return (
    <div className={`flex flex-col gap-2 rounded-2xl border p-4 ${borde}`}>
      <span className="text-xs text-tinta-suave">Resultado de la inspección</span>
      <EstadoBadge estado={estado} className="self-start text-sm" />
      {estado && <p className="text-[13px] leading-relaxed">{textos[estado]}</p>}
    </div>
  );
}
