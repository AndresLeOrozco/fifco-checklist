-- =====================================================================
-- Checklist de flota · Heineken · Distribución Retail
-- 06 · Ajustes de checklist y de nombres
--
--   · "Sistema de refrigeración" pasa a llamarse "Equipo frío".
--   · "Caja de carga" pasa a llamarse "Cajón de camión" (salida y retorno).
--   · Se quita "Monitoreo" de la salida y "Devoluciones" del retorno.
--     Se desactivan (activo = false) en lugar de borrarse, porque las
--     inspecciones anteriores tienen respuestas que apuntan a ellos.
--   · El rol "supervisor" se muestra como "Encargado de flota". El valor
--     interno del enum no cambia; solo se ajusta el mensaje de error.
--
-- Las inspecciones ya registradas conservan el título con el que se
-- respondieron (respuestas_inspeccion.item_titulo), como historial fiel.
--
-- Ejecutar en Supabase > SQL Editor después de 01–05. Todo va en una
-- transacción: si algo falla, no se aplica nada.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Nuevos nombres de puntos
-- ---------------------------------------------------------------------
update public.checklist_items
set titulo = 'Equipo frío'
where titulo in ('Sistema de refrigeración', 'Equipo frío');

update public.checklist_items
set titulo = 'Cajón de camión'
where titulo = 'Caja de carga';

update public.checklist_items
set descripcion = 'Condición final y reporte al encargado de flota'
where tipo = 'retorno' and titulo = 'Entrega de unidad';


-- ---------------------------------------------------------------------
-- 2. Puntos que se quitan
-- ---------------------------------------------------------------------
update public.checklist_items
set activo = false
where (tipo = 'salida'  and titulo = 'Monitoreo')
   or (tipo = 'retorno' and titulo = 'Devoluciones');


-- ---------------------------------------------------------------------
-- 3. Renumerar los puntos activos (1, 2, 3… sin huecos) y dejar los
--    inactivos al final. Se pasa primero por números altos para no
--    chocar con la restricción unique (tipo, orden).
-- ---------------------------------------------------------------------
update public.checklist_items set orden = orden + 25;

with nuevo as (
  select id,
         row_number() over (partition by tipo order by activo desc, orden) as orden
  from public.checklist_items
)
update public.checklist_items c
set orden = nuevo.orden
from nuevo
where c.id = nuevo.id;


-- ---------------------------------------------------------------------
-- 4. Mensaje de firma faltante con el nuevo nombre del rol
--    (misma función que la migración 05; solo cambia el texto)
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

  -- 3. Firmas: conductor siempre; encargado de flota (rol 'supervisor') en el retorno
  if not exists (select 1 from public.firmas where inspeccion_id = p_inspeccion_id and tipo = 'conductor') then
    raise exception 'Falta la firma del conductor.' using errcode = 'P0001';
  end if;

  if v_insp.tipo = 'retorno' and not exists (
    select 1 from public.firmas where inspeccion_id = p_inspeccion_id and tipo = 'supervisor'
  ) then
    raise exception 'Falta la firma del encargado de flota.' using errcode = 'P0001';
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

  -- 6. Salida No apta: el camión no sale, el viaje se cancela
  if v_insp.tipo = 'salida' and v_resultado = 'no_apto' then
    update public.viajes set estado = 'cancelado' where id = v_insp.viaje_id;
  end if;

  -- 7. Retorno: cierra el viaje
  if v_insp.tipo = 'retorno' then
    update public.viajes
    set km_final = v_insp.kilometraje, retorno_at = now(), estado = 'cerrado'
    where id = v_insp.viaje_id;
  end if;

  return v_resultado;
end;
$$;

revoke execute on function public.finalizar_inspeccion(uuid) from public, anon, authenticated;

comment on type public.rol_personal is 'conductor | supervisor (se muestra como "Encargado de flota").';
comment on column public.inspecciones.supervisor_id is 'Encargado de flota que recibe la unidad en el retorno.';
comment on column public.checklist_items.critico_si_refrigerado is 'Crítico solo cuando la unidad es refrigerada (p. ej. equipo frío).';

commit;

-- Verificación: debe devolver salida = 11 y retorno = 11 puntos activos
select tipo, orden, titulo, activo
from public.checklist_items
order by tipo, orden;
