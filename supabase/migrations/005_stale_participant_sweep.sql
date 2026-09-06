create index if not exists participants_online_last_seen_idx
  on public.participants (last_seen_at)
  where online;

create or replace function public.room_cleanup(p_now timestamptz default now())
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted bigint;
begin
  update participants
  set online = false
  where online and last_seen_at <= p_now - interval '60 seconds';

  update rooms as room
  set last_both_offline_at = p_now,
      expires_at = p_now + interval '15 minutes'
  where room.expires_at is null
    and exists (select 1 from participants where room_id = room.id)
    and not exists (select 1 from participants where room_id = room.id and online);

  delete from rooms where expires_at is not null and expires_at <= p_now;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

comment on function public.room_cleanup(timestamptz) is
  'Marks participants offline after 60 seconds without a heartbeat, starts the 15-minute all-offline deadline, and deletes expired rooms.';
