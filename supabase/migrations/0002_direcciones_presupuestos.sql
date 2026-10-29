-- Migración incremental GAMU 2026. No borra registros anteriores.
create table if not exists public.direcciones (
 id uuid primary key default gen_random_uuid(), siglas text not null unique,
 nombre text not null, color text not null default '#253745'
 check (color ~ '^#[0-9A-Fa-f]{6}$'),
 created_at timestamptz not null default now()
);
alter table public.direcciones enable row level security;
create policy direcciones_lectura on public.direcciones for select to authenticated using ((select private.can_read()));
create policy direcciones_admin on public.direcciones for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
alter table public.viajes add column if not exists direccion_id uuid references public.direcciones(id);
alter table public.planillas add column if not exists direccion_id uuid references public.direcciones(id);
alter table public.viajes add column if not exists presupuesto_viatico_id uuid references public.presupuestos(id);
alter table public.viajes add column if not exists presupuesto_pasaje_id uuid references public.presupuestos(id);
alter table public.movimientos_presupuestarios add column if not exists viaje_id uuid references public.viajes(id);
alter table public.movimientos_presupuestarios add column if not exists objeto_gasto text;
create unique index if not exists movimiento_viaje_objeto_unico on public.movimientos_presupuestarios(viaje_id,objeto_gasto) where viaje_id is not null and tipo = 'ejecucion';
create index if not exists presupuesto_movimientos_idx on public.movimientos_presupuestarios(presupuesto_id);

-- RC-IVA obligatorio: 13 % del total de viáticos, sin ajuste manual.
create or replace function private.calcular_dia() returns trigger language plpgsql security invoker set search_path='' as $$
declare v public.viajes%rowtype; cat uuid; tarifa numeric(14,2); n integer;
begin
 select * into v from public.viajes where id=new.viaje_id;
 if not found then raise exception 'Viaje inexistente'; end if;
 if v.estado <> 'borrador' then raise exception 'Solo se pueden modificar viajes en borrador'; end if;
 if new.fecha<v.fecha_inicio or new.fecha>v.fecha_fin then raise exception 'Fecha fuera del rango del viaje'; end if;
 select categoria_id into cat from public.funcionarios where id=v.funcionario_id;
 if cat is null then raise exception 'Funcionario sin categoría'; end if;
 select count(*) into n from public.tarifas_viaticos t where t.categoria_id=cat and t.destino_id=v.destino_id and new.fecha>=t.vigente_desde and (t.vigente_hasta is null or new.fecha<=t.vigente_hasta);
 if n<>1 then raise exception 'Se requiere exactamente una tarifa vigente para categoría, destino y fecha'; end if;
 select monto_base into tarifa from public.tarifas_viaticos t where t.categoria_id=cat and t.destino_id=v.destino_id and new.fecha>=t.vigente_desde and (t.vigente_hasta is null or new.fecha<=t.vigente_hasta);
 new.viatico_dia:=round(tarifa*new.porcentaje/100,2);
 new.total_viatico:=new.viatico_dia;
 new.rciva_ajuste:=round(new.total_viatico*0.13,2);
 new.viatico_neto:=round(new.total_viatico-new.rciva_ajuste,2);
 new.iue_retencion:=round(new.pasaje_recibo*0.13,2);
 new.it_retencion:=round(new.pasaje_recibo*0.03,2);
 new.pasaje_neto:=round(new.pasaje_factura+new.pasaje_recibo-new.iue_retencion-new.it_retencion,2);
 new.liquido_pagable:=round(new.viatico_neto+new.pasaje_neto,2);
 return new;
end $$;

