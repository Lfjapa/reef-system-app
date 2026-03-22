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

export type CloudSafeZone = {
  parameter: string
  zoneMin: number
  zoneMax: number
  unit: string
  label: string
}

export type CloudConsumptionRate = {
  parameter: string
  dailyRate: number
  measuredAt: string
}

export type CloudBioRequirement = {
  scientificName: string
  reefCompatible: string | null
  waterConditions: string | null
  lighting: string | null
  flow: string | null
  tempMinC: number | null
  tempMaxC: number | null
  sgMin: number | null
  sgMax: number | null
  phMin: number | null
  phMax: number | null
  dkhMin: number | null
  dkhMax: number | null
  source: string | null
  sourceUrl: string | null
}

const ensureClient = () => {
  if (!isSupabaseEnabled || !supabase) {
    throw new Error('Supabase desabilitado')
  }
  return supabase
}

const PAGE_SIZE = 1000

const asString = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback)

const asNumber = (value: unknown, fallback = 0) => {
  const candidate =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(candidate) ? candidate : fallback
}

const asOptionalNumber = (value: unknown) => {
  const candidate =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(candidate) ? candidate : null
}

const asStringArray = (value: unknown) => {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

const normalizeKey = (value: string | null) =>
  (value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const translateReefCompatible = (value: string | null) => {
  const key = normalizeKey(value)
  if (!key) return null
  if (key === 'yes') return 'Sim'
  if (key === 'no') return 'Não'
  if (key === 'with caution' || key === 'with-caution') return 'Com cautela'
  if (key === 'sim' || key === 'nao' || key === 'não' || key === 'com cautela') return value
  return value
}

const translateLighting = (value: string | null) => {
  const key = normalizeKey(value).replace(/\s+/g, ' ')
  if (!key) return null
  const dictionary: Record<string, string> = {
    high: 'Alta',
    moderate: 'Moderada',
    low: 'Baixa',
    medium: 'Média',
    'moderate to high': 'Moderada a alta',
    'high to moderate': 'Alta a moderada',
    'low to moderate': 'Baixa a moderada',
    'moderate to low': 'Moderada a baixa',
    'low to high': 'Baixa a alta',
  }
  return dictionary[key] ?? value
}

const translateFlow = (value: string | null) => {
  const key = normalizeKey(value).replace(/\s+/g, ' ')
  if (!key) return null
  const dictionary: Record<string, string> = {
    high: 'Alto',
    moderate: 'Moderado',
    low: 'Baixo',
    medium: 'Médio',
    'moderate to high': 'Moderado a alto',
    'high to moderate': 'Alto a moderado',
    'low to moderate': 'Baixo a moderado',
    'moderate to low': 'Moderado a baixo',
    'low to high': 'Baixo a alto',
  }
  return dictionary[key] ?? value
}

const translateWaterConditions = (value: string | null) => {
  if (!value) return null
  return value
    .replace(/With Caution/gi, 'Com cautela')
    .replace(/Yes/gi, 'Sim')
    .replace(/No/gi, 'Não')
}

const asNumberArray = (value: unknown) => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) =>
      typeof item === 'number' ? item : typeof item === 'string' ? Number(item) : NaN,
    )
    .filter((item) => Number.isFinite(item))
}

const fetchAllPages = async (
  table: string,
  options?: { order?: { column: string; ascending: boolean } },
) => {
  const client = ensureClient()
  const all: Record<string, unknown>[] = []
  let offset = 0
  for (;;) {
    let query = client.from(table).select('*')
    if (options?.order) {
      query = query.order(options.order.column, { ascending: options.order.ascending })
    }
    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1)
    if (error) throw error
    const page = (data ?? []) as Record<string, unknown>[]
    all.push(...page)
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return all
}

