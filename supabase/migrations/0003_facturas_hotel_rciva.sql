-- Ejecutar una sola vez en Supabase SQL Editor ANTES de publicar esta versión.
-- Mantiene datos existentes y las tablas de autenticación.
-- Crédito referencial hotel = 13% del importe facturado; el RC-IVA nunca es negativo.
-- Confirmar esta regla con la unidad financiera antes de uso oficial.
BEGIN;
CREATE OR REPLACE FUNCTION private.calcular_dia()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $fn$
DECLARE
 v public.viajes%rowtype;
 cat uuid;
 tarifa numeric(14,2);
 n integer;
 total_hotel numeric(14,2);
 retencion_bruta numeric(14,2);
 credito_hotel numeric(14,2);
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
 SELECT coalesce(sum(c.monto),0) INTO total_hotel FROM public.comprobantes c
 WHERE c.viaje_dia_id=new.id AND c.tipo='hospedaje';
 retencion_bruta:=round(new.total_viatico*.13,2);
 credito_hotel:=round(total_hotel*.13,2);
 new.rciva_ajuste:=greatest(0,retencion_bruta-credito_hotel);
 new.viatico_neto:=round(new.total_viatico-new.rciva_ajuste,2);
 new.iue_retencion:=round(new.pasaje_recibo*.13,2);
 new.it_retencion:=round(new.pasaje_recibo*.03,2);
 new.pasaje_neto:=round(new.pasaje_factura+new.pasaje_recibo-new.iue_retencion-new.it_retencion,2);
 new.liquido_pagable:=round(new.viatico_neto+new.pasaje_neto,2);
 RETURN new;
END
$fn$;
CREATE OR REPLACE FUNCTION private.validar_factura_hotel()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $fn$
DECLARE dia_id uuid; viaje_estado text;
BEGIN
 dia_id:=case when TG_OP='DELETE' then old.viaje_dia_id else new.viaje_dia_id end;
 SELECT v.estado INTO viaje_estado FROM public.viaje_dias d JOIN public.viajes v ON v.id=d.viaje_id WHERE d.id=dia_id;
 IF viaje_estado IS DISTINCT FROM 'borrador' THEN RAISE EXCEPTION 'Solo se admiten facturas para viajes en borrador'; END IF;
 IF TG_OP='UPDATE' AND old.viaje_dia_id IS DISTINCT FROM new.viaje_dia_id THEN
   RAISE EXCEPTION 'No se permite mover una factura a otro día';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END
$fn$;
CREATE OR REPLACE FUNCTION private.recalcular_por_factura_hotel()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $fn$
DECLARE dia_id uuid;
BEGIN
 dia_id:=case when TG_OP='DELETE' then old.viaje_dia_id else new.viaje_dia_id end;
 IF (TG_OP='DELETE' AND old.tipo='hospedaje') OR (TG_OP<>'DELETE' AND new.tipo='hospedaje') THEN
   UPDATE public.viaje_dias SET rciva_ajuste=rciva_ajuste WHERE id=dia_id;
 END IF;
 RETURN NULL;
END
$fn$;
DROP TRIGGER IF EXISTS trg_validar_factura_hotel ON public.comprobantes;
CREATE TRIGGER trg_validar_factura_hotel BEFORE INSERT OR UPDATE OR DELETE ON public.comprobantes
 FOR EACH ROW EXECUTE FUNCTION private.validar_factura_hotel();
DROP TRIGGER IF EXISTS trg_recalcular_factura_hotel ON public.comprobantes;
CREATE TRIGGER trg_recalcular_factura_hotel AFTER INSERT OR UPDATE OR DELETE ON public.comprobantes
 FOR EACH ROW EXECUTE FUNCTION private.recalcular_por_factura_hotel();
-- Aplicar ajuste también a días existentes en borrador (no modifica aprobados).
UPDATE public.viaje_dias d SET rciva_ajuste=rciva_ajuste
FROM public.viajes v WHERE v.id=d.viaje_id AND v.estado='borrador';
COMMIT;
