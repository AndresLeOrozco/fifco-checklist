"use client";

// Pantalla de error general (por ejemplo, si falta configurar .env.local
// o Supabase no responde). El detalle técnico queda en la consola del servidor.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-5 py-12">
      <h1 className="text-2xl font-semibold">No se pudo cargar la información</h1>
      <p className="text-sm leading-relaxed text-tinta-suave">
        Revise la conexión a internet e intente de nuevo. Si el problema continúa, avise al encargado de la aplicación.
      </p>
      <button
        type="button"
        onClick={reset}
        className="h-12 rounded-xl bg-marca font-semibold text-white hover:bg-marca-oscuro"
      >
        Intentar de nuevo
      </button>
    </main>
  );
}
