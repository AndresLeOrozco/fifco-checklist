# Guía de conexiones y puesta en producción

Paso a paso para crear y conectar cada plataforma externa que usa la app.
Todas tienen plan gratuito. Sigue el orden: cada paso usa datos del anterior.

| # | Plataforma | Para qué | ¿Obligatoria? |
|---|------------|----------|---------------|
| 1 | Supabase | Base de datos y fotos | Sí (ya configurada) |
| 2 | GitHub | Guardar el código y desplegar | Sí |
| 3 | Netlify | Publicar la app en internet | Sí, para usarla fuera de tu PC |
| 4 | Resend | Enviar los correos | Recomendada |
| 5 | GitHub Actions | Evitar que Supabase se pause | Recomendada |

> **Regla de oro de las llaves:** `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `REPORTES_PASSWORD` y
> `REPORTES_SESSION_SECRET` nunca se suben a GitHub ni se comparten por chat o correo. Viven solo en
> `.env.local` (tu PC) y en las variables de entorno de Netlify.

---

## 1. Supabase: aplicar la migración nueva

Ya creaste el proyecto y ejecutaste los scripts 01 a 04. Esta versión agrega uno más:

1. Entra a [supabase.com/dashboard](https://supabase.com/dashboard) y abre el proyecto.
2. Menú lateral → **SQL Editor** → **New query**.
3. Pega el contenido de `supabase/migrations/05_salida_no_apta_cancela_viaje.sql` y presiona **Run**.
   - Qué hace: cuando una inspección de salida resulta **No apto**, el viaje se cancela (el camión no sale).
4. Carga los datos iniciales (desde la app es más fácil, ver el paso 6):
   camiones, conductores y supervisores, rutas y destinatarios de correo.

**Comprobar:** `Table Editor` → tabla `viajes`: no debe haber viajes `en_ruta` cuya salida fue No apto.

---

## 2. GitHub: subir el código

Tu carpeta ya es un repositorio conectado a GitHub (`origin`).

1. Abre una terminal en la carpeta del proyecto.
2. Comprueba que `.env.local` **no** aparezca para subirse:
   ```bash
   git status
   ```
   Si aparece, detente: revisa que `.gitignore` tenga la línea `.env*.local`.
3. Sube los cambios:
   ```bash
   git add .
   git commit -m "Formularios, reportes, correos y guía de conexiones"
   git push
   ```

---

## 3. Netlify: publicar la app

Netlify detecta Next.js automáticamente y permite uso comercial en su plan gratuito.

### 3.1 Crear la cuenta y el sitio
1. Entra a [app.netlify.com/signup](https://app.netlify.com/signup) y regístrate **con GitHub**.
2. **Add new project** → **Import an existing project** → **GitHub**.
3. Autoriza a Netlify y elige el repositorio `fifco-checklist`.
4. En la configuración de build deja lo que Netlify detecta:
   - Branch to deploy: `main`
   - Build command: `npm run build`
   - Publish directory: `.next`
5. **Antes de desplegar**, abre **Add environment variables** (o hazlo en el paso 3.2).

### 3.2 Cargar las variables de entorno
En el sitio: **Site configuration** → **Environment variables** → **Add a variable** → **Add a single variable**.
Crea una por una, con los mismos valores de tu `.env.local`:

| Variable | Valor |
|----------|-------|
| `SUPABASE_URL` | URL del proyecto de Supabase |
| `SUPABASE_SECRET_KEY` | Secret key `sb_secret_…` (marca **Contains secret values**) |
| `REPORTES_PASSWORD` | La contraseña de reportes (marca **Contains secret values**) |
| `REPORTES_SESSION_SECRET` | La cadena aleatoria (marca **Contains secret values**) |
| `RESEND_API_KEY` | Cuando la tengas (paso 4) |
| `CORREO_REMITENTE` | Cuando tengas el dominio (paso 4) |
| `APP_URL` | La URL del sitio, p. ej. `https://fifco-checklist.netlify.app` (la ves al terminar el primer deploy) |

### 3.3 Desplegar
1. **Deploys** → **Trigger deploy** → **Deploy site**. Tarda 2–4 minutos.
2. Al terminar, abre la URL `https://<nombre>.netlify.app`.
3. Para un nombre más claro: **Site configuration** → **Change site name** (p. ej. `fifco-checklist`).
4. Si cambiaste el nombre, actualiza `APP_URL` y vuelve a desplegar.

**Comprobar:** abre `https://<tu-sitio>/api/salud` → debe responder `{"ok":true,...}`.

### 3.4 Cuidado con el límite del plan gratuito
El plan Free da **300 créditos al mes** y **cada deploy de producción cuesta 15**: unos **20 deploys mensuales**.
Si se agotan, el sitio se pausa hasta el mes siguiente. Para no gastarlos:
- Haz `git push` a `main` solo cuando el cambio esté listo (cada push despliega).
- Prueba localmente con `npm run dev` antes de subir.
- Si necesitas, en **Site configuration** → **Build & deploy** → **Continuous deployment** puedes
  detener los builds automáticos (**Stop builds**) y desplegar a mano con **Trigger deploy**.

### 3.5 Instalar en los celulares de los conductores
1. Abre la URL del sitio en el celular (Chrome en Android, Safari en iPhone).
2. Android: menú ⋮ → **Agregar a la pantalla principal**. iPhone: botón Compartir → **Agregar a inicio**.
3. Queda como un ícono más; se abre sin barra del navegador.