export const fetchCloudData = async () => {
  const [
    parameterRows,
    bioRows,
    catalogRows,
    protocolLogRows,
    protocolDefinitionRows,
    protocolCheckRows,
    lightingRows,
  ] = await Promise.all([
    fetchAllPages('parameter_entries', { order: { column: 'measured_at', ascending: true } }),
    fetchAllPages('bio_entries', { order: { column: 'created_at', ascending: false } }),
    fetchAllPages('bio_catalog', { order: { column: 'primary_alias', ascending: true } }),
    fetchAllPages('protocol_logs', { order: { column: 'performed_at', ascending: false } }),
    fetchAllPages('protocol_definitions', { order: { column: 'protocol_key', ascending: true } }),
    fetchAllPages('protocol_checks', { order: { column: 'checked_at', ascending: false } }),
    fetchAllPages('lighting_phases', { order: { column: 'time', ascending: true } }),
  ])

  const parameters: CloudParameterEntry[] = (parameterRows ?? []).map((row) => ({
    id: asString(row.id),
    parameter: asString(row.parameter),
    value: asNumber(row.value),
    measuredAt: asString(row.measured_at),
    note: asString(row.note),
  }))

  const bio: CloudBioEntry[] = (bioRows ?? []).map((row) => ({
    id: asString(row.id),
    type: asString(row.type),
    name: asString(row.name),
    scientificName: asString(row.scientific_name),
    position: asString(row.position),
    note: asString(row.note),
    createdAt: asString(row.created_at),
  }))

  const catalog: CloudCatalogEntry[] = (catalogRows ?? []).map((row) => ({
    aliases: asStringArray(row.aliases),
    type: asString(row.type),
    scientificName: asString(row.scientific_name),
    position: asString(row.position),
    note: asString(row.note),
  }))

  const protocolLogs: CloudProtocolLog[] = (protocolLogRows ?? []).map((row) => ({
    id: asString(row.id),
    protocolKey: asString(row.protocol_key),
    performedAt: asString(row.performed_at),
    note: asString(row.note),
  }))

  const protocolDefinitions: CloudProtocolDefinition[] = (protocolDefinitionRows ?? []).map(
    (row) => ({
      protocolKey: asString(row.protocol_key),
      label: asString(row.label),
      days: asNumberArray(row.days),
      quantity: asOptionalNumber(row.quantity),
      unit: asString(row.unit),
    }),
  )

  const protocolChecks: CloudProtocolCheck[] = (protocolCheckRows ?? []).map((row) => ({
    id: asString(row.id),
    protocolKey: asString(row.protocol_key),
    weekStart: asString(row.week_start),
    dayIndex: asNumber(row.day_index),
    checkedAt: asString(row.checked_at),
    quantity: asOptionalNumber(row.quantity),
    unit: asString(row.unit),
    note: asString(row.note),
  }))

  const lightingPhases: CloudLightingPhase[] = (lightingRows ?? []).map((row) => ({
    id: asString(row.id),
    name: asString(row.name),
    time: asString(row.time),
    uv: asNumber(row.uv),
    white: asNumber(row.white),
    blue: asNumber(row.blue),
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

export const fetchSafeZones = async () => {
  const overrides: Record<string, { min: number; max: number }> = {
    kh: { min: 7, max: 9 },
    salinidade: { min: 1.024, max: 1.027 },
    temperatura: { min: 25, max: 26.5 },
  }
  const client = ensureClient()
  const { data, error } = await client
    .from('v_sistema_seguro')
    .select('parameter, parametro, unit, zona_minima_geral, zona_maxima_geral')
  if (error) {
    if ((error as { code?: string } | null)?.code === 'PGRST205') return []
    throw error
  }
  const rows = (data ?? []) as Record<string, unknown>[]
  const mapped = rows
    .map((row) => ({
      parameter: asString(row.parameter),
      zoneMin: asNumber(row.zona_minima_geral),
      zoneMax: asNumber(row.zona_maxima_geral),
      unit: asString(row.unit),
      label: asString(row.parametro),
    }))
    .filter((row) => Boolean(row.parameter))
  const byKey = new Map(mapped.map((row) => [row.parameter, row]))
  for (const [parameter, override] of Object.entries(overrides)) {
    byKey.set(parameter, {
      parameter,
      zoneMin: override.min,
      zoneMax: override.max,
      unit: byKey.get(parameter)?.unit ?? '',
      label: byKey.get(parameter)?.label ?? parameter,
    })
  }
  return Array.from(byKey.values())
}

export const fetchConsumptionRates = async () => {
  const client = ensureClient()
  const { data, error } = await client
    .from('v_taxa_consumo')
    .select('parameter, consumo_diario, measured_at')
    .order('measured_at', { ascending: false })
    .limit(1000)
  if (error) {
    if ((error as { code?: string } | null)?.code === 'PGRST205') return []
    throw error
  }
  const rows = (data ?? []) as Record<string, unknown>[]
  return rows
    .map((row) => ({
      parameter: asString(row.parameter),
      dailyRate: asNumber(row.consumo_diario),
      measuredAt: asString(row.measured_at),
    }))
    .filter((row) => Boolean(row.parameter) && Number.isFinite(row.dailyRate))
}

export const fetchBioRequirementByScientificName = async (scientificName: string) => {
  const client = ensureClient()
  const trimmed = scientificName.trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(/\s+/g, ' ')
  const tokens = normalized.split(' ')
  const genusSpecies = tokens.length >= 2 ? `${tokens[0]} ${tokens[1]}` : normalized
  const pattern = `${genusSpecies}%`
  const { data, error } = await client
    .from('bio_requirements')
    .select(
      'scientific_name, reef_compatible, water_conditions, lighting, flow, temp_min_c, temp_max_c, sg_min, sg_max, ph_min, ph_max, dkh_min, dkh_max, source, source_url',
    )
    .ilike('scientific_name', pattern)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as Record<string, unknown>
  return {
    scientificName: asString(row.scientific_name),
    reefCompatible: translateReefCompatible(asString(row.reef_compatible, '') || null),
    waterConditions: translateWaterConditions(asString(row.water_conditions, '') || null),
    lighting: translateLighting(asString(row.lighting, '') || null),
    flow: translateFlow(asString(row.flow, '') || null),
    tempMinC: asOptionalNumber(row.temp_min_c),
    tempMaxC: asOptionalNumber(row.temp_max_c),
    sgMin: asOptionalNumber(row.sg_min),
    sgMax: asOptionalNumber(row.sg_max),
    phMin: asOptionalNumber(row.ph_min),
    phMax: asOptionalNumber(row.ph_max),
    dkhMin: asOptionalNumber(row.dkh_min),
    dkhMax: asOptionalNumber(row.dkh_max),
    source: asString(row.source, '') || null,
    sourceUrl: asString(row.source_url, '') || null,
  }
}

export const fetchBioDeepDiveByEntryId = async (entryId: string) => {
  const client = ensureClient()
  const { data, error } = await client
    .from('v_bio_deep_dive')
    .select(
      'bio_entry_id, catalog_primary_alias, catalog_aliases, catalog_type, catalog_scientific_name, catalog_position, catalog_note, req_scientific_name, common_name, group_name, reef_compatible, water_conditions, lighting, flow, temp_min_c, temp_max_c, sg_min, sg_max, ph_min, ph_max, dkh_min, dkh_max, source, source_url',
    )
    .eq('bio_entry_id', entryId)
    .maybeSingle()

  if (error) {
    if ((error as { code?: string } | null)?.code === 'PGRST205') return null
    throw error
  }
  if (!data) return null
  const row = data as Record<string, unknown>

  const reqScientificName = asString(row.req_scientific_name, '') || null
  const hasCatalog =
    Boolean(asString(row.catalog_primary_alias, '')) ||
    Boolean(asString(row.catalog_scientific_name, '')) ||
    (Array.isArray(row.catalog_aliases) && row.catalog_aliases.length > 0)
  return {
    catalog: hasCatalog
      ? {
          aliases: asStringArray(row.catalog_aliases),
          type: asString(row.catalog_type, 'peixe') as 'peixe' | 'coral' | 'invertebrado',
          scientificName: asString(row.catalog_scientific_name, ''),
          position: asString(row.catalog_position, ''),
          note: asString(row.catalog_note, ''),
        }
      : null,
    requirement: reqScientificName
      ? {
          scientificName: reqScientificName,
          reefCompatible: translateReefCompatible(asString(row.reef_compatible, '') || null),
          waterConditions: translateWaterConditions(asString(row.water_conditions, '') || null),
          lighting: translateLighting(asString(row.lighting, '') || null),
          flow: translateFlow(asString(row.flow, '') || null),
          tempMinC: asOptionalNumber(row.temp_min_c),
          tempMaxC: asOptionalNumber(row.temp_max_c),
          sgMin: asOptionalNumber(row.sg_min),
          sgMax: asOptionalNumber(row.sg_max),
          phMin: asOptionalNumber(row.ph_min),
          phMax: asOptionalNumber(row.ph_max),
          dkhMin: asOptionalNumber(row.dkh_min),
          dkhMax: asOptionalNumber(row.dkh_max),
          source: asString(row.source, '') || null,
          sourceUrl: asString(row.source_url, '') || null,
        }
      : null,
  }
}

export const fetchBioDeepDivePreviews = async () => {
  const client = ensureClient()
  const { data, error } = await client
    .from('v_bio_deep_dive')
    .select('bio_entry_id, reef_compatible, lighting, flow')

  if (error) {
    if ((error as { code?: string } | null)?.code === 'PGRST205') return []
    throw error
  }

  const rows = (data ?? []) as Record<string, unknown>[]
  return rows
    .map((row) => ({
      entryId: asString(row.bio_entry_id),
      reefCompatible: translateReefCompatible(asString(row.reef_compatible, '') || null),
      lighting: translateLighting(asString(row.lighting, '') || null),
      flow: translateFlow(asString(row.flow, '') || null),
    }))
    .filter((row) => Boolean(row.entryId))
}

export const upsertCloudParameters = async (entries: CloudParameterEntry[], userId: string) => {
  if (entries.length === 0) return
  const client = ensureClient()
  const { error } = await client.from('parameter_entries').upsert(
    entries.map((entry) => ({
      id: entry.id,
      user_id: userId,
      parameter: entry.parameter,
      value: entry.value,
      measured_at: entry.measuredAt,
      note: entry.note,
    })),
  )
  if (error) throw error
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

export const upsertCloudBios = async (entries: CloudBioEntry[], userId: string) => {
  if (entries.length === 0) return
  const client = ensureClient()
  const { error } = await client.from('bio_entries').upsert(
    entries.map((entry) => ({
      id: entry.id,
      user_id: userId,
      type: entry.type,
      name: entry.name,
      scientific_name: entry.scientificName,
      position: entry.position,
      note: entry.note,
      created_at: entry.createdAt,
    })),
  )
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

export const upsertCloudCatalogEntries = async (entries: CloudCatalogEntry[], userId: string) => {
  if (entries.length === 0) return
  const client = ensureClient()
  const { error } = await client.from('bio_catalog').upsert(
    entries.map((entry) => ({
      user_id: userId,
      primary_alias: entry.aliases[0] ?? entry.scientificName,
      aliases: entry.aliases,
      type: entry.type,
      scientific_name: entry.scientificName,
      position: entry.position,
      note: entry.note,
    })),
  )
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

export const upsertCloudProtocolLogs = async (entries: CloudProtocolLog[], userId: string) => {
  if (entries.length === 0) return
  const client = ensureClient()
  const { error } = await client.from('protocol_logs').upsert(
    entries.map((entry) => ({
      id: entry.id,
      user_id: userId,
      protocol_key: entry.protocolKey,
      performed_at: entry.performedAt,
      note: entry.note,
    })),
  )
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

export const upsertCloudProtocolDefinitions = async (
  entries: CloudProtocolDefinition[],
  userId: string,
) => {
  if (entries.length === 0) return
  const client = ensureClient()
  const { error } = await client.from('protocol_definitions').upsert(
    entries.map((entry) => ({
      user_id: userId,
      protocol_key: entry.protocolKey,
      label: entry.label,
      days: entry.days,
      quantity: entry.quantity,
      unit: entry.unit,
    })),
  )
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

export const upsertCloudProtocolChecks = async (entries: CloudProtocolCheck[], userId: string) => {
  if (entries.length === 0) return
  const client = ensureClient()
  const { error } = await client.from('protocol_checks').upsert(
    entries.map((entry) => ({
      id: entry.id,
      user_id: userId,
      protocol_key: entry.protocolKey,
      week_start: entry.weekStart,
      day_index: entry.dayIndex,
      checked_at: entry.checkedAt,
      quantity: entry.quantity,
      unit: entry.unit,
      note: entry.note,
    })),
  )
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

export const upsertCloudLightingPhases = async (
  entries: CloudLightingPhase[],
  userId: string,
) => {
  if (entries.length === 0) return
  const client = ensureClient()
  const { error } = await client.from('lighting_phases').upsert(
    entries.map((entry) => ({
      id: entry.id,
      user_id: userId,
      name: entry.name,
      time: entry.time,
      uv: entry.uv,
      white: entry.white,
      blue: entry.blue,
    })),
  )
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
