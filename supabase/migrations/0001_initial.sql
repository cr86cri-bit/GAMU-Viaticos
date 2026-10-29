-- GAMU 2026: aplicar en un proyecto Supabase nuevo desde SQL Editor.
create extension if not exists pgcrypto;
create schema if not exists private;
create table public.perfiles (id uuid primary key references auth.users(id) on delete cascade, nombre text not null default '', rol text not null default 'consulta' check(rol in ('admin','operador','consulta')), activo boolean not null default false, created_at timestamptz not null default now());
create or replace function private.can_read() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.perfiles p where p.id=(select auth.uid()) and p.activo)$$;
create or replace function private.can_write() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.perfiles p where p.id=(select auth.uid()) and p.activo and p.rol in ('admin','operador'))$$;
create or replace function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.perfiles p where p.id=(select auth.uid()) and p.activo and p.rol='admin')$$;
revoke all on function private.can_read(),private.can_write(),private.is_admin() from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.can_read(),private.can_write(),private.is_admin() to authenticated;
create table public.cargos (id uuid primary key default gen_random_uuid(),nombre text not null unique,descripcion text,created_at timestamptz not null default now());
create table public.categorias (id uuid primary key default gen_random_uuid(),nombre text not null unique,nivel integer not null unique check(nivel between 1 and 4),descripcion text,created_at timestamptz not null default now());
create table public.destinos (id uuid primary key default gen_random_uuid(),nombre text not null unique,departamento text,descripcion text,created_at timestamptz not null default now());
create table public.funcionarios (id uuid primary key default gen_random_uuid(),ci text not null unique,nombres text not null,apellidos text not null,cargo_id uuid references public.cargos(id),categoria_id uuid references public.categorias(id),calidad_servidor text,tipo_contrato text,dependencia text,activo boolean not null default true,created_at timestamptz not null default now());
create table public.tarifas_viaticos (id uuid primary key default gen_random_uuid(),categoria_id uuid not null references public.categorias(id),destino_id uuid not null references public.destinos(id),monto_base numeric(14,2) not null check(monto_base>=0),vigente_desde date not null,vigente_hasta date,observacion text,created_at timestamptz not null default now(),check(vigente_hasta is null or vigente_hasta>=vigente_desde),unique(categoria_id,destino_id,vigente_desde));
create table public.viajes (id uuid primary key default gen_random_uuid(),funcionario_id uuid not null references public.funcionarios(id),destino_id uuid not null references public.destinos(id),nro_hoja_ruta text not null,fecha_inicio date not null,fecha_fin date not null,motivo text not null,descripcion text,estado text not null default 'borrador' check(estado in ('borrador','revision','aprobado','anulado')),creado_por uuid not null default auth.uid() references auth.users(id),created_at timestamptz not null default now(),check(fecha_fin>=fecha_inicio));
create table public.viaje_dias (id uuid primary key default gen_random_uuid(),viaje_id uuid not null references public.viajes(id) on delete cascade,fecha date not null,porcentaje numeric(5,2) not null default 100 check(porcentaje between 0 and 100),viatico_dia numeric(14,2) not null default 0,total_viatico numeric(14,2) not null default 0,rciva_ajuste numeric(14,2) not null default 0,viatico_neto numeric(14,2) not null default 0,pasaje_factura numeric(14,2) not null default 0 check(pasaje_factura>=0),pasaje_recibo numeric(14,2) not null default 0 check(pasaje_recibo>=0),iue_retencion numeric(14,2) not null default 0,it_retencion numeric(14,2) not null default 0,pasaje_neto numeric(14,2) not null default 0,liquido_pagable numeric(14,2) not null default 0,observacion text,created_at timestamptz not null default now(),unique(viaje_id,fecha));
create table public.comprobantes (id uuid primary key default gen_random_uuid(),viaje_dia_id uuid not null references public.viaje_dias(id) on delete cascade,tipo text not null check(tipo in('hospedaje','pasaje_factura','pasaje_recibo','otro')),numero text,monto numeric(14,2) not null check(monto>=0),ruta_archivo text,created_at timestamptz not null default now());
create table public.presupuestos (id uuid primary key default gen_random_uuid(),gestion integer not null,codigo_programa text not null,descripcion text not null,objeto_gasto text not null check(objeto_gasto in('2.2.1.10','2.2.2.10')),monto_asignado numeric(14,2) not null check(monto_asignado>=0),created_at timestamptz not null default now(),unique(gestion,codigo_programa,objeto_gasto));
create table public.movimientos_presupuestarios (id uuid primary key default gen_random_uuid(),presupuesto_id uuid not null references public.presupuestos(id),tipo text not null check(tipo in('ejecucion','ajuste','reversion')),monto numeric(14,2) not null,referencia text,fecha date not null default current_date,creado_por uuid default auth.uid() references auth.users(id),created_at timestamptz not null default now());
create table public.planillas (id uuid primary key default gen_random_uuid(),gestion integer not null,nro_daf text,descripcion text,fecha date not null default current_date,estado text not null default 'borrador' check(estado in ('borrador','aprobada','anulada')),creado_por uuid not null default auth.uid() references auth.users(id),created_at timestamptz not null default now());
create table public.planilla_viajes (planilla_id uuid not null references public.planillas(id) on delete cascade,viaje_id uuid not null references public.viajes(id),primary key(planilla_id,viaje_id));
create table public.auditoria (id bigint generated always as identity primary key,usuario_id uuid,tabla text not null,accion text not null,registro_id text,datos jsonb,fecha timestamptz not null default now());
create index ix_viaje_dias_viaje on public.viaje_dias(viaje_id);create index ix_viajes_funcionario on public.viajes(funcionario_id);create index ix_tarifas on public.tarifas_viaticos(categoria_id,destino_id,vigente_desde);
-- Importes diarios calculados en servidor. RC-IVA es AJUSTE MANUAL hasta tener reglamento oficial validado.
create or replace function private.calcular_dia() returns trigger language plpgsql security invoker set search_path='' as $$
declare v public.viajes%rowtype; c uuid; tarifa numeric(14,2); n integer;
begin
 select * into v from public.viajes where id=new.viaje_id;
 if not found then raise exception 'Viaje inexistente';end if;
 if v.estado<>'borrador' then raise exception 'Solo se pueden modificar viajes en borrador';end if;
 if new.fecha<v.fecha_inicio or new.fecha>v.fecha_fin then raise exception 'Fecha fuera del rango del viaje';end if;
 select categoria_id into c from public.funcionarios where id=v.funcionario_id;
 if c is null then raise exception 'Funcionario sin categoría';end if;
 select count(*) into n from public.tarifas_viaticos t where t.categoria_id=c and t.destino_id=v.destino_id and new.fecha>=t.vigente_desde and (t.vigente_hasta is null or new.fecha<=t.vigente_hasta);
 if n<>1 then raise exception 'Se requiere exactamente una tarifa vigente para la categoría, destino y fecha (encontradas: %)',n;end if;
 select monto_base into tarifa from public.tarifas_viaticos t where t.categoria_id=c and t.destino_id=v.destino_id and new.fecha>=t.vigente_desde and (t.vigente_hasta is null or new.fecha<=t.vigente_hasta);
 new.viatico_dia:=round(tarifa*new.porcentaje/100,2);
 new.total_viatico:=new.viatico_dia; -- Cada fila representa un día.
 new.viatico_neto:=round(new.total_viatico-new.rciva_ajuste,2);
 new.iue_retencion:=round(new.pasaje_recibo*0.13,2);
 new.it_retencion:=round(new.pasaje_recibo*0.03,2);
 new.pasaje_neto:=round(new.pasaje_factura+new.pasaje_recibo-new.iue_retencion-new.it_retencion,2);
 new.liquido_pagable:=round(new.viatico_neto+new.pasaje_neto,2);
 return new;
