create or replace view public.v_bio_deep_dive as
with bio as (
  select
    b.user_id,
    b.id,
    b.type,
    b.name,
    b.scientific_name,
    b.position,
    b.note,
    b.created_at,
    case
      when n.genus is null or n.species is null then null
      else lower(n.genus) || ' ' || lower(n.species)
    end as bio_key_full,
    case
      when n.genus is null then null
      else lower(n.genus)
    end as bio_key_genus,
    lower(trim(b.name)) as bio_name_key
  from public.bio_entries b
  cross join lateral (
    with cleaned as (
      select
        trim(
          regexp_replace(
            regexp_replace(
              regexp_replace(coalesce(b.scientific_name, ''), '\([^)]*\)', ' ', 'g'),
              '[/,;]+',
              ' ',
              'g'
            ),
            '\s+',
            ' ',
            'g'
          )
        ) as raw
    ),
    tokens as (
      select regexp_split_to_array(raw, '\s+') as parts, raw
      from cleaned
    ),
    norm as (
      select
        nullif(regexp_replace(parts[1], '[^A-Za-z\.-]', '', 'g'), '') as genus_raw,
        nullif(regexp_replace(parts[2], '[^A-Za-z\.-]', '', 'g'), '') as w2_raw,
        nullif(regexp_replace(parts[3], '[^A-Za-z\.-]', '', 'g'), '') as w3_raw,
        raw
      from tokens
    )
    select
      genus_raw as genus,
      case
        when genus_raw is null then null
        when raw ~ '^[A-Z][a-z]+\s+[A-Z][a-z]+\s*,\s*\d{4}\s*$' then null
        when raw ~ '^[A-Z][a-z]+\s+(de|da|do|dos|das)\s+[A-Z][a-z]+\s*,\s*\d{4}\s*$' then null
        when lower(coalesce(w2_raw, '')) in ('sp', 'sp.', 'spp', 'spp.', 'cf', 'cf.', 'aff', 'aff.', 'x') then null
        when lower(coalesce(w2_raw, '')) in ('de', 'da', 'do', 'dos', 'das') then
          case
            when lower(coalesce(w3_raw, '')) in ('sp', 'sp.', 'spp', 'spp.', 'cf', 'cf.', 'aff', 'aff.', 'x') then null
            when w3_raw is null then null
            when w3_raw ~ '^\d+$' then null
            else w3_raw
          end
        when w2_raw is null then null
        when w2_raw ~ '^\d+$' then null
        else w2_raw
      end as species
    from norm
  ) n
),
catalog_ranked as (
  select
    bio.user_id,
    bio.id as bio_entry_id,
    c.primary_alias,
    c.aliases,
    c.type as catalog_type,
    c.scientific_name as catalog_scientific_name,
    c.position as catalog_position,
    c.note as catalog_note,
    case
      when n.genus is null or n.species is null then null
      else lower(n.genus) || ' ' || lower(n.species)
    end as catalog_key_full,
    case
      when n.genus is null then null
      else lower(n.genus)
    end as catalog_key_genus,
    row_number() over (
      partition by bio.user_id, bio.id
      order by
        case
          when exists (
            select 1 from unnest(c.aliases) a where lower(a) = bio.bio_name_key
          ) then 0
          else 1
        end,
        case
          when bio.bio_key_full is not null and n.genus is not null and n.species is not null
            and (lower(n.genus) || ' ' || lower(n.species)) = bio.bio_key_full then 0
          else 1
        end,
        c.primary_alias
    ) as rn
  from bio
  left join public.bio_catalog c
    on c.user_id = bio.user_id
  cross join lateral (
    with cleaned as (
      select
        trim(
          regexp_replace(
            regexp_replace(
              regexp_replace(coalesce(c.scientific_name, ''), '\([^)]*\)', ' ', 'g'),
              '[/,;]+',
              ' ',
              'g'
            ),
            '\s+',
            ' ',
            'g'
          )
        ) as raw
    ),
    tokens as (
      select regexp_split_to_array(raw, '\s+') as parts, raw
      from cleaned
    ),
    norm as (
      select
        nullif(regexp_replace(parts[1], '[^A-Za-z\.-]', '', 'g'), '') as genus_raw,
        nullif(regexp_replace(parts[2], '[^A-Za-z\.-]', '', 'g'), '') as w2_raw,
        nullif(regexp_replace(parts[3], '[^A-Za-z\.-]', '', 'g'), '') as w3_raw,
        raw
      from tokens
    )
    select
      genus_raw as genus,
      case
        when genus_raw is null then null
        when raw ~ '^[A-Z][a-z]+\s+[A-Z][a-z]+\s*,\s*\d{4}\s*$' then null
        when raw ~ '^[A-Z][a-z]+\s+(de|da|do|dos|das)\s+[A-Z][a-z]+\s*,\s*\d{4}\s*$' then null
        when lower(coalesce(w2_raw, '')) in ('sp', 'sp.', 'spp', 'spp.', 'cf', 'cf.', 'aff', 'aff.', 'x') then null
        when lower(coalesce(w2_raw, '')) in ('de', 'da', 'do', 'dos', 'das') then
          case
            when lower(coalesce(w3_raw, '')) in ('sp', 'sp.', 'spp', 'spp.', 'cf', 'cf.', 'aff', 'aff.', 'x') then null
            when w3_raw is null then null
            when w3_raw ~ '^\d+$' then null
            else w3_raw
          end
        when w2_raw is null then null
        when w2_raw ~ '^\d+$' then null
        else w2_raw
      end as species
    from norm
  ) n
),
catalog as (
  select
    user_id,
    bio_entry_id,
    primary_alias,
    aliases,
    catalog_type,
    catalog_scientific_name,
    catalog_position,
    catalog_note,
    catalog_key_full,
    catalog_key_genus
  from catalog_ranked
  where rn = 1
),
final as (
  select
    bio.user_id,
    bio.id as bio_entry_id,
    bio.type,
    bio.name,
    bio.scientific_name,
    bio.position,
    bio.note,
    bio.created_at,
    catalog.primary_alias as catalog_primary_alias,
    catalog.aliases as catalog_aliases,
    catalog.catalog_type,
    catalog.catalog_scientific_name,
    catalog.catalog_position,
    catalog.catalog_note,
    coalesce(bio.bio_key_full, catalog.catalog_key_full) as join_key_full,
    coalesce(bio.bio_key_genus, catalog.catalog_key_genus) as join_key_genus
  from bio
  left join catalog
    on catalog.user_id = bio.user_id
   and catalog.bio_entry_id = bio.id
)
select
  final.user_id,
  final.bio_entry_id,
  final.type,
  final.name,
  final.scientific_name,
  final.position,
  final.note,
  final.created_at,
  final.catalog_primary_alias,
  final.catalog_aliases,
  final.catalog_type,
  final.catalog_scientific_name,
  final.catalog_position,
  final.catalog_note,
  r.scientific_name as req_scientific_name,
  r.common_name,
  r.group_name,
  r.reef_compatible,
  r.water_conditions,
  r.lighting,
  r.flow,
  r.temp_min_c,
  r.temp_max_c,
  r.sg_min,
  r.sg_max,
  r.ph_min,
  r.ph_max,
  r.dkh_min,
  r.dkh_max,
  r.source,
  r.source_url,
  r.difficulty,
  r.min_tank_liters,
  r.behavior_notes,
  r.aggression_level,
  r.compatible_species,
  r.territory_type,
  r.predator_risk,
  r.prey_risk
