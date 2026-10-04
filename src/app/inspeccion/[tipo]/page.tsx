import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { camionesActivos, personalActivo, puntosChecklist, rutasActivas, viajesAbiertos } from "@/lib/data/catalogos";
import { FormularioInspeccion } from "./formulario";

export async function generateMetadata({ params }: PageProps<"/inspeccion/[tipo]">): Promise<Metadata> {
  const { tipo } = await params;
  return { title: tipo === "retorno" ? "Inspección de retorno" : "Inspección de salida" };
}

// Pantallas 2–4 (salida) y 6–7 (retorno)
export default async function InspeccionPage({ params }: PageProps<"/inspeccion/[tipo]">) {
  const { tipo } = await params;
  if (tipo !== "salida" && tipo !== "retorno") notFound();
  await connection();

  const [puntos, personal, camiones, rutas, viajes] = await Promise.all([
    puntosChecklist(tipo),
    personalActivo(),
    tipo === "salida" ? camionesActivos() : Promise.resolve([]),
    tipo === "salida" ? rutasActivas() : Promise.resolve([]),
    tipo === "retorno" ? viajesAbiertos() : Promise.resolve([]),
  ]);

  return (
    <FormularioInspeccion
      tipo={tipo}
      puntos={puntos.map(({ id, orden, titulo, descripcion, critico, critico_si_refrigerado }) => ({
        id, orden, titulo, descripcion, critico, critico_si_refrigerado,
      }))}
      camiones={camiones.map(({ id, numero_unidad, placa, tipo: t, estado_actual, ultimo_km, en_ruta }) => ({
        id, numero_unidad, placa, tipo: t, estado_actual, ultimo_km, en_ruta,
      }))}
      conductores={personal.conductores.map(({ id, nombre, codigo_empleado }) => ({ id, nombre, codigo_empleado }))}
      supervisores={personal.supervisores.map(({ id, nombre, codigo_empleado }) => ({ id, nombre, codigo_empleado }))}
      rutas={rutas.map(({ id, codigo, descripcion }) => ({ id, codigo, descripcion }))}
      viajes={viajes}
    />
  );
}
