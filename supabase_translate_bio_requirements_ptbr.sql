update public.bio_requirements
set reef_compatible = case
  when lower(trim(reef_compatible)) = 'yes' then 'Sim'
  when lower(trim(reef_compatible)) = 'no' then 'Não'
  when lower(trim(reef_compatible)) in ('with caution', 'with-caution') then 'Com cautela'
  else reef_compatible
end
where reef_compatible is not null;

update public.bio_requirements
set lighting = case lower(trim(lighting))
  when 'high' then 'Alta'
  when 'moderate' then 'Moderada'
  when 'low' then 'Baixa'
  when 'medium' then 'Média'
  when 'moderate to high' then 'Moderada a alta'
  when 'high to moderate' then 'Alta a moderada'
  when 'low to moderate' then 'Baixa a moderada'
  when 'moderate to low' then 'Moderada a baixa'
  when 'low to high' then 'Baixa a alta'
  else lighting
end
where lighting is not null;

update public.bio_requirements
set flow = case lower(trim(flow))
  when 'high' then 'Alto'
  when 'moderate' then 'Moderado'
  when 'low' then 'Baixo'
  when 'medium' then 'Médio'
  when 'moderate to high' then 'Moderado a alto'
  when 'high to moderate' then 'Alto a moderado'
  when 'low to moderate' then 'Baixo a moderado'
  when 'moderate to low' then 'Moderado a baixo'
  when 'low to high' then 'Baixo a alto'
  else flow
end
where flow is not null;

update public.bio_requirements
set water_conditions = replace(replace(replace(water_conditions, 'With Caution', 'Com cautela'), 'Yes', 'Sim'), 'No', 'Não')
where water_conditions is not null;
