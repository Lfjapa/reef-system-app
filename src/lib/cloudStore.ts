import { isSupabaseEnabled, supabase } from './supabase'

export type CloudParameterEntry = {
  id: string
  parameter: string
  value: number
  measuredAt: string
  note: string
}

export type CloudBioEntry = {
  id: string
  type: string
  name: string
  scientificName: string
  position: string
  note: string
  createdAt: string
}

export type CloudCatalogEntry = {
  aliases: string[]
  type: string
  scientificName: string
  position: string
  note: string
}

export type CloudProtocolLog = {
  id: string
  protocolKey: string
  performedAt: string
  note: string
}

export type CloudProtocolDefinition = {
  protocolKey: string
  label: string
  days: number[]
  quantity: number | null
  unit: string
}

export type CloudProtocolCheck = {
  id: string
  protocolKey: string
  weekStart: string
  dayIndex: number
  checkedAt: string
  quantity: number | null
  unit: string
  note: string
}

export type CloudLightingPhase = {
  id: string
  name: string
  time: string
  uv: number
  white: number
  blue: number
}

const ensureClient = () => {
  if (!isSupabaseEnabled || !supabase) {
    throw new Error('Supabase desabilitado')
  }
  return supabase
}

export const fetchCloudData = async () => {
  const client = ensureClient()
  const [
    parameterResult,
    bioResult,
    catalogResult,
    protocolResult,
    protocolDefResult,
    protocolCheckResult,
    lightingResult,
  ] = await Promise.all([
    client.from('parameter_entries').select('*').order('measured_at', { ascending: true }),
    client.from('bio_entries').select('*').order('created_at', { ascending: false }),
    client.from('bio_catalog').select('*'),
    client.from('protocol_logs').select('*').order('performed_at', { ascending: false }),
    client.from('protocol_definitions').select('*'),
    client.from('protocol_checks').select('*').order('checked_at', { ascending: false }),
    client.from('lighting_phases').select('*').order('time', { ascending: true }),
  ])
  if (parameterResult.error) throw parameterResult.error
  if (bioResult.error) throw bioResult.error
  if (catalogResult.error) throw catalogResult.error
  if (protocolResult.error) throw protocolResult.error
  if (protocolDefResult.error) throw protocolDefResult.error
  if (protocolCheckResult.error) throw protocolCheckResult.error
  if (lightingResult.error) throw lightingResult.error

  const parameters: CloudParameterEntry[] = (parameterResult.data ?? []).map((row) => ({
    id: row.id,
    parameter: row.parameter,
    value: Number(row.value),
    measuredAt: row.measured_at,
    note: row.note ?? '',
  }))

  const bio: CloudBioEntry[] = (bioResult.data ?? []).map((row) => ({
    id: row.id,
    type: row.type,
    name: row.name,
    scientificName: row.scientific_name ?? '',
    position: row.position ?? '',
    note: row.note ?? '',
    createdAt: row.created_at,
  }))

  const catalog: CloudCatalogEntry[] = (catalogResult.data ?? []).map((row) => ({
    aliases: Array.isArray(row.aliases) ? row.aliases : [],
    type: row.type,
    scientificName: row.scientific_name ?? '',
    position: row.position ?? '',
    note: row.note ?? '',
  }))

  const protocolLogs: CloudProtocolLog[] = (protocolResult.data ?? []).map((row) => ({
    id: row.id,
    protocolKey: row.protocol_key,
    performedAt: row.performed_at,
    note: row.note ?? '',
  }))

  const protocolDefinitions: CloudProtocolDefinition[] = (protocolDefResult.data ?? []).map(
    (row) => ({
      protocolKey: row.protocol_key,
      label: row.label,
      days: Array.isArray(row.days) ? row.days : [],
      quantity: row.quantity ?? null,
      unit: row.unit ?? '',
    }),
  )

  const protocolChecks: CloudProtocolCheck[] = (protocolCheckResult.data ?? []).map((row) => ({
    id: row.id,
    protocolKey: row.protocol_key,
    weekStart: row.week_start,
    dayIndex: Number(row.day_index),
    checkedAt: row.checked_at,
    quantity: row.quantity ?? null,
    unit: row.unit ?? '',
    note: row.note ?? '',
  }))

  const lightingPhases: CloudLightingPhase[] = (lightingResult.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    time: row.time,
    uv: Number(row.uv ?? 0),
    white: Number(row.white ?? 0),
    blue: Number(row.blue ?? 0),
  }))

  return {
    parameters,
    bio,
    catalog,
    protocolLogs,
    protocolDefinitions,
    protocolChecks,
    lightingPhases,
  }
}

