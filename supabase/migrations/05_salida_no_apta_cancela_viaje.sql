-- =====================================================================
-- Checklist de camiones FIFCO · Fase 1
-- 05 · Ajuste: una salida "No apto" cancela el viaje
--
-- Antes, una inspección de salida con falla crítica dejaba el viaje abierto
-- ("en ruta"), aunque la unidad queda inmovilizada y no debe salir.
-- Ahora el viaje pasa a "cancelado" y la unidad no aparece en ruta ni
-- en el formulario de retorno.
-- Ejecutar en Supabase > SQL Editor después de 01–04.
-- =====================================================================

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

-- Corrige viajes que hayan quedado abiertos con una salida No apta
update public.viajes v
set estado = 'cancelado'
where v.estado = 'en_ruta'
  and exists (
    select 1 from public.inspecciones i
    where i.viaje_id = v.id and i.tipo = 'salida' and i.resultado = 'no_apto'
  );
