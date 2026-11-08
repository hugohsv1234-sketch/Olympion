begin;
create schema if not exists olympion_private;
revoke all on schema olympion_private from public,anon,authenticated;
create table olympion_private.ranking_key (
  singleton boolean primary key default true check(singleton),
  digest bytea not null check(octet_length(digest)=32)
);
revoke all on olympion_private.ranking_key from public,anon,authenticated;

create table public.player_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check(length(btrim(display_name)) between 1 and 32 and display_name !~ '[[:cntrl:]]'),
  avatar_path text check(avatar_path is null or avatar_path=user_id::text||'/avatar.webp'),
  elo bigint not null default 0 check(elo>=0),
  puzzles_solved integer not null default 0 check(puzzles_solved>=0),
  bots_won integer not null default 0 check(bots_won>=0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.player_profiles enable row level security;
create policy profiles_public_read on public.player_profiles for select to anon,authenticated using(true);
create policy profiles_update_self on public.player_profiles for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
revoke all on public.player_profiles from public,anon,authenticated;
grant select on public.player_profiles to anon,authenticated;
grant update(display_name,avatar_path) on public.player_profiles to authenticated;
grant all on public.player_profiles to service_role;
create or replace function public.touch_player_profile() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at:=clock_timestamp();return new;end $$;
create trigger touch_profile before update on public.player_profiles for each row execute function public.touch_player_profile();

create or replace function olympion_private.create_verified_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.email_confirmed_at is not null then
    insert into public.player_profiles(user_id,display_name) values(new.id,coalesce(nullif(left(btrim(regexp_replace(coalesce(new.raw_user_meta_data->>'display_name',''), '[[:cntrl:]]','','g')),32),''),'Spieler-'||left(new.id::text,6))) on conflict(user_id) do nothing;
  end if;
  return new;
end $$;
revoke all on function olympion_private.create_verified_profile() from public,anon,authenticated;
create trigger create_player_profile after insert or update of email_confirmed_at on auth.users for each row execute function olympion_private.create_verified_profile();
insert into public.player_profiles(user_id,display_name) select id,coalesce(nullif(left(btrim(regexp_replace(coalesce(raw_user_meta_data->>'display_name',''),'[[:cntrl:]]','','g')),32),''),'Spieler-'||left(id::text,6)) from auth.users where email_confirmed_at is not null on conflict(user_id) do nothing;

create or replace function public.ensure_player_profile() returns setof public.player_profiles language plpgsql security invoker set search_path='' as $$
begin
  return query select * from public.player_profiles where user_id=(select auth.uid());
  if not found then raise exception 'Bitte bestätige zuerst deine E-Mail-Adresse.';end if;
end $$;
revoke all on function public.ensure_player_profile() from public,anon;
grant execute on function public.ensure_player_profile() to authenticated;

create view public.leaderboard with(security_invoker=true) as
select row_number() over(order by elo desc,created_at asc,user_id asc) as rank,user_id,display_name,avatar_path,elo,puzzles_solved,bots_won,created_at,updated_at from public.player_profiles;
grant select on public.leaderboard to anon,authenticated;

create table public.elo_events (
  user_id uuid not null references public.player_profiles(user_id) on delete cascade,
  kind text not null check(kind in ('puzzle','bot')),
  source_key text not null check(length(source_key) between 1 and 100),
  points smallint not null check(points between 1 and 20),
  created_at timestamptz not null default now(),
  primary key(user_id,kind,source_key)
);
alter table public.elo_events enable row level security;
create policy own_elo_history on public.elo_events for select to authenticated using((select auth.uid())=user_id);
revoke all on public.elo_events from public,anon,authenticated;
grant select on public.elo_events to authenticated;
grant all on public.elo_events to service_role;

create table public.ranked_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.player_profiles(user_id) on delete cascade,
  level smallint not null check(level between 1 and 20),
  color text not null check(color in ('w','b')),
  moves jsonb not null default '[]'::jsonb check(jsonb_typeof(moves)='array' and jsonb_array_length(moves)<=500),
  result text check(result in ('1-0','0-1','½-½','*')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ranked_games_owner on public.ranked_games(user_id,created_at desc);
alter table public.ranked_games enable row level security;
create policy own_ranked_games on public.ranked_games for select to authenticated using((select auth.uid())=user_id);
revoke all on public.ranked_games from public,anon,authenticated;
grant select on public.ranked_games to authenticated;
grant all on public.ranked_games to service_role;

create or replace function public.award_verified_elo(player uuid,event_kind text,source text,bot_level integer default 1) returns integer language plpgsql security definer set search_path='' as $$
declare reward integer; inserted integer;
begin
  if not exists(select 1 from auth.users where id=player and email_confirmed_at is not null) then raise exception 'Bestätigtes Konto erforderlich';end if;
  if event_kind='puzzle' then reward:=1;
  elsif event_kind='bot' and bot_level between 1 and 20 and exists(select 1 from public.ranked_games where id::text=source and user_id=player and level=bot_level and result=case color when 'w' then '1-0' else '0-1' end) then reward:=round(3+(bot_level-1)*17.0/19)::integer;
  else raise exception 'Ungültige Elo-Belohnung';end if;
  insert into public.elo_events(user_id,kind,source_key,points) values(player,event_kind,source,reward) on conflict do nothing;
  get diagnostics inserted=row_count;
  if inserted=0 then return 0;end if;
  update public.player_profiles set elo=elo+reward,puzzles_solved=puzzles_solved+case event_kind when 'puzzle' then 1 else 0 end,bots_won=bots_won+case event_kind when 'bot' then 1 else 0 end where user_id=player;
  return reward;
end $$;
revoke all on function public.award_verified_elo(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.award_verified_elo(uuid,text,text,integer) to service_role;

create or replace function public.start_ranked_game(player uuid,bot_level integer,player_color text) returns setof public.ranked_games language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(player::text,0));
  if not exists(select 1 from auth.users where id=player and email_confirmed_at is not null) then raise exception 'Bestätigtes Konto erforderlich';end if;
  if (select count(*) from public.ranked_games where user_id=player and created_at>now()-interval '1 hour')>=60 then raise exception 'Bitte warte, bevor du weitere Ranglistenpartien startest.';end if;
  update public.ranked_games set result='*',updated_at=now() where user_id=player and result is null;
  return query insert into public.ranked_games(user_id,level,color) values(player,bot_level,player_color) returning *;
end $$;
revoke all on function public.start_ranked_game(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.start_ranked_game(uuid,integer,text) to service_role;

create or replace function public.commit_ranked_game(player uuid,game_id uuid,expected_ply integer,new_moves jsonb,new_result text) returns integer language plpgsql security definer set search_path='' as $$
declare game public.ranked_games;reward integer:=0;
begin
  select * into game from public.ranked_games where id=game_id and user_id=player for update;
  if game.id is null then raise exception 'Partie nicht gefunden';end if;
  if game.result is not null then
    if game.moves=new_moves and game.result=new_result then return 0;end if;
    raise exception 'Diese Partie ist bereits beendet';
  end if;
  if jsonb_array_length(game.moves)<>expected_ply then raise exception 'Die Partie wurde bereits weitergespielt';end if;
  if jsonb_typeof(new_moves)<>'array' or jsonb_array_length(new_moves)>500 or jsonb_array_length(new_moves)<expected_ply then raise exception 'Ungültige Zugfolge';end if;
  update public.ranked_games set moves=new_moves,result=new_result,updated_at=now() where id=game_id;
  if new_result=(case game.color when 'w' then '1-0' else '0-1' end) then reward:=public.award_verified_elo(player,'bot',game_id::text,game.level);end if;
  return reward;
end $$;
revoke all on function public.commit_ranked_game(uuid,uuid,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.commit_ranked_game(uuid,uuid,integer,jsonb,text) to service_role;

-- Only the game server has this credential. The authenticated JWT supplies
-- the player ID and ordinary RLS still applies to all direct table access.
create function olympion_private.ranked_write(action text,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  player uuid := auth.uid();
  credential text := current_setting('request.headers',true)::jsonb->>'x-olympion-ranking-key';
  started uuid;
begin
  if player is null or credential is null or not exists(
    select 1 from olympion_private.ranking_key
    where digest=sha256(convert_to(credential,'UTF8'))
  ) then
    raise exception 'Ranglisten-Server nicht autorisiert' using errcode='42501';
  end if;
  case action
    when 'puzzle' then
      return to_jsonb(public.award_verified_elo(player,'puzzle',payload->>'puzzle_id',1));
    when 'start' then
      select id into strict started from public.start_ranked_game(
        player,(payload->>'level')::integer,payload->>'color');
      return to_jsonb(started);
    when 'commit' then
      return to_jsonb(public.commit_ranked_game(
        player,(payload->>'game_id')::uuid,(payload->>'expected_ply')::integer,
        payload->'moves',payload->>'result'));
    else
      raise exception 'Unbekannte Ranglistenaktion';
  end case;
end $$;
revoke all on function olympion_private.ranked_write(text,jsonb) from public,anon,authenticated;
grant usage on schema olympion_private to authenticated;
grant execute on function olympion_private.ranked_write(text,jsonb) to authenticated;

create function public.ranked_write(action text,payload jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select olympion_private.ranked_write(action,payload)
$$;
revoke all on function public.ranked_write(text,jsonb) from public,anon,authenticated;
grant execute on function public.ranked_write(text,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('avatars','avatars',true,150000,array['image/webp']) on conflict(id) do update set public=true,file_size_limit=150000,allowed_mime_types=array['image/webp'];
create policy avatar_read on storage.objects for select to anon,authenticated using(bucket_id='avatars');
create policy avatar_insert_self on storage.objects for insert to authenticated with check(bucket_id='avatars' and name=(select auth.uid())::text||'/avatar.webp');
create policy avatar_update_self on storage.objects for update to authenticated using(bucket_id='avatars' and name=(select auth.uid())::text||'/avatar.webp') with check(bucket_id='avatars' and name=(select auth.uid())::text||'/avatar.webp');
commit;
