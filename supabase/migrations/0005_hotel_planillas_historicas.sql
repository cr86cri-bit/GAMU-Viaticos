-- Ejecutar en Supabase SQL Editor para instalar las mejoras.
-- No elimina planillas ni viajes; recalcula únicamente días de viajes en borrador.
BEGIN;
ALTER TABLE public.planillas ADD COLUMN IF NOT EXISTS snapshot jsonb;

CREATE OR REPLACE FUNCTION private.calcular_dia()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $fn$
DECLARE
 v public.viajes%rowtype;
 cat uuid;
 tarifa numeric(14,2);
 n integer;
 total_hotel numeric(14,2);
BEGIN
 SELECT * INTO v FROM public.viajes WHERE id=new.viaje_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Viaje inexistente'; END IF;
 IF v.estado <> 'borrador' THEN RAISE EXCEPTION 'Solo se pueden modificar viajes en borrador'; END IF;
 IF new.fecha<v.fecha_inicio OR new.fecha>v.fecha_fin THEN RAISE EXCEPTION 'Fecha fuera del rango del viaje'; END IF;
 SELECT categoria_id INTO cat FROM public.funcionarios WHERE id=v.funcionario_id;
 IF cat IS NULL THEN RAISE EXCEPTION 'Funcionario sin categoría'; END IF;
 SELECT count(*),max(monto_base) INTO n,tarifa FROM public.tarifas_viaticos t
 WHERE t.categoria_id=cat AND t.destino_id=v.destino_id
 AND new.fecha>=t.vigente_desde AND (t.vigente_hasta IS NULL OR new.fecha<=t.vigente_hasta);
 IF n<>1 THEN RAISE EXCEPTION 'Se requiere exactamente una tarifa vigente para categoría, destino y fecha'; END IF;
 new.viatico_dia:=round(tarifa*new.porcentaje/100,2);
 new.total_viatico:=new.viatico_dia;
 SELECT COALESCE(sum(monto),0) INTO total_hotel FROM public.comprobantes
 WHERE viaje_dia_id=new.id AND tipo='hospedaje';
 new.rciva_ajuste:=greatest(0,round(new.total_viatico*0.13,2)-round(total_hotel*0.13,2));
 new.viatico_neto:=round(new.total_viatico-new.rciva_ajuste,2);
 new.iue_retencion:=round(new.pasaje_recibo*0.13,2);
 new.it_retencion:=round(new.pasaje_recibo*0.03,2);
 new.pasaje_neto:=round(new.pasaje_factura+new.pasaje_recibo-new.iue_retencion-new.it_retencion,2);
 new.liquido_pagable:=round(new.viatico_neto+new.pasaje_neto,2);
 RETURN new;
END $fn$;

CREATE OR REPLACE FUNCTION private.validar_factura_hotel()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $fn$
DECLARE dia_id uuid; viaje_estado text;
BEGIN
 dia_id:=CASE WHEN TG_OP='DELETE' THEN old.viaje_dia_id ELSE new.viaje_dia_id END;
 SELECT v.estado INTO viaje_estado FROM public.viaje_dias d JOIN public.viajes v ON v.id=d.viaje_id WHERE d.id=dia_id;
 IF viaje_estado IS DISTINCT FROM 'borrador' THEN RAISE EXCEPTION 'Solo se admiten facturas para viajes en borrador'; END IF;
 IF TG_OP='UPDATE' AND old.viaje_dia_id IS DISTINCT FROM new.viaje_dia_id THEN RAISE EXCEPTION 'No se permite mover una factura a otro día'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN old ELSE new END;
END $fn$;

CREATE OR REPLACE FUNCTION private.recalcular_por_factura_hotel()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $fn$
DECLARE dia_id uuid;
BEGIN
 dia_id:=CASE WHEN TG_OP='DELETE' THEN old.viaje_dia_id ELSE new.viaje_dia_id END;
 IF (TG_OP='DELETE' AND old.tipo='hospedaje') OR (TG_OP<>'DELETE' AND new.tipo='hospedaje') THEN
  UPDATE public.viaje_dias SET rciva_ajuste=rciva_ajuste WHERE id=dia_id;
 END IF;
 RETURN NULL;