export const upsertCloudParameter = async (entry: CloudParameterEntry, userId: string) => {
  const client = ensureClient()
  const { error } = await client.from('parameter_entries').upsert({
    id: entry.id,
    user_id: userId,
    parameter: entry.parameter,
    value: entry.value,
    measured_at: entry.measuredAt,
    note: entry.note,
  })
  if (error) throw error
}

export const deleteCloudParameter = async (id: string) => {
  const client = ensureClient()
  const { error } = await client.from('parameter_entries').delete().eq('id', id)
  if (error) throw error
}

export const upsertCloudBio = async (entry: CloudBioEntry, userId: string) => {
  const client = ensureClient()
  const { error } = await client.from('bio_entries').upsert({
    id: entry.id,
    user_id: userId,
    type: entry.type,
    name: entry.name,
    scientific_name: entry.scientificName,
    position: entry.position,
    note: entry.note,
    created_at: entry.createdAt,
  })
  if (error) throw error
}

export const deleteCloudBio = async (id: string) => {
  const client = ensureClient()
  const { error } = await client.from('bio_entries').delete().eq('id', id)
  if (error) throw error
}

export const upsertCloudCatalog = async (entry: CloudCatalogEntry, userId: string) => {
  const client = ensureClient()
  const primaryAlias = entry.aliases[0] ?? entry.scientificName
  const { error } = await client.from('bio_catalog').upsert({
    user_id: userId,
    primary_alias: primaryAlias,
    aliases: entry.aliases,
    type: entry.type,
    scientific_name: entry.scientificName,
    position: entry.position,
    note: entry.note,
  })
  if (error) throw error
}

export const upsertCloudProtocolLog = async (entry: CloudProtocolLog, userId: string) => {
  const client = ensureClient()
  const { error } = await client.from('protocol_logs').upsert({
    id: entry.id,
    user_id: userId,
    protocol_key: entry.protocolKey,
    performed_at: entry.performedAt,
    note: entry.note,
  })
  if (error) throw error
}

export const deleteCloudProtocolLog = async (id: string) => {
  const client = ensureClient()
  const { error } = await client.from('protocol_logs').delete().eq('id', id)
  if (error) throw error
}

export const upsertCloudProtocolDefinition = async (
  entry: CloudProtocolDefinition,
  userId: string,
) => {
  const client = ensureClient()
  const { error } = await client.from('protocol_definitions').upsert({
    user_id: userId,
    protocol_key: entry.protocolKey,
    label: entry.label,
    days: entry.days,
    quantity: entry.quantity,
    unit: entry.unit,
  })
  if (error) throw error
}

export const upsertCloudProtocolCheck = async (entry: CloudProtocolCheck, userId: string) => {
  const client = ensureClient()
  const { error } = await client.from('protocol_checks').upsert({
    id: entry.id,
    user_id: userId,
    protocol_key: entry.protocolKey,
    week_start: entry.weekStart,
    day_index: entry.dayIndex,
    checked_at: entry.checkedAt,
    quantity: entry.quantity,
    unit: entry.unit,
    note: entry.note,
  })
  if (error) throw error
}

export const deleteCloudProtocolCheck = async (id: string) => {
  const client = ensureClient()
  const { error } = await client.from('protocol_checks').delete().eq('id', id)
  if (error) throw error
}

export const deleteCloudProtocolDefinition = async (protocolKey: string) => {
  const client = ensureClient()
  const { error } = await client
    .from('protocol_definitions')
    .delete()
    .eq('protocol_key', protocolKey)
  if (error) throw error
}

export const deleteCloudProtocolChecksByKey = async (protocolKey: string) => {
  const client = ensureClient()
  const { error } = await client
    .from('protocol_checks')
    .delete()
    .eq('protocol_key', protocolKey)
  if (error) throw error
}

export const deleteCloudProtocolLogsByKey = async (protocolKey: string) => {
  const client = ensureClient()
  const { error } = await client.from('protocol_logs').delete().eq('protocol_key', protocolKey)
  if (error) throw error
}

export const upsertCloudLightingPhase = async (
  entry: CloudLightingPhase,
  userId: string,
) => {
  const client = ensureClient()
  const { error } = await client.from('lighting_phases').upsert({
    id: entry.id,
    user_id: userId,
    name: entry.name,
    time: entry.time,
    uv: entry.uv,
    white: entry.white,
    blue: entry.blue,
  })
  if (error) throw error
}

export const deleteCloudLightingPhase = async (id: string) => {
  const client = ensureClient()
  const { error } = await client.from('lighting_phases').delete().eq('id', id)
  if (error) throw error
}
