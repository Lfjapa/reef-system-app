do $$
begin
  if exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.protocol_checks'::regclass
      and c.conname = 'protocol_checks_user_key_week_day_unique'
  ) then
    alter table public.protocol_checks
      drop constraint protocol_checks_user_key_week_day_unique;
  end if;

  if exists (
    select 1
    from pg_class i
    join pg_namespace n on n.oid = i.relnamespace
    where n.nspname = 'public'
      and i.relname = 'protocol_checks_user_key_week_day_unique'
      and i.relkind = 'i'
  ) then
    execute 'drop index public.protocol_checks_user_key_week_day_unique';
  end if;

  alter table public.protocol_checks
    add constraint protocol_checks_user_key_week_day_unique unique (user_id, protocol_key, week_start, day_index);
exception
  when duplicate_object then null;
end $$;

