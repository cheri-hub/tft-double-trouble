alter table public.participants
  add column champion_list jsonb not null default '[]'::jsonb,
  add column component_list jsonb not null default '[]'::jsonb,
  add column lists_updated_at timestamptz,
  add constraint participant_champion_list_array check (jsonb_typeof(champion_list) = 'array'),
  add constraint participant_component_list_array check (jsonb_typeof(component_list) = 'array');

comment on column public.participants.champion_list is 'Ordered champion IDs confirmed by the server.';
comment on column public.participants.component_list is 'Ordered component IDs confirmed by the server.';