-- Aprobación atómica: sólo administradores. Aprobación registra presupuesto por viáticos y pasajes.
-- El mismo viaje no puede descontarse dos veces. Las partidas deben corresponder al año y objeto.
create or replace function public.aprobar_viaje(p_viaje uuid,p_presupuesto_viatico uuid,p_presupuesto_pasaje uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare v public.viajes%rowtype; gasto_v numeric(14,2); gasto_p numeric(14,2);
begin
 if not (select private.is_admin()) then raise exception 'No autorizado para aprobar viajes'; end if;
 select * into v from public.viajes where id=p_viaje for update;
 if not found then raise exception 'Viaje no encontrado'; end if;
 if v.estado<>'borrador' then raise exception 'El viaje ya fue procesado'; end if;
 select round(coalesce(sum(viatico_neto),0),2),round(coalesce(sum(pasaje_neto),0),2)
 into gasto_v,gasto_p from public.viaje_dias where viaje_id=p_viaje;
 if not exists(select 1 from public.viaje_dias where viaje_id=p_viaje) then raise exception 'Agregue al menos un día'; end if;
 if gasto_v < 0 or gasto_p < 0 then raise exception 'Importes no válidos'; end if;
 if p_presupuesto_viatico is null or p_presupuesto_pasaje is null then raise exception 'Seleccione ambos presupuestos'; end if;
 -- Bloquear partidas en orden fijo para minimizar interbloqueos.
 perform 1 from public.presupuestos where id in (p_presupuesto_viatico,p_presupuesto_pasaje) order by id for update;
 if not exists(select 1 from public.presupuestos where id=p_presupuesto_viatico and objeto_gasto='2.2.2.10' and gestion=extract(year from v.fecha_inicio)::integer) then raise exception 'Presupuesto de viáticos incorrecto para la gestión'; end if;
 if not exists(select 1 from public.presupuestos where id=p_presupuesto_pasaje and objeto_gasto='2.2.1.10' and gestion=extract(year from v.fecha_inicio)::integer) then raise exception 'Presupuesto de pasajes incorrecto para la gestión'; end if;
 if exists (select 1 from public.presupuestos p where p.id=p_presupuesto_viatico and p.monto_asignado-(select coalesce(sum(m.monto),0) from public.movimientos_presupuestarios m where m.presupuesto_id=p.id) < gasto_v) then raise exception 'Saldo insuficiente en presupuesto de viáticos'; end if;
 if exists (select 1 from public.presupuestos p where p.id=p_presupuesto_pasaje and p.monto_asignado-(select coalesce(sum(m.monto),0) from public.movimientos_presupuestarios m where m.presupuesto_id=p.id) < gasto_p) then raise exception 'Saldo insuficiente en presupuesto de pasajes'; end if;
 insert into public.movimientos_presupuestarios(presupuesto_id,tipo,monto,referencia,viaje_id,objeto_gasto)
 values(p_presupuesto_viatico,'ejecucion',gasto_v,'Hoja de ruta '||v.nro_hoja_ruta,p_viaje,'2.2.2.10'),
 (p_presupuesto_pasaje,'ejecucion',gasto_p,'Hoja de ruta '||v.nro_hoja_ruta,p_viaje,'2.2.1.10');
 update public.viajes set estado='aprobado',presupuesto_viatico_id=p_presupuesto_viatico,presupuesto_pasaje_id=p_presupuesto_pasaje where id=p_viaje;
end $$;
revoke all on function public.aprobar_viaje(uuid,uuid,uuid) from public,anon;
grant execute on function public.aprobar_viaje(uuid,uuid,uuid) to authenticated;

-- Sólo se permite registrar gasto a través de aprobación validada; otras clases de movimiento se gestionan como administrador.
drop policy if exists movimientos_presupuestarios_write on public.movimientos_presupuestarios;
create policy movimientos_presupuestarios_admin_insert on public.movimientos_presupuestarios for insert to authenticated with check ((select private.is_admin()));
create policy movimientos_presupuestarios_admin_update on public.movimientos_presupuestarios for update to authenticated using ((select private.is_admin()) and tipo <> 'ejecucion') with check ((select private.is_admin()) and tipo <> 'ejecucion');
create policy movimientos_presupuestarios_admin_delete on public.movimientos_presupuestarios for delete to authenticated using ((select private.is_admin()) and tipo <> 'ejecucion');

create or replace view public.resumen_presupuestos with (security_invoker=true) as
 select p.id,p.gestion,p.codigo_programa,p.descripcion,p.objeto_gasto,p.monto_asignado,
 coalesce(sum(case when m.tipo='ejecucion' then m.monto else 0 end),0)::numeric(14,2) as gastado,
 coalesce(sum(case when m.tipo<>'ejecucion' then m.monto else 0 end),0)::numeric(14,2) as ajustes,
 (p.monto_asignado-coalesce(sum(m.monto),0))::numeric(14,2) as saldo
 from public.presupuestos p left join public.movimientos_presupuestarios m on m.presupuesto_id=p.id
 group by p.id;
grant select on public.resumen_presupuestos to authenticated;
