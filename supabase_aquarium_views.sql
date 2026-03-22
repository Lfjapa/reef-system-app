create table if not exists public.parameter_dim (
  key text primary key,
  label text not null,
  unit text not null default '',
  min_ideal double precision,
  max_ideal double precision,
  critical_min double precision,
  critical_max double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  create trigger trg_parameter_dim_updated_at
    before update on public.parameter_dim
    for each row execute function public.update_updated_at();
exception
  when duplicate_object then null;
end $$;

alter table public.parameter_dim enable row level security;

drop policy if exists parameter_dim_read on public.parameter_dim;
create policy parameter_dim_read on public.parameter_dim
  for select
  to anon, authenticated
  using (true);

revoke all on table public.parameter_dim from anon;
revoke all on table public.parameter_dim from authenticated;
grant select on table public.parameter_dim to anon;
grant select on table public.parameter_dim to authenticated;

insert into public.parameter_dim (key, label, unit, min_ideal, max_ideal, critical_min, critical_max)
values
  ('kh', 'KH', 'dKH', 7, 9, 6.5, null),
  ('calcio', 'Cálcio', 'ppm', 420, 470, null, null),
  ('magnesio', 'Magnésio', 'ppm', 1250, 1400, null, null),
  ('salinidade', 'Salinidade', 'sg', 1.024, 1.026, null, null),
  ('temperatura', 'Temperatura', '°C', 24, 26, null, null),
  ('ph', 'pH', '', 7.9, 8.4, 7.8, 8.5)
on conflict (key) do nothing;

create or replace view public.v_sistema_seguro as
with candidates as (
  select
    b.user_id,
    b.scientific_name as bio_scientific_name,
    r.scientific_name as req_scientific_name,
    r.temp_min_c,
    r.temp_max_c,
    r.sg_min,
    r.sg_max,
    r.ph_min,
    r.ph_max,
    r.dkh_min,
    r.dkh_max
  from public.bio_entries b
  join public.bio_requirements r
    on lower(regexp_replace(trim(b.scientific_name), '^\s*([A-Za-z]+)\s+([A-Za-z\.-]+).*$','\1 \2')) =
       lower(regexp_replace(trim(r.scientific_name), '^\s*([A-Za-z]+)\s+([A-Za-z\.-]+).*$','\1 \2'))
  where b.scientific_name is not null
    and trim(b.scientific_name) <> ''
),
unpivoted as (
  select
    user_id,
    v.parameter_key as parameter,
    v.min_ideal,
    v.max_ideal
  from candidates
  cross join lateral (values
    ('temperatura', temp_min_c, temp_max_c),
    ('salinidade', sg_min, sg_max),
    ('ph', ph_min, ph_max),
    ('kh', dkh_min, dkh_max)
  ) as v(parameter_key, min_ideal, max_ideal)
  where v.min_ideal is not null and v.max_ideal is not null
)
select
  u.user_id,
  u.parameter,
  pd.label as parametro,
  pd.unit,
  max(u.min_ideal) as zona_minima_geral,
  min(u.max_ideal) as zona_maxima_geral
from unpivoted u
left join public.parameter_dim pd on pd.key = u.parameter
group by u.user_id, u.parameter, pd.label, pd.unit;

create or replace view public.v_taxa_consumo as
with ordered as (
  select
    user_id,
    parameter,
    value,
    measured_at,
    lag(value) over (partition by user_id, parameter order by measured_at) as prev_value,
    lag(measured_at) over (partition by user_id, parameter order by measured_at) as prev_measured_at
  from public.parameter_entries
)
select
  user_id,
  parameter,
  value as atual,
  prev_value as anterior,
  measured_at,
  prev_measured_at,
  value - prev_value as delta,
  extract(epoch from measured_at - prev_measured_at) / 86400.0 as days_between,
  case
    when prev_measured_at is null then null
    when extract(epoch from measured_at - prev_measured_at) <= 0 then null
    else (value - prev_value) / (extract(epoch from measured_at - prev_measured_at) / 86400.0)
  end as consumo_diario
from ordered
where prev_measured_at is not null;

revoke all on table public.v_sistema_seguro from anon;
revoke all on table public.v_sistema_seguro from authenticated;
grant select on table public.v_sistema_seguro to authenticated;

revoke all on table public.v_taxa_consumo from anon;
revoke all on table public.v_taxa_consumo from authenticated;
grant select on table public.v_taxa_consumo to authenticated;
