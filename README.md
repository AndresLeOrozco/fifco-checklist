# fifco-checklist

Aplicación web para la inspección de salida y retorno de los camiones de reparto de FIFCO.
Los conductores llenan el checklist desde el celular, y los supervisores consultan los reportes.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Postgres + Storage) · Resend (correo) · Netlify (hosting)

> **Configurar plataformas externas y publicar:** ver [`docs/CONEXIONES.md`](docs/CONEXIONES.md).

## Requisitos

- Node.js 20.9 o superior (recomendado: 22 LTS)
- Proyecto de Supabase con las migraciones de `supabase/migrations/` ejecutadas en orden (01 → 05)

## Puesta en marcha

```bash
npm install
copy .env.example .env.local   # en macOS/Linux: cp .env.example .env.local
npm run dev
```

Completa `.env.local` con los valores de tu proyecto y abre http://localhost:3000.

| Variable | Dónde se obtiene |
| --- | --- |
| `SUPABASE_URL` | Supabase › Project Settings › API Keys › Project URL |
| `SUPABASE_SECRET_KEY` | Misma pantalla, **Secret key** (`sb_secret_…`). Solo va en el servidor. |
| `REPORTES_PASSWORD` | Contraseña compartida que defines para la sección de reportes |
| `REPORTES_SESSION_SECRET` | Cadena aleatoria. Puedes generarla con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `RESEND_API_KEY` | Resend › API Keys (opcional: sin ella no se envían correos) |
| `CORREO_REMITENTE` | Correo de un dominio verificado en Resend, p. ej. `Checklist de flota <reportes@send.tudominio.com>` |
| `APP_URL` | URL pública de la app, para los enlaces de los correos |

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm start` | Sirve la compilación de producción |
| `npm run lint` | ESLint |

## Estructura

```
supabase/migrations/        Esquema SQL (tablas, reglas de negocio, datos del checklist, storage)
docs/CONEXIONES.md          Paso a paso de Supabase, GitHub, Netlify, Resend y GitHub Actions
.github/workflows/          Ping diario para que Supabase gratuito no se pause
src/
  proxy.ts                  Protege /reportes con la contraseña compartida (en Next 16, "middleware" se llama "proxy")
  app/
    page.tsx                Inicio del conductor
    inspeccion/[tipo]/      Formularios de salida y retorno (borrador local, fotos, firmas)
    inspeccion/enviada/     Confirmación con el resultado
    inspeccion/acciones.ts  Subida de fotos y envío de la inspección
    reportes/acceso/        Ingreso a reportes
    reportes/(privado)/     Panel, listado con filtros, detalle del viaje, liberación y catálogos
    reportes/exportar/      Exportación a CSV para Excel
    api/salud/              Chequeo de salud (usado por el workflow diario)
  components/               Componentes de interfaz compartidos
  lib/
    env.ts                  Validación de variables de entorno
    supabase/server.ts      Cliente de Supabase (solo servidor, con la secret key)
    supabase/database.types.ts  Tipos de la base de datos
    data/                   Consultas a la base (única capa que habla con Supabase)
    correo/                 Plantillas y envío de correos con Resend, con bitácora
    imagen.ts               Compresión de fotos en el teléfono antes de subirlas
    reportes/               Sesión firmada de la sección de reportes
```

## Seguridad (fase 1)

- **Navegador y base de datos:** el navegador nunca se conecta directamente a Supabase. Todas las lecturas y escrituras pasan por el servidor de Next.js con la secret key.
- **RLS:** está activo en todas las tablas y no tiene políticas, así que la llave pública no tiene acceso a nada.
- **Reportes:** se protegen con una contraseña compartida y una cookie `httpOnly` firmada con HMAC. Se verifican en `proxy.ts` y de nuevo en el servidor antes de leer datos.
- **Fase 2 (autenticación):** se agregarán políticas RLS por rol y se usará la columna `personal.user_id`.

## Flujo de una inspección

1. **Inicio:** el conductor elige salida o retorno. El formulario se guarda como borrador en el teléfono mientras lo llena.
2. **Fotos:** cada foto de un hallazgo se comprime en el teléfono (~200 KB) y se sube apenas se toma.
3. **Envío:** el servidor crea el viaje y la inspección, guarda las respuestas y las firmas, y llama a
   `finalizar_inspeccion`, que valida todo y calcula el resultado. Si algo falla a mitad de camino, se deshace lo creado.
4. **Resultados:**
   - Una salida **No apto** cancela el viaje e inmoviliza la unidad hasta que se registre su liberación.
   - Un retorno cierra el viaje.
5. **Correos:** se envían después de responderle al conductor, para que no tenga que esperar:
   - Alerta inmediata si el resultado es No apto.
   - Reporte del viaje completo cuando se cierra el retorno.
   - Cada intento queda en `notificaciones_correo` y se ve en el detalle del viaje.
