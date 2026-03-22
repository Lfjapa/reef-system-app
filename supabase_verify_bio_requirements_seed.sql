select count(*) as total_bio_requirements from public.bio_requirements;

select scientific_name, count(*) as n
from public.bio_requirements
group by scientific_name
having count(*) > 1
order by n desc, scientific_name;

select
  scientific_name,
  common_name,
  group_name,
  reef_compatible,
  lighting,
  flow,
  temp_min_c,
  temp_max_c,
  sg_min,
  sg_max,
  dkh_min,
  dkh_max,
  water_conditions,
  source,
  scraped_at
from public.bio_requirements
order by updated_at desc nulls last, created_at desc
limit 25;

select *
from public.v_sistema_seguro
order by user_id, parameter;
