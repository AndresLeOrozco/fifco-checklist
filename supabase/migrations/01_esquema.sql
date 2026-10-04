-- =====================================================================
-- Checklist de camiones FIFCO · Fase 1
-- 01 · Esquema: tipos, tablas, índices y seguridad (RLS)
--
-- Ejecutar en Supabase > SQL Editor, en orden: 01 → 02 → 03 → 04.
-- Fase 1 no tiene autenticación: la app accede SOLO desde el servidor
-- (Next.js) con la secret key. RLS queda activo y sin políticas, así la
-- publishable key no puede leer ni escribir nada.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Tipos enumerados
-- El orden de estado_unidad importa: apto < requiere_correccion < no_apto
-- (se usa para quedarse siempre con el estado más grave).
-- ---------------------------------------------------------------------
create type public.tipo_inspeccion     as enum ('salida', 'retorno');
create type public.resultado_item      as enum ('ok', 'falla', 'na');
create type public.estado_unidad       as enum ('apto', 'requiere_correccion', 'no_apto');
create type public.tipo_unidad         as enum ('refrigerado', 'seco');
create type public.rol_personal        as enum ('conductor', 'supervisor');
create type public.estado_viaje        as enum ('en_ruta', 'cerrado', 'cancelado');
create type public.tipo_firma          as enum ('conductor', 'supervisor');
create type public.decision_liberacion as enum ('autorizada_hallazgo_menor', 'corregida_liberada');


-- ---------------------------------------------------------------------
-- Secuencias para folios legibles (VIA-261004-00001, SAL-…, RET-…)
-- ---------------------------------------------------------------------
create sequence public.viaje_folio_seq;
create sequence public.inspeccion_folio_seq;


