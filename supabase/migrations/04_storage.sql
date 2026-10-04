-- =====================================================================
-- Checklist de camiones FIFCO · Fase 1
-- 04 · Storage: bucket privado para fotografías de hallazgos y firmas
--
-- Privado y sin políticas: solo el servidor (secret key) sube archivos y
-- genera URLs firmadas temporales para mostrarlos en reportes y correos.
-- Límite de 2 MB por archivo: las fotos se comprimen en el navegador.
--
-- Estructura sugerida de rutas:
--   hallazgos/<inspeccion_id>/<respuesta_id>/<uuid>.webp
--   firmas/<inspeccion_id>/<tipo>.png
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inspecciones',
  'inspecciones',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
);
