"use client";

import { useEffect, useRef, useState } from "react";

// Panel para firmar con el dedo o el mouse. Devuelve la firma como PNG (data URL).
export function PanelFirma({
  etiqueta,
  valor,
  onCambio,
  error,
}: {
  etiqueta: string;
  valor: string | null;
  onCambio: (dataUrl: string | null) => void;
  error?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const ultimo = useRef<{ x: number; y: number } | null>(null);
  const [vacio, setVacio] = useState(!valor);
  const tieneTrazos = useRef(Boolean(valor));
  const id = etiqueta.toLowerCase().replace(/\W+/g, "-");

  // Ajusta la resolución a la pantalla y repinta la firma guardada (p. ej. al recuperar un borrador).
  useEffect(() => {
    const c = canvasRef.current!;
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = c.getBoundingClientRect();
    c.width = Math.round(width * ratio);
    c.height = Math.round(height * ratio);
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0F2A44";
    if (valor) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, width, height);
      img.src = valor;
    }
    // Solo al montar: la firma luego vive en el canvas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function punto(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function inicio(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dibujando.current = true;
    ultimo.current = punto(e);
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current || !ultimo.current) return;
    const ctx = e.currentTarget.getContext("2d")!;
    const p = punto(e);
    ctx.beginPath();
    ctx.moveTo(ultimo.current.x, ultimo.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ultimo.current = p;
    if (!tieneTrazos.current) {
      tieneTrazos.current = true;
      setVacio(false);
    }
  }

  function fin() {
    if (!dibujando.current) return;
    dibujando.current = false;
    ultimo.current = null;
    onCambio(tieneTrazos.current ? canvasRef.current!.toDataURL("image/png") : null);
  }

  function limpiar() {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    tieneTrazos.current = false;
    setVacio(true);
    onCambio(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span id={`${id}-label`} className="text-[13px] font-medium">{etiqueta}</span>
        <button type="button" onClick={limpiar} className="min-h-11 px-1 text-[13px] font-semibold text-marca">
          Limpiar
        </button>
      </div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          role="img"
          aria-labelledby={`${id}-label`}
          className={`h-36 w-full touch-none rounded-xl border border-dashed bg-[#FBFDFF] ${error ? "border-falla" : "border-acero"}`}
          onPointerDown={inicio}
          onPointerMove={mover}
          onPointerUp={fin}
          onPointerCancel={fin}
          onPointerLeave={fin}
        />
        {vacio && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-medium text-acero-oscuro">
            Firme aquí con el dedo
          </span>
        )}
      </div>
      {error && <p className="text-xs text-noapto">{error}</p>}
    </div>
  );
}
