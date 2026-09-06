alter table public.rooms enable row level security;
alter table public.participants enable row level security;

revoke all on table public.rooms from anon, authenticated;
revoke all on table public.participants from anon, authenticated;

comment on table public.rooms is 'Ephemeral two-player rooms; accessed only through service-role Edge Functions.';
comment on table public.participants is 'Room slots containing SHA-256 participant token hashes; accessed only through service-role Edge Functions.';
