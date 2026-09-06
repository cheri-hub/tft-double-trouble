create extension if not exists pgcrypto;

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_both_offline_at timestamptz,
  expires_at timestamptz,
  constraint rooms_expiry_pair check (
    (last_both_offline_at is null and expires_at is null)
    or (
      last_both_offline_at is not null
      and expires_at = last_both_offline_at + interval '15 minutes'
    )
  )
);

create table public.participants (
  room_id uuid not null references public.rooms(id) on delete cascade,
  slot smallint not null check (slot in (1, 2)),
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  last_seen_at timestamptz not null default now(),
  online boolean not null default true,
  primary key (room_id, slot),
  unique (room_id, token_hash)
);

create index rooms_expires_at_idx on public.rooms (expires_at) where expires_at is not null;

create or replace function public.room_create(p_token_hash text, p_now timestamptz default now())
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
begin
  insert into rooms (created_at) values (p_now) returning id into v_room_id;
  insert into participants (room_id, slot, token_hash, last_seen_at, online)
  values (v_room_id, 1, p_token_hash, p_now, true);
  return v_room_id;
end;
$$;

create or replace function public.room_join(p_room_id uuid, p_token_hash text, p_now timestamptz default now())
returns smallint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room rooms%rowtype;
  v_slot smallint;
begin
  select * into v_room from rooms where id = p_room_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'room_not_found';
  end if;
  if v_room.expires_at is not null and v_room.expires_at <= p_now then
    raise exception using errcode = 'P0001', message = 'room_expired';
  end if;

  select candidate into v_slot
  from unnest(array[1, 2]::smallint[]) as candidate
  where not exists (
    select 1 from participants where room_id = p_room_id and slot = candidate
  )
  order by candidate
  limit 1;

  if v_slot is null then
    raise exception using errcode = 'P0001', message = 'room_full';
  end if;

  insert into participants (room_id, slot, token_hash, last_seen_at, online)
  values (p_room_id, v_slot, p_token_hash, p_now, true);
  update rooms set last_both_offline_at = null, expires_at = null where id = p_room_id;
  return v_slot;
end;
$$;

create or replace function public.room_leave(p_room_id uuid, p_token_hash text, p_now timestamptz default now())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed integer;
begin
  perform 1 from rooms where id = p_room_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'room_not_found';
  end if;

  update participants
  set online = false, last_seen_at = p_now
  where room_id = p_room_id and token_hash = p_token_hash;
  get diagnostics v_changed = row_count;
  if v_changed = 0 then
    raise exception using errcode = 'P0001', message = 'participant_not_found';
  end if;

  if not exists (select 1 from participants where room_id = p_room_id and online) then
    update rooms
    set last_both_offline_at = coalesce(last_both_offline_at, p_now),
        expires_at = coalesce(expires_at, p_now + interval '15 minutes')
    where id = p_room_id;
  end if;
end;
$$;

create or replace function public.room_heartbeat(p_room_id uuid, p_token_hash text, p_now timestamptz default now())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expiry timestamptz;
  v_changed integer;
begin
  select expires_at into v_expiry from rooms where id = p_room_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'room_not_found';
  end if;
  if v_expiry is not null and v_expiry <= p_now then
    raise exception using errcode = 'P0001', message = 'room_expired';
  end if;

  update participants
  set online = true, last_seen_at = p_now
  where room_id = p_room_id and token_hash = p_token_hash;
  get diagnostics v_changed = row_count;
  if v_changed = 0 then
    raise exception using errcode = 'P0001', message = 'participant_not_found';
  end if;

  update rooms set last_both_offline_at = null, expires_at = null where id = p_room_id;
end;
$$;

create or replace function public.room_cleanup(p_now timestamptz default now())
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted bigint;
begin
  delete from rooms where expires_at is not null and expires_at <= p_now;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.room_create(text, timestamptz) from public;
revoke all on function public.room_join(uuid, text, timestamptz) from public;
revoke all on function public.room_leave(uuid, text, timestamptz) from public;
revoke all on function public.room_heartbeat(uuid, text, timestamptz) from public;
revoke all on function public.room_cleanup(timestamptz) from public;
revoke all on function public.room_create(text, timestamptz) from anon, authenticated;
revoke all on function public.room_join(uuid, text, timestamptz) from anon, authenticated;
revoke all on function public.room_leave(uuid, text, timestamptz) from anon, authenticated;
revoke all on function public.room_heartbeat(uuid, text, timestamptz) from anon, authenticated;
revoke all on function public.room_cleanup(timestamptz) from anon, authenticated;
grant execute on function public.room_create(text, timestamptz) to service_role;
grant execute on function public.room_join(uuid, text, timestamptz) to service_role;
grant execute on function public.room_leave(uuid, text, timestamptz) to service_role;
grant execute on function public.room_heartbeat(uuid, text, timestamptz) to service_role;
grant execute on function public.room_cleanup(timestamptz) to service_role;
