-- GAMU: conservar el correlativo al editar y mostrar la dirección en documentos existentes.
-- No altera números, fechas, viajes, importes ni vínculos ya registrados.
BEGIN;

CREATE OR REPLACE FUNCTION public.editar_planilla_emitida(
 p_planilla uuid, p_direccion_id uuid, p_gestion integer, p_numero text,
 p_fecha date, p_viajes uuid[], p_descripcion text
) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE
 numero_original text;
 siglas_actuales text;
 nombre_actual text;
 color_actual text;
 ids_anteriores uuid[];
 ids_nuevos uuid[];
BEGIN
 IF NOT (SELECT private.is_admin()) THEN
   RAISE EXCEPTION 'Solo administradores pueden editar planillas';
 END IF;
 SELECT nro_daf INTO numero_original FROM public.planillas WHERE id=p_planilla FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Planilla inexistente'; END IF;
 IF numero_original IS NULL OR numero_original !~ '^[1-9][0-9]{0,8}$' THEN
   RAISE EXCEPTION 'El documento no tiene un correlativo válido';
 END IF;
 -- El correlativo de una planilla emitida es inmutable.
 IF p_numero IS DISTINCT FROM numero_original THEN
   RAISE EXCEPTION 'El N.º de documento % no puede cambiarse al editar; conserva el original %',p_numero,numero_original;
 END IF;
 SELECT trim(siglas),trim(nombre),color INTO siglas_actuales,nombre_actual,color_actual
 FROM public.direcciones WHERE id=p_direccion_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Dirección inválida'; END IF;
 IF p_gestion NOT BETWEEN 2000 AND 2200 THEN RAISE EXCEPTION 'Gestión inválida'; END IF;
 IF p_fecha IS NULL THEN RAISE EXCEPTION 'Fecha inválida'; END IF;
 IF COALESCE(cardinality(p_viajes),0)=0 THEN RAISE EXCEPTION 'Selecciona al menos un viaje'; END IF;
 SELECT ARRAY(SELECT DISTINCT x.id FROM unnest(p_viajes) AS x(id) ORDER BY x.id) INTO ids_nuevos;
 SELECT ARRAY(SELECT pv.viaje_id FROM public.planilla_viajes pv
              WHERE pv.planilla_id=p_planilla ORDER BY pv.viaje_id) INTO ids_anteriores;
 IF EXISTS(SELECT 1 FROM unnest(ids_nuevos) AS x(id)
   WHERE NOT EXISTS(SELECT 1 FROM public.viajes WHERE id=x.id)
      OR NOT EXISTS(SELECT 1 FROM public.viaje_dias WHERE viaje_id=x.id))
 THEN RAISE EXCEPTION 'Los viajes seleccionados deben existir y tener días'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended(p_direccion_id::text||':'||p_gestion::text,0));
 IF EXISTS(SELECT 1 FROM public.planillas WHERE id<>p_planilla
    AND direccion_id=p_direccion_id AND gestion=p_gestion
    AND nro_daf ~ '^[0-9]{1,9}$' AND nro_daf::integer=numero_original::integer)
 THEN RAISE EXCEPTION 'El documento N.º % ya existe en esa dirección y gestión', numero_original; END IF;
 UPDATE public.planillas SET
   direccion_id=p_direccion_id,
   gestion=p_gestion,
   -- NO se actualiza nro_daf
   fecha=p_fecha,
   descripcion=COALESCE(p_descripcion,''),
   snapshot=CASE WHEN ids_anteriores=ids_nuevos AND snapshot IS NOT NULL
     THEN snapshot || jsonb_build_object(
       'daf',numero_original,
       'gestion',p_gestion::text,
       'fecha',p_fecha,
       'descripcion',COALESCE(p_descripcion,''),
       'siglas',siglas_actuales,
       'direccionNombre',nombre_actual,
       'color',COALESCE(color_actual,'#CCD0CF'))
     ELSE NULL END
 WHERE id=p_planilla;
 DELETE FROM public.planilla_viajes WHERE planilla_id=p_planilla;
 INSERT INTO public.planilla_viajes(planilla_id,viaje_id)
 SELECT p_planilla,x.id FROM unnest(ids_nuevos) x(id);
 RETURN TRUE;
END $fn$;
REVOKE ALL ON FUNCTION public.editar_planilla_emitida(uuid,uuid,integer,text,date,uuid[],text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.editar_planilla_emitida(uuid,uuid,integer,text,date,uuid[],text) TO authenticated;

-- Corregir únicamente los metadatos de snapshots existentes; conservar las filas
-- históricas y sus importes tal como fueron guardados.
UPDATE public.planillas p
SET snapshot = p.snapshot || jsonb_build_object(
  'daf',p.nro_daf,
  'gestion',p.gestion::text,
  'fecha',p.fecha,
  'siglas',trim(d.siglas),
  'direccionNombre',trim(d.nombre),
  'color',COALESCE(d.color,'#CCD0CF'))
FROM public.direcciones d
WHERE p.direccion_id=d.id AND p.snapshot IS NOT NULL
  AND jsonb_typeof(p.snapshot)='object';

COMMIT;
