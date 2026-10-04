// Compresión de fotos en el navegador antes de subirlas (código del cliente).
// Una foto de celular de 3–6 MB queda en ~150–300 KB, suficiente para evidenciar un hallazgo.

const LADO_MAX = 1600;
const CALIDAD = 0.72;

async function cargar(archivo: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(archivo, { imageOrientation: "from-image" });
    } catch {
      /* algunos navegadores no aceptan opciones: se usa <img> */
    }
  }
  const url = URL.createObjectURL(archivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function aBlob(canvas: HTMLCanvasElement, tipo: string, calidad: number): Promise<Blob | null> {
  return new Promise((ok) => canvas.toBlob(ok, tipo, calidad));
}

export async function comprimirFoto(archivo: File): Promise<{ archivo: File; miniatura: string }> {
  const img = await cargar(archivo);
  const ancho = "naturalWidth" in img ? img.naturalWidth : img.width;
  const alto = "naturalHeight" in img ? img.naturalHeight : img.height;
  const escala = Math.min(1, LADO_MAX / Math.max(ancho, alto));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(ancho * escala);
  canvas.height = Math.round(alto * escala);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);

  // WebP si el navegador sabe generarlo; si no (Safari antiguo), JPEG.
  let blob = await aBlob(canvas, "image/webp", CALIDAD);
  if (!blob || blob.type !== "image/webp") blob = await aBlob(canvas, "image/jpeg", CALIDAD);
  if (!blob) throw new Error("No se pudo procesar la fotografía.");

  const mini = document.createElement("canvas");
  const em = 200 / Math.max(canvas.width, canvas.height);
  mini.width = Math.round(canvas.width * em);
  mini.height = Math.round(canvas.height * em);
  mini.getContext("2d")!.drawImage(canvas, 0, 0, mini.width, mini.height);

  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  return {
    archivo: new File([blob], `foto.${ext}`, { type: blob.type }),
    miniatura: mini.toDataURL("image/jpeg", 0.6),
  };
}

export async function dataUrlABlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}