-- ---------------------------------------------------------------------
-- Catálogos
-- ---------------------------------------------------------------------
create table public.camiones (
  id             uuid primary key default gen_random_uuid(),
  numero_unidad  text not null unique,
  placa          text not null unique,
  tipo           public.tipo_unidad   not null default 'seco',
  estado_actual  public.estado_unidad not null default 'apto',
  ultimo_km      integer check (ultimo_km >= 0),
  activo         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table  public.camiones is 'Unidades de la flota.';
comment on column public.camiones.estado_actual is 'Estado vigente. Solo baja a apto mediante una liberación.';

-- Conductores y supervisores (sin cuentas de usuario en fase 1)
create table public.personal (
  id               uuid primary key default gen_random_uuid(),
  codigo_empleado  text not null unique,
  nombre           text not null,
  rol              public.rol_personal not null,
  email            text,
  activo           boolean not null default true,
  user_id          uuid unique,  -- fase 2: enlace con auth.users
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on column public.personal.user_id is 'Reservado para fase 2 (autenticación).';

create table public.rutas (
  id           uuid primary key default gen_random_uuid(),
  codigo       text not null unique,
  descripcion  text not null,
  zona         text,
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Puntos del checklist como datos (cambiar un punto no requiere programar)
create table public.checklist_items (
  id                      uuid primary key default gen_random_uuid(),
  tipo                    public.tipo_inspeccion not null,
  orden                   smallint not null check (orden between 1 and 50),
  titulo                  text not null,
  descripcion             text not null,
  critico                 boolean not null default false,
  critico_si_refrigerado  boolean not null default false,
  activo                  boolean not null default true,
  created_at              timestamptz not null default now(),
  unique (tipo, orden)
);
comment on column public.checklist_items.critico_si_refrigerado is 'Crítico solo cuando la unidad es refrigerada (p. ej. sistema de refrigeración).';


-- ---------------------------------------------------------------------
-- Operación
-- ---------------------------------------------------------------------
-- Un viaje une la inspección de salida con la de retorno
create table public.viajes (
  id             uuid primary key default gen_random_uuid(),
  folio          text not null unique default (
                   'VIA-' || to_char(now() at time zone 'America/Costa_Rica', 'YYMMDD')
                   || '-' || lpad(nextval('public.viaje_folio_seq')::text, 5, '0')),
  camion_id      uuid not null references public.camiones (id),
  conductor_id   uuid not null references public.personal (id),
  ruta_id        uuid not null references public.rutas (id),
  estado         public.estado_viaje not null default 'en_ruta',
  km_inicial     integer not null check (km_inicial >= 0),
  km_final       integer,
  km_recorridos  integer generated always as (km_final - km_inicial) stored,
  salida_at      timestamptz not null default now(),
  retorno_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (km_final is null or km_final >= km_inicial)
);
-- Una unidad no puede tener dos viajes abiertos
create unique index viajes_un_abierto_por_camion
  on public.viajes (camion_id) where estado = 'en_ruta';

create table public.inspecciones (
  id             uuid primary key default gen_random_uuid(),
  folio          text not null unique,
  viaje_id       uuid not null references public.viajes (id) on delete cascade,
  tipo           public.tipo_inspeccion not null,
  -- Copias del viaje para filtrar reportes sin joins
  camion_id      uuid not null references public.camiones (id),
  conductor_id   uuid not null references public.personal (id),
  ruta_id        uuid not null references public.rutas (id),
  supervisor_id  uuid references public.personal (id),
  kilometraje    integer not null check (kilometraje >= 0),
  combustible    text,
  observaciones  text,
  iniciada_at    timestamptz not null default now(),
  finalizada_at  timestamptz,
  resultado      public.estado_unidad,  -- se calcula al finalizar
  created_by     uuid,                  -- fase 2: usuario autenticado
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (viaje_id, tipo)
);

create table public.respuestas_inspeccion (
  id                 uuid primary key default gen_random_uuid(),
  inspeccion_id      uuid not null references public.inspecciones (id) on delete cascade,
  checklist_item_id  uuid not null references public.checklist_items (id),
  resultado          public.resultado_item not null,
  comentario         text,
  -- Copia del punto al momento de responder (historial fiel aunque el catálogo cambie)
  item_titulo        text not null,
  item_critico       boolean not null,
  created_at         timestamptz not null default now(),
  unique (inspeccion_id, checklist_item_id),
  constraint falla_requiere_comentario
    check (resultado <> 'falla' or nullif(btrim(comentario), '') is not null)
);

create table public.fotos_hallazgo (
  id            uuid primary key default gen_random_uuid(),
  respuesta_id  uuid not null references public.respuestas_inspeccion (id) on delete cascade,
  storage_path  text not null unique,
  created_at    timestamptz not null default now()
);

create table public.firmas (
  id             uuid primary key default gen_random_uuid(),
  inspeccion_id  uuid not null references public.inspecciones (id) on delete cascade,
  tipo           public.tipo_firma not null,
  personal_id    uuid not null references public.personal (id),
  storage_path   text not null,
  firmado_at     timestamptz not null default now(),
  unique (inspeccion_id, tipo)
);

-- Control TPM: autorizaciones y liberaciones de unidades
create table public.liberaciones (
  id                  uuid primary key default gen_random_uuid(),
  camion_id           uuid not null references public.camiones (id),
  inspeccion_id       uuid references public.inspecciones (id),
  estado_anterior     public.estado_unidad not null,
  decision            public.decision_liberacion not null,
  responsable_nombre  text not null,
  responsable_id      uuid references public.personal (id),
  accion_tomada       text not null check (btrim(accion_tomada) <> ''),
  firma_path          text,
  created_at          timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- Correo
-- ---------------------------------------------------------------------
create table public.destinatarios_correo (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique,
  nombre          text,
  recibe_reportes boolean not null default true,
  recibe_alertas  boolean not null default true,
  recibe_resumen  boolean not null default false,
  activo          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Bitácora de envíos (también sirve para vigilar el tope diario de Resend)
create table public.notificaciones_correo (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null check (tipo in ('reporte_viaje', 'alerta_no_apto', 'resumen_diario')),
  viaje_id       uuid references public.viajes (id) on delete set null,
  inspeccion_id  uuid references public.inspecciones (id) on delete set null,
  destinatarios  text[] not null,
  estado         text not null default 'pendiente' check (estado in ('pendiente', 'enviado', 'error')),
  proveedor_id   text,
  error          text,
  created_at     timestamptz not null default now(),
  enviado_at     timestamptz
);


-- ---------------------------------------------------------------------
-- Índices para los filtros de reportes
-- ---------------------------------------------------------------------
create index inspecciones_iniciada_idx   on public.inspecciones (iniciada_at desc);
create index inspecciones_camion_idx     on public.inspecciones (camion_id, iniciada_at desc);
create index inspecciones_conductor_idx  on public.inspecciones (conductor_id, iniciada_at desc);
create index inspecciones_ruta_idx       on public.inspecciones (ruta_id, iniciada_at desc);
create index inspecciones_resultado_idx  on public.inspecciones (resultado, iniciada_at desc);
create index viajes_salida_idx           on public.viajes (salida_at desc);
create index viajes_camion_idx           on public.viajes (camion_id);
create index respuestas_item_idx         on public.respuestas_inspeccion (checklist_item_id) where resultado = 'falla';
create index fotos_respuesta_idx         on public.fotos_hallazgo (respuesta_id);
create index liberaciones_camion_idx     on public.liberaciones (camion_id, created_at desc);
create index notificaciones_fecha_idx    on public.notificaciones_correo (created_at desc);


-- ---------------------------------------------------------------------
-- Seguridad: RLS activo y sin políticas en todas las tablas.
-- Solo la secret key (rol service_role, que ignora RLS) puede operar.
-- Fase 2: aquí se agregan políticas por rol y se devuelven los grants.
-- ---------------------------------------------------------------------
alter table public.camiones              enable row level security;
alter table public.personal              enable row level security;
alter table public.rutas                 enable row level security;
alter table public.checklist_items       enable row level security;
alter table public.viajes                enable row level security;
alter table public.inspecciones          enable row level security;
alter table public.respuestas_inspeccion enable row level security;
alter table public.fotos_hallazgo        enable row level security;
alter table public.firmas                enable row level security;
alter table public.liberaciones          enable row level security;
alter table public.destinatarios_correo  enable row level security;
alter table public.notificaciones_correo enable row level security;

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
