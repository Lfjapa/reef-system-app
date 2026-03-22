create index if not exists idx_parameter_entries_user_parameter_measured_at
  on public.parameter_entries (user_id, parameter, measured_at desc);

create index if not exists idx_bio_entries_user_type
  on public.bio_entries (user_id, type);

create index if not exists idx_protocol_logs_user_protocol_key_performed_at
  on public.protocol_logs (user_id, protocol_key, performed_at desc);

create index if not exists idx_protocol_checks_user_week_start
  on public.protocol_checks (user_id, week_start);

create index if not exists idx_bio_catalog_aliases_gin
  on public.bio_catalog using gin (aliases);

do $$
begin
  alter table public.parameter_entries
    add constraint parameter_value_range check (value >= -50 and value <= 100000);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.protocol_checks
    add constraint protocol_checks_day_index_range check (day_index between 0 and 6);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.lighting_phases
    add constraint lighting_channels_positive check (uv >= 0 and white >= 0 and blue >= 0);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.protocol_definitions
    add constraint protocol_definitions_days_valid check (
      array_length(days, 1) is null
      or days <@ array[0, 1, 2, 3, 4, 5, 6]
    );
exception
  when duplicate_object then null;
end $$;

create or replace function public.update_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.parameter_entries
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.bio_entries
  add column if not exists updated_at timestamptz not null default now();

alter table public.bio_catalog
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.protocol_logs
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.protocol_definitions
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.protocol_checks
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.lighting_phases
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  create trigger trg_parameter_entries_updated_at
    before update on public.parameter_entries
    for each row execute function public.update_updated_at();
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create trigger trg_bio_entries_updated_at
    before update on public.bio_entries
    for each row execute function public.update_updated_at();
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create trigger trg_bio_catalog_updated_at
    before update on public.bio_catalog
    for each row execute function public.update_updated_at();
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create trigger trg_protocol_logs_updated_at
    before update on public.protocol_logs
    for each row execute function public.update_updated_at();
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create trigger trg_protocol_definitions_updated_at
    before update on public.protocol_definitions
    for each row execute function public.update_updated_at();
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create trigger trg_protocol_checks_updated_at
    before update on public.protocol_checks
    for each row execute function public.update_updated_at();
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create trigger trg_lighting_phases_updated_at
    before update on public.lighting_phases
    for each row execute function public.update_updated_at();
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.protocol_logs
    add constraint protocol_logs_definition_fkey
    foreign key (user_id, protocol_key)
    references public.protocol_definitions (user_id, protocol_key)
    on delete cascade
    not valid;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.protocol_checks
    add constraint protocol_checks_definition_fkey
    foreign key (user_id, protocol_key)
    references public.protocol_definitions (user_id, protocol_key)
    on delete cascade
    not valid;
exception
  when duplicate_object then null;
end $$;
