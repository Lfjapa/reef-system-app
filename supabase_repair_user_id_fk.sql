do $$
declare
  tbl text;
  con record;
begin
  foreach tbl in array array[
    'parameter_entries',
    'bio_entries',
    'bio_catalog',
    'protocol_logs',
    'protocol_definitions',
    'protocol_checks',
    'lighting_phases'
  ]
  loop
    execute format('alter table if exists public.%I add column if not exists user_id uuid', tbl);

    for con in
      select c.conname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = tbl
        and c.contype = 'f'
        and exists (
          select 1
          from unnest(c.conkey) as k(attnum)
          join pg_attribute a on a.attrelid = t.oid and a.attnum = k.attnum
          where a.attname = 'user_id'
        )
    loop
      execute format('alter table public.%I drop constraint if exists %I', tbl, con.conname);
    end loop;

    execute format(
      'alter table public.%I add constraint %I foreign key (user_id) references auth.users(id) on delete cascade not valid',
      tbl,
      tbl || '_user_id_fkey'
    );
  end loop;
end $$;
