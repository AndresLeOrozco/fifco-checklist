-- =====================================================================
-- Checklist de camiones FIFCO · Fase 1
-- 02 · Reglas de negocio: triggers, funciones y vista de reportes
-- =====================================================================


-- ---------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger camiones_updated_at     before update on public.camiones     for each row execute function public.set_updated_at();
create trigger personal_updated_at     before update on public.personal     for each row execute function public.set_updated_at();
create trigger rutas_updated_at        before update on public.rutas        for each row execute function public.set_updated_at();
create trigger viajes_updated_at       before update on public.viajes       for each row execute function public.set_updated_at();
create trigger inspecciones_updated_at before update on public.inspecciones for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------
-- Viajes: no se abre un viaje si la unidad está No apta o inactiva,
-- ni con un kilometraje menor al último registrado.
-- ---------------------------------------------------------------------
create or replace function public.validar_nuevo_viaje()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_camion public.camiones%rowtype;
begin
  select * into v_camion from public.camiones where id = new.camion_id for update;

  if not v_camion.activo then
    raise exception 'La unidad % está inactiva.', v_camion.numero_unidad using errcode = 'P0001';
  end if;

  if v_camion.estado_actual = 'no_apto' then
    raise exception 'La unidad % está No apta y requiere liberación antes de salir.', v_camion.numero_unidad
      using errcode = 'P0001';
  end if;

  if v_camion.ultimo_km is not null and new.km_inicial < v_camion.ultimo_km then
    raise exception 'El kilometraje inicial (%) es menor al último registrado (%).', new.km_inicial, v_camion.ultimo_km
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger viajes_validar_nuevo
  before insert on public.viajes
  for each row execute function public.validar_nuevo_viaje();


-- ---------------------------------------------------------------------
-- Inspecciones: folio automático (SAL-… / RET-…) y copia de datos del viaje
-- ---------------------------------------------------------------------
create or replace function public.preparar_inspeccion()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_viaje public.viajes%rowtype;
begin
  select * into v_viaje from public.viajes where id = new.viaje_id;

  if v_viaje.estado <> 'en_ruta' then
    raise exception 'El viaje % ya está cerrado o cancelado.', v_viaje.folio using errcode = 'P0001';
  end if;

  new.camion_id    := v_viaje.camion_id;
  new.conductor_id := v_viaje.conductor_id;
  new.ruta_id      := v_viaje.ruta_id;

  if new.folio is null then
    new.folio := case new.tipo when 'salida' then 'SAL-' else 'RET-' end
                 || to_char(now() at time zone 'America/Costa_Rica', 'YYMMDD')
                 || '-' || lpad(nextval('public.inspeccion_folio_seq')::text, 5, '0');
  end if;

  return new;
end;
$$;

create trigger inspecciones_preparar
  before insert on public.inspecciones
  for each row execute function public.preparar_inspeccion();


-- ---------------------------------------------------------------------
-- Respuestas: copia título y criticidad del punto (considerando si la
-- unidad es refrigerada) y bloquea cambios en inspecciones finalizadas.
-- ---------------------------------------------------------------------
create or replace function public.preparar_respuesta()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_item       public.checklist_items%rowtype;
  v_insp       public.inspecciones%rowtype;
  v_tipo_unid  public.tipo_unidad;
begin
  select * into v_insp from public.inspecciones where id = new.inspeccion_id;

  if v_insp.finalizada_at is not null then
    raise exception 'La inspección % ya fue finalizada y no se puede modificar.', v_insp.folio using errcode = 'P0001';
  end if;

  select * into v_item from public.checklist_items where id = new.checklist_item_id;

  if v_item.tipo <> v_insp.tipo then
    raise exception 'El punto "%" no pertenece a una inspección de %.', v_item.titulo, v_insp.tipo using errcode = 'P0001';
  end if;

  select tipo into v_tipo_unid from public.camiones where id = v_insp.camion_id;

  new.item_titulo  := v_item.titulo;
  new.item_critico := v_item.critico or (v_item.critico_si_refrigerado and v_tipo_unid = 'refrigerado');

  return new;
end;
$$;

create trigger respuestas_preparar
  before insert or update on public.respuestas_inspeccion
  for each row execute function public.preparar_respuesta();


-- ---------------------------------------------------------------------
-- Finalizar inspección (la app la llama al enviar el formulario).
-- Valida que esté completa, calcula el resultado y actualiza unidad y viaje.
--   · Falla en punto crítico     → no_apto
--   · Falla en punto no crítico  → requiere_correccion
--   · Sin fallas                 → apto
-- La unidad conserva siempre el estado más grave pendiente; solo una
-- liberación la devuelve a apto.
-- ---------------------------------------------------------------------
create or replace function public.finalizar_inspeccion(p_inspeccion_id uuid)
returns public.estado_unidad
language plpgsql
set search_path = ''
as $$
declare
  v_insp        public.inspecciones%rowtype;
  v_esperados   integer;
  v_respondidos integer;
  v_resultado   public.estado_unidad;