end $$;
create trigger trg_calcular_dia before insert or update on public.viaje_dias for each row execute function private.calcular_dia();
-- Evita editar registros ya revisados; también se aplica a DELETE.
create or replace function private.proteger_dia() returns trigger language plpgsql security invoker set search_path='' as $$
declare s text;begin select estado into s from public.viajes where id=old.viaje_id;if s <> 'borrador' then raise exception 'Viaje bloqueado';end if;return old;end $$;
create trigger trg_proteger_dia before delete on public.viaje_dias for each row execute function private.proteger_dia();
-- Evita cambios de funcionario/destino en un viaje con días ya registrados.
create or replace function private.proteger_viaje() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.estado <> 'borrador' and (new.funcionario_id is distinct from old.funcionario_id or new.destino_id is distinct from old.destino_id or new.fecha_inicio is distinct from old.fecha_inicio or new.fecha_fin is distinct from old.fecha_fin) then raise exception 'Viaje no editable';end if;
 if (new.funcionario_id is distinct from old.funcionario_id or new.destino_id is distinct from old.destino_id) and exists(select 1 from public.viaje_dias where viaje_id=old.id) then raise exception 'El viaje ya tiene días: elimínelos antes de cambiar funcionario o destino';end if;
 if new.estado is distinct from old.estado and not (select private.is_admin()) then raise exception 'Solo admin cambia el estado del viaje';end if;
 return new;end $$;
