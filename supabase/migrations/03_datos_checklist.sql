-- =====================================================================
-- Checklist de camiones FIFCO · Fase 1
-- 03 · Datos iniciales: los 24 puntos del checklist
-- Criticidad según la regla TPM: frenos, dirección, neumáticos,
-- seguridad y refrigeración (esta última solo en unidades refrigeradas).
-- =====================================================================

insert into public.checklist_items (tipo, orden, titulo, descripcion, critico, critico_si_refrigerado) values
  -- Inspección de salida · responsable: conductor · antes de cargar o despachar
  ('salida',  1, 'Documentación',            'Licencia vigente, marchamo, Dekra, otros',          false, false),
  ('salida',  2, 'Estado exterior',          'Carrocería, parabrisas, espejos y puertas',         false, false),
  ('salida',  3, 'Neumáticos',               'Presión, desgaste, cortes y tuercas',               true,  false),
  ('salida',  4, 'Sistema de frenos',        'Freno de servicio y freno de estacionamiento',      true,  false),
  ('salida',  5, 'Luces',                    'Faros, direccionales, luces de freno y reversa',    false, false),
  ('salida',  6, 'Motor y fluidos',          'Aceite, refrigerante, combustible y fugas',         false, false),
  ('salida',  7, 'Cabina',                   'Cinturón, bocina, limpiaparabrisas y tablero',      false, false),
  ('salida',  8, 'Equipos de seguridad',     'Extintor, triángulos, chaleco y botiquín',          true,  false),
  ('salida',  9, 'Sistema de refrigeración', 'Temperatura, funcionamiento y alarmas',             false, true),
  ('salida', 10, 'Caja de carga',            'Limpieza, olores, puertas y empaques',              false, false),
  ('salida', 11, 'Carga',                    'Estiba, distribución del peso y sujeción',          false, false),
  ('salida', 12, 'Monitoreo',                'GPS, sensor de temperatura y registros',            false, false),

  -- Inspección de retorno · responsable: conductor y supervisor · al regresar al CEDI
  ('retorno',  1, 'Estado exterior',      'Golpes, rayones y daños en carrocería',           false, false),
  ('retorno',  2, 'Neumáticos',           'Desgaste, daños o pérdida de presión',            true,  false),
  ('retorno',  3, 'Frenos y dirección',   'Anomalías o ruidos durante la ruta',              true,  false),
  ('retorno',  4, 'Motor y fluidos',      'Fugas, temperatura y alertas del tablero',        false, false),
  ('retorno',  5, 'Combustible',          'Nivel final y consumo registrado',                false, false),
  ('retorno',  6, 'Equipo frío',          'Fallas o alarmas registradas',                    false, true),
  ('retorno',  7, 'Caja de carga',        'Limpieza, derrames y estado de puertas',          false, false),
  ('retorno',  8, 'Devoluciones',         'Producto devuelto, averías y diferencias',        false, false),
  ('retorno',  9, 'Equipos y accesorios', 'Extintor, herramientas, llaves y documentos',     true,  false),
  ('retorno', 10, 'Kilometraje',          'Odómetro final y kilómetros recorridos',          false, false),
  ('retorno', 11, 'Incidencias',          'Accidentes, fallas o mantenimientos pendientes',  false, false),
  ('retorno', 12, 'Entrega de unidad',    'Condición final y reporte al supervisor',         false, false);

-- Verificación: debe devolver salida = 12 y retorno = 12
select tipo, count(*) as puntos from public.checklist_items group by tipo order by tipo;
