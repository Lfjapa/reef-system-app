grant usage on schema public to anon, authenticated;

revoke all on table parameter_entries from anon;
revoke all on table bio_entries from anon;
revoke all on table bio_catalog from anon;
revoke all on table protocol_logs from anon;
revoke all on table protocol_definitions from anon;
revoke all on table protocol_checks from anon;
revoke all on table lighting_phases from anon;
revoke all on table user_parameter_settings from anon;

grant select, insert, update, delete on table parameter_entries to authenticated;
grant select, insert, update, delete on table bio_entries to authenticated;
grant select, insert, update, delete on table bio_catalog to authenticated;
grant select, insert, update, delete on table protocol_logs to authenticated;
grant select, insert, update, delete on table protocol_definitions to authenticated;
grant select, insert, update, delete on table protocol_checks to authenticated;
grant select, insert, update, delete on table lighting_phases to authenticated;
grant select, insert, update, delete on table user_parameter_settings to authenticated;