create trigger trg_proteger_viaje before update on public.viajes for each row execute function private.proteger_viaje();
-- Roles y políticas.
alter table public.perfiles enable row level security;
alter table public.cargos enable row level security;
alter table public.categorias enable row level security;
alter table public.destinos enable row level security;
alter table public.funcionarios enable row level security;
alter table public.tarifas_viaticos enable row level security;
alter table public.viajes enable row level security;
alter table public.viaje_dias enable row level security;
alter table public.comprobantes enable row level security;
alter table public.presupuestos enable row level security;
alter table public.movimientos_presupuestarios enable row level security;
alter table public.planillas enable row level security;
alter table public.planilla_viajes enable row level security;
alter table public.auditoria enable row level security;
create policy perfiles_select on public.perfiles for select to authenticated using ((select private.is_admin()) or id=(select auth.uid()));
create policy perfiles_admin_insert on public.perfiles for insert to authenticated with check ((select private.is_admin()));
create policy perfiles_admin_update on public.perfiles for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy perfiles_admin_delete on public.perfiles for delete to authenticated using ((select private.is_admin()));
do $$declare t text;begin foreach t in array array['cargos','categorias','destinos','funcionarios','tarifas_viaticos','presupuestos'] loop
 execute format('create policy %I on public.%I for select to authenticated using ((select private.can_read()))',t||'_read',t);
 execute format('create policy %I on public.%I for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))',t||'_admin',t);
 end loop;end$$;
-- Operadores pueden registrar datos de funcionarios; los catálogos tarifarios permanecen admin.
create policy funcionarios_operador_insert on public.funcionarios for insert to authenticated with check ((select private.can_write()));
create policy funcionarios_operador_update on public.funcionarios for update to authenticated using ((select private.can_write())) with check ((select private.can_write()));
create policy viajes_read on public.viajes for select to authenticated using ((select private.can_read()));
create policy viajes_insert on public.viajes for insert to authenticated with check ((select private.can_write()) and creado_por=auth.uid());
create policy viajes_update on public.viajes for update to authenticated using ((select private.can_write())) with check ((select private.can_write()));
create policy viajes_delete on public.viajes for delete to authenticated using ((select private.is_admin()) and estado='borrador');
create policy dias_read on public.viaje_dias for select to authenticated using ((select private.can_read()));
create policy dias_insert on public.viaje_dias for insert to authenticated with check ((select private.can_write()));
create policy dias_update on public.viaje_dias for update to authenticated using ((select private.can_write())) with check ((select private.can_write()));
create policy dias_delete on public.viaje_dias for delete to authenticated using ((select private.can_write()));
do $$declare t text;begin foreach t in array array['comprobantes','movimientos_presupuestarios','planillas','planilla_viajes'] loop
 execute format('create policy %I on public.%I for select to authenticated using ((select private.can_read()))',t||'_read',t);
 execute format('create policy %I on public.%I for all to authenticated using ((select private.can_write())) with check ((select private.can_write()))',t||'_write',t);
 end loop;end$$;
create policy audit_read on public.auditoria for select to authenticated using ((select private.is_admin()));
-- Restricción adicional para la tabla de auditoría: no permite operaciones directas de clientes.
revoke insert,update,delete on public.auditoria from anon,authenticated;
-- Bucket privado para respaldos; las políticas de acceso deben acotarse al rol y carpeta del proyecto.
insert into storage.buckets(id,name,public) values('respaldos','respaldos',false) on conflict (id) do nothing;
-- No se crea una política de upload universal; implementar por usuario/expediente y validación de archivo.
-- ALTA DEL PRIMER ADMINISTRADOR: crear usuario desde Authentication -> Users y ejecutar manualmente:
-- insert into public.perfiles(id,nombre,rol,activo) values ('UUID_DE_AUTH_USERS','Administrador','admin',true);
