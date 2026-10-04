import Link from "next/link";
import { notFound } from "next/navigation";
import { FranjaMarca } from "@/components/marca";

// Pantallas 2–7 (formulario de salida y retorno).
// Se construyen en el siguiente paso; esta ruta ya existe para que la
// navegación desde Inicio funcione.
export default async function InspeccionPage({ params }: PageProps<"/inspeccion/[tipo]">) {
  const { tipo } = await params;
  if (tipo !== "salida" && tipo !== "retorno") notFound();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <FranjaMarca />
      <div className="flex flex-col gap-3 px-5 py-8">
        <Link href="/" className="text-sm font-medium text-marca">‹ Inicio</Link>
        <p className="text-sm font-semibold text-marca">Inspección de {tipo}</p>
        <h1 className="text-2xl font-semibold">Formulario en construcción</h1>
        <p className="text-sm leading-relaxed text-tinta-suave">
          El checklist de {tipo} se implementa en el siguiente paso del proyecto.
        </p>
      </div>
    </main>
  );
}
