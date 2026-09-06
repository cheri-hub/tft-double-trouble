do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;

    if not exists (select 1 from cron.job where jobname = 'room-cleanup-every-minute') then
      perform cron.schedule(
        'room-cleanup-every-minute',
        '* * * * *',
        $command$select public.room_cleanup();$command$
      );
    end if;
  else
    raise warning 'pg_cron is unavailable; schedule the room-cleanup Edge Function to run every minute during deployment';
  end if;
end;
$$;

comment on function public.room_cleanup(timestamptz) is
  'Deletes expired rooms. Invoked every minute by pg_cron when available; deployments without pg_cron must schedule the room-cleanup Edge Function every minute.';
