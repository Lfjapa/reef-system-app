select 'bio_requirements' as object, count(*) as rows from public.bio_requirements;

select 'parameter_dim' as object, count(*) as rows from public.parameter_dim;

select
  user_id,
  parameter,
  parametro,
  unit,
  zona_minima_geral,
  zona_maxima_geral
from public.v_sistema_seguro
order by user_id, parameter
limit 50;

select
  user_id,
  parameter,
  atual,
  anterior,
  measured_at,
  consumo_diario
from public.v_taxa_consumo
order by measured_at desc
limit 50;

