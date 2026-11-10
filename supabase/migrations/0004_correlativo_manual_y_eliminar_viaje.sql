-- GAMU: permite elegir el documento manualmente o reservar el próximo disponible.
-- No altera numeraciones históricas ni elimina registros al instalarse.
CREATE OR REPLACE FUNCTION public.emitir_planilla_con_numero(
  p_direccion_id uuid,
  p_gestion integer,
  p_fecha date,
  p_descripcion text,
  p_viajes uuid[],
  p_numero_solicitado text
) RETURNS TABLE(planilla_id uuid, numero_daf text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  numero text;
  nuevo uuid;
BEGIN
  IF NOT (SELECT private.can_write()) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.direcciones WHERE id=p_direccion_id) THEN
    RAISE EXCEPTION 'Seleccione una dirección válida';
  END IF;
  IF p_gestion NOT BETWEEN 2000 AND 2200 THEN RAISE EXCEPTION 'Gestión inválida'; END IF;
  IF p_fecha IS NULL THEN RAISE EXCEPTION 'Seleccione la fecha de planilla'; END IF;
  IF COALESCE(cardinality(p_viajes),0)=0 THEN RAISE EXCEPTION 'Seleccione al menos un viaje'; END IF;
  IF (SELECT count(*) FROM (SELECT DISTINCT unnest(p_viajes) AS id) AS ids) <> cardinality(p_viajes) THEN
    RAISE EXCEPTION 'Hay viajes duplicados en la selección';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_viajes) AS item(id)
    WHERE NOT EXISTS (SELECT 1 FROM public.viajes v WHERE v.id=item.id)
       OR NOT EXISTS (SELECT 1 FROM public.viaje_dias d WHERE d.viaje_id=item.id)
  ) THEN RAISE EXCEPTION 'Hay viajes inexistentes o sin días registrados'; END IF;

  -- Esta cerradura serializa emisiones de una misma dirección y gestión.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_direccion_id::text || ':' || p_gestion::text,0));
  IF p_numero_solicitado IS NOT NULL AND pg_catalog.btrim(p_numero_solicitado)<>'' THEN
    IF p_numero_solicitado !~ '^[1-9][0-9]{0,8}$' THEN
      RAISE EXCEPTION 'Número de documento inválido';
    END IF;
    numero := (p_numero_solicitado::integer)::text;
  ELSE
    SELECT (COALESCE(MAX(nro_daf::integer),0)+1)::text INTO numero
    FROM public.planillas
    WHERE direccion_id=p_direccion_id AND gestion=p_gestion AND nro_daf ~ '^[0-9]{1,9}$';
  END IF;
  IF EXISTS (SELECT 1 FROM public.planillas
             WHERE direccion_id=p_direccion_id AND gestion=p_gestion
               AND nro_daf ~ '^[0-9]{1,9}$' AND nro_daf::integer=numero::integer) THEN
    RAISE EXCEPTION 'El número de documento % ya existe en esta dirección y gestión', numero;
  END IF;
  INSERT INTO public.planillas(gestion,nro_daf,descripcion,fecha,direccion_id)
  VALUES(p_gestion,numero,COALESCE(p_descripcion,''),p_fecha,p_direccion_id)
  RETURNING id INTO nuevo;
  INSERT INTO public.planilla_viajes(planilla_id,viaje_id)
  SELECT nuevo,id FROM unnest(p_viajes) AS item(id);
  RETURN QUERY SELECT nuevo,numero;
END;
$$;
REVOKE ALL ON FUNCTION public.emitir_planilla_con_numero(uuid,integer,date,text,uuid[],text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.emitir_planilla_con_numero(uuid,integer,date,text,uuid[],text) TO authenticated;

-- El borrado real está reservado a administradores y exclusivamente a borradores.
-- Los números de planilla emitidos se conservan como registros históricos,
-- pero el viaje borrado se desvincula de ellas.
CREATE OR REPLACE FUNCTION public.eliminar_viaje_borrador(p_viaje uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE estado_actual text;
BEGIN
  IF NOT (SELECT private.is_admin()) THEN RAISE EXCEPTION 'Solo administradores pueden eliminar viajes'; END IF;
  SELECT estado INTO estado_actual FROM public.viajes WHERE id=p_viaje FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El viaje ya no existe'; END IF;
  IF estado_actual <> 'borrador' THEN RAISE EXCEPTION 'Solo se pueden eliminar viajes en borrador'; END IF;
  DELETE FROM public.planilla_viajes WHERE viaje_id=p_viaje;
  DELETE FROM public.comprobantes WHERE viaje_dia_id IN (SELECT id FROM public.viaje_dias WHERE viaje_id=p_viaje);
  DELETE FROM public.viaje_dias WHERE viaje_id=p_viaje;
  DELETE FROM public.viajes WHERE id=p_viaje AND estado='borrador';
  IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo eliminar el viaje'; END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.eliminar_viaje_borrador(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.eliminar_viaje_borrador(uuid) TO authenticated;
