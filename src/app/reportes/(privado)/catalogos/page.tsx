import type { Metadata } from "next";
import Link from "next/link";
import { EstadoBadge } from "@/components/estado-badge";
import { db } from "@/lib/supabase/server";
import { exigirSesionReportes } from "@/lib/reportes/guardia";
import { formatoKm } from "@/lib/formato";
import { cambiarActivo, guardarCamion, guardarDestinatario, guardarPersona, guardarRuta } from "./acciones";
import { FormularioCatalogo, type CampoDef } from "./formulario";

export const metadata: Metadata = { title: "Catálogos" };

const PESTANAS = [
  { id: "camiones", texto: "Camiones" },
  { id: "personal", texto: "Conductores y supervisores" },
  { id: "rutas", texto: "Rutas" },
  { id: "destinatarios", texto: "Destinatarios de correo" },
] as const;
type Pestana = (typeof PESTANAS)[number]["id"];

function BotonActivo({ tabla, id, activo }: { tabla: string; id: string; activo: boolean }) {
  return (
    <form action={cambiarActivo}>
      <input type="hidden" name="tabla" value={tabla} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="activo" value={String(!activo)} />
      <button
        type="submit"
        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${activo ? "bg-apto-fondo text-apto" : "bg-[#F1F3F6] text-tinta-suave"}`}
        title={activo ? "Desactivar" : "Activar"}
      >
        {activo ? "Activo" : "Inactivo"}
      </button>
    </form>
  );
}

function Editar({ children }: { children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-[13px] font-semibold text-marca [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">Editar</span>
        <span className="hidden group-open:inline">Cerrar</span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5 rounded-2xl border border-linea p-5">
      <h2 className="text-[15px] font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

const Fila = ({ children }: { children: React.ReactNode }) => (
  <li className="flex flex-col gap-2 border-t border-[#EEF2F7] px-5 py-3.5 first:border-t-0">{children}</li>
);

// Pantalla 12 · Catálogos
export default async function CatalogosPage({ searchParams }: PageProps<"/reportes/catalogos">) {
  await exigirSesionReportes();
  const sp = await searchParams;
  const tab: Pestana = PESTANAS.find((p) => p.id === sp.tab)?.id ?? "camiones";

  return (
    <>
      <div>
        <p className="text-[13px] text-tinta-suave">Datos que alimentan los formularios</p>
        <h1 className="mt-1 text-[26px] font-semibold">Catálogos</h1>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-linea" aria-label="Catálogos">
        {PESTANAS.map((p) => (
          <Link
            key={p.id}
            href={`/reportes/catalogos?tab=${p.id}`}
            aria-current={tab === p.id ? "page" : undefined}
            className={`-mb-px flex h-11 items-center border-b-2 px-4 text-sm ${tab === p.id ? "border-marca font-semibold text-marca" : "border-transparent font-medium text-tinta-suave hover:text-tinta"}`}
          >
            {p.texto}
          </Link>
        ))}
      </nav>

      {tab === "camiones" && <Camiones />}
      {tab === "personal" && <Personal />}
      {tab === "rutas" && <Rutas />}
      {tab === "destinatarios" && <Destinatarios />}
    </>
  );
}

const TIPOS_UNIDAD = [{ valor: "seco", texto: "Seco" }, { valor: "refrigerado", texto: "Refrigerado" }];
const ROLES = [{ valor: "conductor", texto: "Conductor" }, { valor: "supervisor", texto: "Supervisor" }];

async function Camiones() {
  const { data } = await db().from("camiones").select("*").order("activo", { ascending: false }).order("numero_unidad");
  const campos = (c?: NonNullable<typeof data>[number]): CampoDef[] => [
    { tipo: "texto", nombre: "numero_unidad", etiqueta: "Número de unidad", requerido: true, valor: c?.numero_unidad },
    { tipo: "texto", nombre: "placa", etiqueta: "Placa", requerido: true, valor: c?.placa, mono: true },
    { tipo: "select", nombre: "tipo", etiqueta: "Tipo", opciones: TIPOS_UNIDAD, valor: c?.tipo },
    ...(c ? [] : [{ tipo: "numero", nombre: "ultimo_km", etiqueta: "Kilometraje actual (opcional)" } as CampoDef]),
  ];
  return (
    <>
      <Tarjeta titulo="Agregar camión">
        <FormularioCatalogo accion={guardarCamion} campos={campos()} textoBoton="Agregar" />
      </Tarjeta>
      <ul className="rounded-2xl border border-linea">
        {(data ?? []).length === 0 && <li className="px-5 py-6 text-[13px] text-tinta-suave">Aún no hay camiones registrados.</li>}
        {(data ?? []).map((c) => (
          <Fila key={c.id}>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
              <span className="w-24 font-semibold">Unidad {c.numero_unidad}</span>
              <span className="w-28 font-mono text-xs">{c.placa}</span>
              <span className="w-24">{c.tipo === "refrigerado" ? "Refrigerado" : "Seco"}</span>
              <EstadoBadge estado={c.estado_actual} />
              <span className="font-mono text-xs text-tinta-suave">{formatoKm(c.ultimo_km)}</span>
              <span className="flex-1" />
              <BotonActivo tabla="camiones" id={c.id} activo={c.activo} />
            </div>
            <Editar><FormularioCatalogo accion={guardarCamion} campos={campos(c)} id={c.id} textoBoton="Guardar" /></Editar>
          </Fila>
        ))}
      </ul>
      <p className="text-xs text-tinta-suave">El estado de la unidad lo calculan las inspecciones y solo vuelve a Apto con una liberación desde el detalle del viaje.</p>
    </>
  );
}

async function Personal() {
  const { data } = await db().from("personal").select("*").order("activo", { ascending: false }).order("rol").order("nombre");
  const campos = (p?: NonNullable<typeof data>[number]): CampoDef[] => [
    { tipo: "texto", nombre: "codigo_empleado", etiqueta: "Código de empleado", requerido: true, valor: p?.codigo_empleado, mono: true },
    { tipo: "texto", nombre: "nombre", etiqueta: "Nombre completo", requerido: true, valor: p?.nombre },
    { tipo: "select", nombre: "rol", etiqueta: "Rol", opciones: ROLES, valor: p?.rol },
    { tipo: "email", nombre: "email", etiqueta: "Correo (opcional)", valor: p?.email },
  ];
  return (
    <>
      <Tarjeta titulo="Agregar persona">
        <FormularioCatalogo accion={guardarPersona} campos={campos()} textoBoton="Agregar" />
      </Tarjeta>
      <ul className="rounded-2xl border border-linea">
        {(data ?? []).length === 0 && <li className="px-5 py-6 text-[13px] text-tinta-suave">Aún no hay personal registrado.</li>}
        {(data ?? []).map((p) => (
          <Fila key={p.id}>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
              <span className="w-20 font-mono text-xs">{p.codigo_empleado}</span>
              <span className="min-w-48 font-semibold">{p.nombre}</span>
              <span className="w-24">{p.rol === "conductor" ? "Conductor" : "Supervisor"}</span>
              <span className="text-tinta-suave">{p.email}</span>
              <span className="flex-1" />
              <BotonActivo tabla="personal" id={p.id} activo={p.activo} />
            </div>
            <Editar><FormularioCatalogo accion={guardarPersona} campos={campos(p)} id={p.id} textoBoton="Guardar" /></Editar>
          </Fila>
        ))}
      </ul>
    </>
  );
}

async function Rutas() {
  const { data } = await db().from("rutas").select("*").order("activo", { ascending: false }).order("codigo");
  const campos = (r?: NonNullable<typeof data>[number]): CampoDef[] => [
    { tipo: "texto", nombre: "codigo", etiqueta: "Código", requerido: true, valor: r?.codigo },
    { tipo: "texto", nombre: "descripcion", etiqueta: "Descripción", requerido: true, valor: r?.descripcion },
    { tipo: "texto", nombre: "zona", etiqueta: "Zona (opcional)", valor: r?.zona },
  ];
  return (
    <>
      <Tarjeta titulo="Agregar ruta">
        <FormularioCatalogo accion={guardarRuta} campos={campos()} textoBoton="Agregar" />
      </Tarjeta>
      <ul className="rounded-2xl border border-linea">
        {(data ?? []).length === 0 && <li className="px-5 py-6 text-[13px] text-tinta-suave">Aún no hay rutas registradas.</li>}
        {(data ?? []).map((r) => (
          <Fila key={r.id}>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
              <span className="w-16 font-semibold">{r.codigo}</span>
              <span className="min-w-48">{r.descripcion}</span>
              <span className="text-tinta-suave">{r.zona}</span>
              <span className="flex-1" />
              <BotonActivo tabla="rutas" id={r.id} activo={r.activo} />
            </div>
            <Editar><FormularioCatalogo accion={guardarRuta} campos={campos(r)} id={r.id} textoBoton="Guardar" /></Editar>
          </Fila>
        ))}
      </ul>
    </>
  );
}

async function Destinatarios() {
  const { data } = await db().from("destinatarios_correo").select("*").order("activo", { ascending: false }).order("email");
  const campos = (d?: NonNullable<typeof data>[number]): CampoDef[] => [
    { tipo: "email", nombre: "email", etiqueta: "Correo", requerido: true, valor: d?.email },
    { tipo: "texto", nombre: "nombre", etiqueta: "Nombre (opcional)", valor: d?.nombre },
    { tipo: "casilla", nombre: "recibe_reportes", etiqueta: "Reportes de viaje", valor: d?.recibe_reportes ?? true },
    { tipo: "casilla", nombre: "recibe_alertas", etiqueta: "Alertas No apto", valor: d?.recibe_alertas ?? true },
  ];
  const configurado = Boolean(process.env.RESEND_API_KEY && process.env.CORREO_REMITENTE);
  return (
    <>
      {!configurado && (
        <p className="rounded-xl border border-[#F0D49A] bg-[#FFFBF2] px-4 py-3 text-[13px] leading-relaxed">
          El envío de correos aún no está configurado: faltan <code className="font-mono">RESEND_API_KEY</code> y <code className="font-mono">CORREO_REMITENTE</code>. Las inspecciones se registran igual, y cada intento queda en la bitácora del viaje.
        </p>
      )}
      <Tarjeta titulo="Agregar destinatario">
        <FormularioCatalogo accion={guardarDestinatario} campos={campos()} textoBoton="Agregar" />
      </Tarjeta>
      <ul className="rounded-2xl border border-linea">
        {(data ?? []).length === 0 && <li className="px-5 py-6 text-[13px] text-tinta-suave">Aún no hay destinatarios: los correos no se enviarán a nadie.</li>}
        {(data ?? []).map((d) => (
          <Fila key={d.id}>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
              <span className="min-w-56 font-semibold">{d.email}</span>
              <span className="text-tinta-suave">{d.nombre}</span>
              <span className="text-tinta-suave">{[d.recibe_reportes && "Reportes", d.recibe_alertas && "Alertas"].filter(Boolean).join(" · ") || "Ninguno"}</span>
              <span className="flex-1" />
              <BotonActivo tabla="destinatarios_correo" id={d.id} activo={d.activo} />
            </div>
            <Editar><FormularioCatalogo accion={guardarDestinatario} campos={campos(d)} id={d.id} textoBoton="Guardar" /></Editar>
          </Fila>
        ))}
      </ul>
      <p className="text-xs text-tinta-suave">Plan gratuito de Resend: 100 correos por día. Cada destinatario cuenta como un correo.</p>
    </>
  );
}