---

## 4. Resend: envío de correos

### 4.1 Crear la cuenta
1. Entra a [resend.com/signup](https://resend.com/signup) y crea la cuenta (de preferencia con un correo de la empresa).

### 4.2 Verificar un dominio (indispensable para enviar a otros)
Sin dominio verificado, Resend solo deja enviar desde su remitente de prueba y **únicamente a tu propio correo**.
Para enviar a los supervisores necesitas un dominio propio:

1. En Resend: **Domains** → **Add Domain**.
2. Escribe un **subdominio** para envíos, p. ej. `send.tudominio.com` (Resend recomienda subdominios para
   proteger la reputación del dominio principal). Elige la región más cercana (`us-east-1`).
3. Resend te muestra unos registros DNS (normalmente un **MX** y un **TXT** de SPF, y un **TXT** de DKIM
   con nombre `resend._domainkey`). Cópialos tal cual.
4. Agrégalos donde se administra el DNS del dominio:
   - Si es un dominio de FIFCO: envíale los registros al equipo de TI y pídeles que los creen.
   - Si es un dominio tuyo (Cloudflare, Namecheap, GoDaddy…): crea cada registro en su panel de DNS.
5. Vuelve a Resend y presiona **Verify DNS Records**. Puede tardar de minutos a unas horas.
   El dominio debe quedar en estado **Verified**.

### 4.3 Crear la API key
1. **API Keys** → **Create API Key**.
2. Nombre: `fifco-checklist-produccion`. Permiso: **Sending access**. Dominio: el que verificaste.
3. Copia la llave (`re_…`). **Solo se muestra una vez.**

### 4.4 Conectar con la app
1. En `.env.local` (tu PC) y en Netlify (paso 3.2):
   ```
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
   CORREO_REMITENTE=Checklist de flota <reportes@send.tudominio.com>
   ```
   El correo del remitente debe pertenecer al dominio verificado.
2. En Netlify, vuelve a desplegar para que tome las variables nuevas (**Deploys** → **Trigger deploy**).
3. En la app: **Reportes** → **Catálogos** → **Destinatarios de correo** → agrega los correos que deben
   recibir los reportes de viaje y las alertas de unidad No apta.

**Comprobar:** abre el detalle de un viaje cerrado → **Reenviar correo**. Al final de la página, en
**Correos enviados**, debe aparecer "Enviado a N". Si dice "No enviado", ahí mismo se ve el motivo.

**Límite gratuito:** 100 correos por día (3 000 al mes). Cada destinatario cuenta como un correo.

---

## 5. GitHub Actions: evitar que Supabase se pause

Los proyectos gratuitos de Supabase se pausan tras 7 días sin actividad (por ejemplo, en vacaciones).
El repositorio incluye `.github/workflows/mantener-activo.yml`, que visita la app una vez al día.

1. En GitHub, abre el repositorio → **Settings** → **Secrets and variables** → **Actions**.
2. Pestaña **Variables** → **New repository variable**.
   - Name: `APP_URL`
   - Value: la URL de Netlify, p. ej. `https://fifco-checklist.netlify.app`
3. Pestaña **Actions** del repositorio → **Mantener activo Supabase** → **Run workflow** para probarlo.
   Debe terminar en verde.

A partir de ahí corre solo todos los días a las 5:17 a. m. (hora de Costa Rica).

---

## 6. Carga inicial de datos (desde la app)

1. Abre `https://<tu-sitio>/reportes` e ingresa la contraseña de reportes.
2. **Catálogos**:
   - **Camiones:** número de unidad, placa, tipo (seco o refrigerado) y kilometraje actual.
   - **Conductores y supervisores:** código de empleado, nombre y rol.
   - **Rutas:** código y descripción.
   - **Destinatarios de correo:** quién recibe reportes y alertas.
3. Para muchos registros a la vez: en Supabase → **Table Editor** → tabla → **Insert** → **Import data from CSV**.

---

## Resumen de variables de entorno

| Variable | Obligatoria | Dónde se obtiene |
|----------|-------------|------------------|
| `SUPABASE_URL` | Sí | Supabase → Project Settings → API Keys |
| `SUPABASE_SECRET_KEY` | Sí | Supabase → Project Settings → API Keys → Secret key |
| `REPORTES_PASSWORD` | Sí | La defines tú |
| `REPORTES_SESSION_SECRET` | Sí | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `RESEND_API_KEY` | No* | Resend → API Keys |
| `CORREO_REMITENTE` | No* | Un correo de tu dominio verificado en Resend |
| `APP_URL` | Recomendada | La URL pública de Netlify |

\* Sin ellas no se envían correos, pero la app funciona.

## Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| "Configuración incompleta" al abrir la app | Falta una variable de entorno | Revisa `.env.local` o las variables de Netlify y vuelve a desplegar |
| La app tarda mucho la primera vez del día | Supabase estaba pausado | Configura el paso 5 |
| "No enviado: … domain is not verified" | Dominio sin verificar en Resend | Termina el paso 4.2 |
| "No enviado: No hay destinatarios activos" | No hay destinatarios en el catálogo | Agrégalos en Catálogos → Destinatarios |
| La foto no sube en el patio | Sin señal | El borrador se guarda; reintenta cuando haya señal |
| El sitio muestra "Site not available" | Se agotaron los créditos de Netlify | Espera al nuevo ciclo o reduce los deploys (paso 3.4) |
