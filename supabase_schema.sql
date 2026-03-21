create extension if not exists "pgcrypto";

create table if not exists parameter_entries (
  id uuid primary key default gen_random_uuid(),
  parameter text not null,
  value double precision not null,
  measured_at timestamptz not null,
  note text not null default ''
);

create table if not exists bio_entries (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  name text not null,
  scientific_name text not null default '',
  position text not null default '',
  note text not null default '',
  created_at timestamptz not null
);

create table if not exists bio_catalog (
  primary_alias text primary key,
  aliases text[] not null default '{}',
  type text not null,
  scientific_name text not null default '',
  position text not null default '',
  note text not null default ''
);

create table if not exists protocol_logs (
  id uuid primary key default gen_random_uuid(),
  protocol_key text not null,
  performed_at timestamptz not null,
  note text not null default ''
);

create table if not exists protocol_definitions (
  protocol_key text primary key,
  label text not null,
  days int[] not null default '{}',
  quantity double precision,
  unit text not null default ''
);

create table if not exists protocol_checks (
  id uuid primary key default gen_random_uuid(),
  protocol_key text not null,
  week_start date not null,
  day_index int not null,
  checked_at timestamptz not null,
  quantity double precision,
  unit text not null default '',
  note text not null default '',
  unique (protocol_key, week_start, day_index)
);

create table if not exists lighting_phases (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  time time not null,
  uv int not null default 0,
  white int not null default 0,
  blue int not null default 0
);