from final
left join lateral (
  select rr.*
  from public.bio_requirements rr
  cross join lateral (
    with cleaned as (
      select
        trim(
          regexp_replace(
            regexp_replace(
              regexp_replace(coalesce(rr.scientific_name, ''), '\([^)]*\)', ' ', 'g'),
              '[/,;]+',
              ' ',
              'g'
            ),
            '\s+',
            ' ',
            'g'
          )
        ) as raw
    ),
    tokens as (
      select regexp_split_to_array(raw, '\s+') as parts
      from cleaned
    ),
    norm as (
      select
        nullif(lower(regexp_replace(parts[1], '[^A-Za-z\.-]', '', 'g')), '') as genus,
        nullif(lower(regexp_replace(parts[2], '[^A-Za-z\.-]', '', 'g')), '') as species
      from tokens
    )
    select
      genus,
      case
        when species in ('sp', 'sp.', 'spp', 'spp.', 'cf', 'cf.', 'aff', 'aff.', 'x') then null
        else species
      end as species
    from norm
  ) n
  where n.genus is not null
    and (
      (final.join_key_full is not null and n.species is not null and (n.genus || ' ' || n.species) = final.join_key_full)
      or
      (final.join_key_full is null and final.join_key_genus is not null and n.species is null and n.genus = final.join_key_genus)
    )
  order by
    case
      when final.join_key_full is not null and n.species is not null and (n.genus || ' ' || n.species) = final.join_key_full then 0
      else 1
    end,
    rr.updated_at desc nulls last,
    rr.created_at desc
  limit 1
) r on true;

revoke all on table public.v_bio_deep_dive from anon;
revoke all on table public.v_bio_deep_dive from authenticated;
grant select on table public.v_bio_deep_dive to authenticated;
