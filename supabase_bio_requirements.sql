create table if not exists public.bio_requirements (
  id uuid primary key default gen_random_uuid(),
  scientific_name text not null,
  common_name text not null default '',
  group_name text not null default '',
  water_conditions text,
  reef_compatible text,
  lighting text,
  flow text,
  temp_min_c double precision,
  temp_max_c double precision,
  sg_min double precision,
  sg_max double precision,
  ph_min double precision,
  ph_max double precision,
  dkh_min double precision,
  dkh_max double precision,
  source text not null default '',
  source_url text not null default '',
  scraped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scientific_name)
);

do $$
begin
  create trigger trg_bio_requirements_updated_at
    before update on public.bio_requirements
    for each row execute function public.update_updated_at();
exception
  when duplicate_object then null;
end $$;

alter table public.bio_requirements enable row level security;

drop policy if exists bio_requirements_read on public.bio_requirements;
create policy bio_requirements_read on public.bio_requirements
  for select
  to anon, authenticated
  using (true);

revoke all on table public.bio_requirements from anon;
revoke all on table public.bio_requirements from authenticated;
grant select on table public.bio_requirements to anon;
grant select on table public.bio_requirements to authenticated;

