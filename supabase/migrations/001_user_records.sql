begin;
create table if not exists public.user_records (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null check (id ~ '^[A-Za-z0-9:._-]{1,180}$'),
  kind text not null check (kind in ('settings','attempt','game','analysis','lesson','review','session','mistake')),
  payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text)<5000000),
  client_updated_at bigint not null check (client_updated_at>=0),
  device_id uuid not null,
  server_updated_at timestamptz not null default now(),
  primary key(user_id,id)
);
alter table public.user_records enable row level security;
create policy records_select_own on public.user_records for select to authenticated using ((select auth.uid())=user_id);
create policy records_insert_own on public.user_records for insert to authenticated with check ((select auth.uid())=user_id);
create policy records_update_own on public.user_records for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
revoke all on public.user_records from anon, public;
grant select,insert,update on public.user_records to authenticated;

create or replace function public.valid_record_payload(k text,p jsonb) returns boolean language plpgsql immutable as $$
begin
  if jsonb_typeof(p)<>'object' or octet_length(p::text)>5000000 then return false; end if;
  case k
    when 'settings' then return jsonb_typeof(p->'name')='string' and length(p->>'name')<=60 and p->>'goal' in ('10','20','30') and jsonb_typeof(p->'motion')='boolean' and jsonb_typeof(p->'sound')='boolean';
    when 'attempt' then return jsonb_typeof(p->'puzzleId')='string' and length(p->>'puzzleId')<180 and jsonb_typeof(p->'success')='boolean' and jsonb_typeof(p->'themes')='array' and (p->>'rating')::numeric between 0 and 4000 and (p->>'seconds')::numeric between 0 and 31536000 and (p->>'errors')::numeric between 0 and 100000 and (p->>'hints')::numeric between 0 and 3 and (p->>'at')::numeric>=0;
    when 'game' then return jsonb_typeof(p->'initialFen')='string' and length(p->>'initialFen')<150 and jsonb_typeof(p->'moves')='array' and jsonb_array_length(p->'moves')<=500 and not exists(select 1 from jsonb_array_elements_text(p->'moves') m where m !~ '^[a-h][1-8][a-h][1-8][qrbn]?$') and (p->>'level')::int between 1 and 20 and p->>'color' in ('w','b') and jsonb_typeof(p->'remaining')='object';
    when 'analysis' then return jsonb_typeof(p->'results')='array' and jsonb_array_length(p->'results')<=500 and jsonb_typeof(p->'moves')='array' and jsonb_array_length(p->'moves')<=500 and (p->>'budget')::int between 1000 and 5000000;
    when 'lesson' then return jsonb_typeof(p->'lessonId')='string' and jsonb_typeof(p->'completed')='boolean';
    when 'session' then return (p->>'seconds')::numeric between 0 and 86400 and (p->>'at')::numeric>=0;
    when 'mistake' then return jsonb_typeof(p->'moves')='array' and jsonb_array_length(p->'moves')<=500 and p->>'answer' ~ '^[a-h][1-8][a-h][1-8][qrbn]?$';
    when 'review' then return (p->>'quality')::numeric between 0 and 100 and jsonb_typeof(p->'move')='string';
    else return false;
  end case;
exception when others then return false;
end $$;

create or replace function public.sync_records(rows jsonb) returns void language plpgsql security invoker set search_path=public as $$
declare row jsonb; k text; p jsonb; stamp bigint;
begin
  if auth.uid() is null then raise exception 'Anmeldung erforderlich'; end if;
  if jsonb_typeof(rows)<>'array' or jsonb_array_length(rows)>50 or octet_length(rows::text)>10000000 then raise exception 'Ungültiges Synchronisierungspaket'; end if;
  for row in select * from jsonb_array_elements(rows) loop
    k:=row->>'kind'; p:=row->'payload'; stamp:=(row->>'client_updated_at')::bigint;
    if not coalesce(public.valid_record_payload(k,p),false) or stamp>(extract(epoch from clock_timestamp())*1000)::bigint+86400000 then raise exception 'Ungültiger Datensatz'; end if;
    insert into public.user_records(user_id,id,kind,payload,client_updated_at,device_id)
      values(auth.uid(),row->>'id',k,p,stamp,(row->>'device_id')::uuid)
    on conflict(user_id,id) do update set kind=excluded.kind,payload=excluded.payload,client_updated_at=excluded.client_updated_at,device_id=excluded.device_id,server_updated_at=now()
      where (excluded.client_updated_at,excluded.device_id::text)>(user_records.client_updated_at,user_records.device_id::text);
  end loop;
end $$;
revoke all on function public.sync_records(jsonb) from public,anon;
grant execute on function public.sync_records(jsonb) to authenticated;

-- Auch direkte Tabellenzugriffe validieren; RPC ist kein Umgehen der RLS.
create or replace function public.guard_record() returns trigger language plpgsql as $$
begin
  if not coalesce(public.valid_record_payload(new.kind,new.payload),false) or new.client_updated_at>(extract(epoch from clock_timestamp())*1000)::bigint+86400000 then raise exception 'Ungültiger Datensatz'; end if;
  new.server_updated_at:=now();return new;
end $$;
create trigger validate_user_record before insert or update on public.user_records for each row execute function public.guard_record();
commit;