begin
  select * into v_insp from public.inspecciones where id = p_inspeccion_id for update;

  if not found then
    raise exception 'La inspección no existe.' using errcode = 'P0002';
  end if;

  if v_insp.finalizada_at is not null then
    raise exception 'La inspección % ya fue finalizada.', v_insp.folio using errcode = 'P0001';
  end if;

  -- 1. Todos los puntos activos respondidos
  select count(*) into v_esperados
  from public.checklist_items
  where tipo = v_insp.tipo and activo;

  select count(*) into v_respondidos
  from public.respuestas_inspeccion r
  join public.checklist_items c on c.id = r.checklist_item_id
  where r.inspeccion_id = p_inspeccion_id and c.activo;

  if v_respondidos < v_esperados then
    raise exception 'Faltan % de % puntos por revisar.', v_esperados - v_respondidos, v_esperados using errcode = 'P0001';
  end if;

  -- 2. Cada falla con al menos una fotografía
  if exists (
    select 1 from public.respuestas_inspeccion r
    where r.inspeccion_id = p_inspeccion_id
      and r.resultado = 'falla'
      and not exists (select 1 from public.fotos_hallazgo f where f.respuesta_id = r.id)
  ) then
    raise exception 'Cada falla debe tener al menos una fotografía.' using errcode = 'P0001';
  end if;

  -- 3. Firmas: conductor siempre; supervisor en el retorno
  if not exists (select 1 from public.firmas where inspeccion_id = p_inspeccion_id and tipo = 'conductor') then
    raise exception 'Falta la firma del conductor.' using errcode = 'P0001';
  end if;

  if v_insp.tipo = 'retorno' and not exists (
    select 1 from public.firmas where inspeccion_id = p_inspeccion_id and tipo = 'supervisor'
  ) then
    raise exception 'Falta la firma del supervisor.' using errcode = 'P0001';
  end if;

  -- 4. Resultado
  select case
           when bool_or(resultado = 'falla' and item_critico) then 'no_apto'
           when bool_or(resultado = 'falla')                  then 'requiere_correccion'
           else 'apto'
         end::public.estado_unidad
  into v_resultado
  from public.respuestas_inspeccion
  where inspeccion_id = p_inspeccion_id;

  update public.inspecciones
  set resultado = v_resultado, finalizada_at = now()
  where id = p_inspeccion_id;

  -- 5. Unidad: estado más grave y último kilometraje
  update public.camiones
  set estado_actual = greatest(estado_actual, v_resultado),
      ultimo_km     = greatest(coalesce(ultimo_km, 0), v_insp.kilometraje)
  where id = v_insp.camion_id;

  -- 6. Retorno: cierra el viaje
  if v_insp.tipo = 'retorno' then
    update public.viajes
    set km_final = v_insp.kilometraje, retorno_at = now(), estado = 'cerrado'
    where id = v_insp.viaje_id;
  end if;

  return v_resultado;
end;
$$;


-- ---------------------------------------------------------------------
-- Liberaciones: guarda el estado anterior y devuelve la unidad a apto
-- ---------------------------------------------------------------------
create or replace function public.preparar_liberacion()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_estado public.estado_unidad;
begin
  select estado_actual into v_estado from public.camiones where id = new.camion_id for update;

  if v_estado = 'apto' then
    raise exception 'La unidad ya está apta; no hay nada que liberar.' using errcode = 'P0001';
  end if;

  new.estado_anterior := v_estado;
  return new;
end;
$$;

create or replace function public.aplicar_liberacion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.camiones set estado_actual = 'apto' where id = new.camion_id;
  return new;
end;
$$;

create trigger liberaciones_preparar
  before insert on public.liberaciones
  for each row execute function public.preparar_liberacion();

create trigger liberaciones_aplicar
  after insert on public.liberaciones
  for each row execute function public.aplicar_liberacion();


-- ---------------------------------------------------------------------
-- Vista para la sección de reportes (respeta RLS: security_invoker)
-- ---------------------------------------------------------------------
create or replace view public.v_reporte_inspecciones
with (security_invoker = true)
as
select
  i.id,
  i.folio,
  i.tipo,
  i.iniciada_at,
  i.finalizada_at,
  i.resultado,
  i.kilometraje,
  v.id              as viaje_id,
  v.folio           as viaje_folio,
  v.km_recorridos,
  c.id              as camion_id,
  c.numero_unidad,
  c.placa,
  c.tipo            as tipo_unidad,
  p.id              as conductor_id,
  p.nombre          as conductor,
  r.id              as ruta_id,
  r.codigo          as ruta_codigo,
  r.descripcion     as ruta,
  s.nombre          as supervisor,
  (select count(*) from public.respuestas_inspeccion ri
    where ri.inspeccion_id = i.id and ri.resultado = 'falla') as hallazgos
from public.inspecciones i
join public.viajes   v on v.id = i.viaje_id
join public.camiones c on c.id = i.camion_id
join public.personal p on p.id = i.conductor_id
join public.rutas    r on r.id = i.ruta_id
left join public.personal s on s.id = i.supervisor_id;

revoke all on public.v_reporte_inspecciones from anon, authenticated;


-- ---------------------------------------------------------------------
-- Las funciones no se exponen al público por la API
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