END $fn$;
DROP TRIGGER IF EXISTS trg_validar_factura_hotel ON public.comprobantes;
CREATE TRIGGER trg_validar_factura_hotel BEFORE INSERT OR UPDATE OR DELETE ON public.comprobantes
FOR EACH ROW EXECUTE FUNCTION private.validar_factura_hotel();
DROP TRIGGER IF EXISTS trg_recalcular_factura_hotel ON public.comprobantes;
CREATE TRIGGER trg_recalcular_factura_hotel AFTER INSERT OR UPDATE OR DELETE ON public.comprobantes
FOR EACH ROW EXECUTE FUNCTION private.recalcular_por_factura_hotel();

UPDATE public.viaje_dias d SET rciva_ajuste=rciva_ajuste
FROM public.viajes v WHERE d.viaje_id=v.id AND v.estado='borrador';

-- La edición es una transacción atómica. El histórico se reconstruye al reimprimir
-- si se modificó el contenido vinculado. Solo se permite a administradores.
CREATE OR REPLACE FUNCTION public.editar_planilla_emitida(
 p_planilla uuid,p_direccion_id uuid,p_gestion integer,p_numero text,p_fecha date,p_viajes uuid[],p_descripcion text
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE nuevo_numero text;
BEGIN
 IF NOT (SELECT private.is_admin()) THEN RAISE EXCEPTION 'Solo administradores pueden editar planillas'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.planillas WHERE id=p_planilla FOR UPDATE) THEN RAISE EXCEPTION 'Planilla inexistente'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.direcciones WHERE id=p_direccion_id) THEN RAISE EXCEPTION 'Dirección inválida'; END IF;
 IF p_gestion NOT BETWEEN 2000 AND 2200 THEN RAISE EXCEPTION 'Gestión inválida'; END IF;
 IF p_fecha IS NULL THEN RAISE EXCEPTION 'Fecha inválida'; END IF;
 IF p_numero !~ '^[1-9][0-9]{0,8}$' THEN RAISE EXCEPTION 'Número de documento inválido'; END IF;
 nuevo_numero:=(p_numero::integer)::text;
 IF COALESCE(cardinality(p_viajes),0)=0 THEN RAISE EXCEPTION 'Selecciona al menos un viaje'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_viajes) AS x(id)
  WHERE NOT EXISTS(SELECT 1 FROM public.viajes WHERE id=x.id)
     OR NOT EXISTS(SELECT 1 FROM public.viaje_dias WHERE viaje_id=x.id))
 THEN RAISE EXCEPTION 'Los viajes seleccionados deben existir y tener días'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_direccion_id::text||':'||p_gestion::text,0));
 IF EXISTS(SELECT 1 FROM public.planillas WHERE id<>p_planilla AND direccion_id=p_direccion_id AND gestion=p_gestion
  AND nro_daf ~ '^[0-9]{1,9}$' AND nro_daf::integer=nuevo_numero::integer)
 THEN RAISE EXCEPTION 'El documento N.º % ya existe para esta dirección y gestión',nuevo_numero; END IF;
 UPDATE public.planillas SET direccion_id=p_direccion_id,gestion=p_gestion,nro_daf=nuevo_numero,
 fecha=p_fecha,descripcion=COALESCE(p_descripcion,''),snapshot=NULL WHERE id=p_planilla;
 DELETE FROM public.planilla_viajes WHERE planilla_id=p_planilla;
 INSERT INTO public.planilla_viajes(planilla_id,viaje_id)
 SELECT p_planilla,x.id FROM (SELECT DISTINCT unnest(p_viajes) AS id) x;
 RETURN TRUE;
END $fn$;
REVOKE ALL ON FUNCTION public.editar_planilla_emitida(uuid,uuid,integer,text,date,uuid[],text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.editar_planilla_emitida(uuid,uuid,integer,text,date,uuid[],text) TO authenticated;
COMMIT;
