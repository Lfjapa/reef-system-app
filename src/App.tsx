import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import './App.css'
import Header from './components/shared/Header'
import ParameterAlertModal from './components/shared/ParameterAlertModal'
import SettingsModal from './components/shared/SettingsModal'
import DashboardTab from './components/Dashboard/DashboardTab'
import ParametersTab from './components/Parameters/ParametersTab'
import ProtocolsTab from './components/Protocols/ProtocolsTab'
import LightingTab from './components/Lighting/LightingTab'
import InventoryTab from './components/Inventory/InventoryTab'
import AnimalDetailsModal from './components/Inventory/AnimalDetailsModal'
import TankSettingsTab from './components/Settings/TankSettingsTab'
import {
  defaultLightingPhasesData,
  defaultProtocolDefinitionsData,
  parameterDefinitionsData,
  seedBioCatalogData,
} from './data/defaults'
import { useCloudWriteQueue } from './hooks/useCloudWriteQueue'
import { isSupabaseEnabled } from './lib/supabase'
import { logError } from './lib/log'
import { idbDel, idbGet, idbSet } from './lib/idb'
import {
  deleteCloudBio,
  deleteCloudLightingPhase,
  deleteCloudParameter,
  deleteCloudProtocolCheck,
  deleteCloudProtocolChecksByKey,
  deleteCloudProtocolDefinition,
  deleteCloudProtocolLog,
  deleteCloudProtocolLogsByKey,
  fetchCloudData,
  fetchBioDeepDiveByEntryId,
  fetchBioDeepDivePreviews,
  fetchBioRequirementByScientificName,
  fetchConsumptionRates,
  fetchSafeZones,
  upsertCloudBio,
  upsertCloudBios,
  upsertCloudCatalog,
  upsertCloudCatalogEntries,
  upsertCloudParameter,
  upsertCloudParameters,
  upsertCloudProtocolCheck,
  upsertCloudProtocolChecks,
  upsertCloudProtocolDefinition,
  upsertCloudProtocolDefinitions,
  upsertCloudProtocolLog,
  upsertCloudProtocolLogs,
  upsertCloudLightingPhase,
  upsertCloudLightingPhases,
  upsertCloudUserParameterSettings,
} from './lib/cloudStore'
import { getSession, onAuthStateChange, signInWithGoogle, signOut } from './lib/auth'

type ParameterKey = string

type ParameterEntry = {
  id: string
  parameter: ParameterKey
  value: number
  measuredAt: string
  note: string
}

type ParameterDefinition = {
  key: ParameterKey
  label: string
  unit: string
  min?: number
  max?: number
}

type TankParameterSetting = {
  parameter: ParameterKey
  isCustomEnabled: boolean
  customMin: number | null
  customMax: number | null
  updatedAt: string
}

type BioType = 'peixe' | 'coral' | 'invertebrado'

type BioEntry = {
  id: string
  type: BioType
  name: string
  scientificName: string
  position: string
  note: string
  createdAt: string
}

type BioCatalogEntry = {
  aliases: string[]
  type: BioType
  scientificName: string
  position: string
  note: string
}

type SyncState = 'local' | 'syncing' | 'online' | 'error'
type FaunaSubmenu = BioType
type ProtocolKey = string

type UiSettings = {
  title: string
  subtitle: string
  subtitleEnabled: boolean
}

type ProtocolDefinition = {
  key: ProtocolKey
  label: string
  days: number[]
  quantity: number | null
  unit: string
}

type ProtocolLog = {
  id: string
  protocolKey: ProtocolKey
  performedAt: string
  note: string
}

type ProtocolCheck = {
  id: string
  protocolKey: ProtocolKey
  weekStart: string
  dayIndex: number
  checkedAt: string
  quantity: number | null
  unit: string
  note: string
}

type LightingPhase = {
  id: string
  name: string
  time: string
  uv: number
  white: number
  blue: number
}

const parameterDefinitions: ParameterDefinition[] = parameterDefinitionsData

const parameterColors: Record<string, string> = {
  kh: '#38bdf8',
  calcio: '#22d3ee',
  magnesio: '#14b8a6',
  salinidade: '#10b981',
  temperatura: '#f59e0b',
  ph: '#ef4444',
  amonia: '#e879f9',
  nitrito: '#f97316',
  nitrato: '#84cc16',
  fosfato: '#a78bfa',
  silicato: '#fb7185',
  iodo: '#facc15',
}

const hashToHue = (value: string) => {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % 360
}

const getSeriesColor = (key: string) => {
  const known = parameterColors[key]
  if (known) return known
  const hue = hashToHue(key)
  return `hsl(${hue} 70% 60%)`
}

const seedBioCatalog: BioCatalogEntry[] = seedBioCatalogData

const defaultProtocolDefinitions: ProtocolDefinition[] = defaultProtocolDefinitionsData

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')

const scoreTextMatch = (query: string, text: string) => {
  if (!query) return 0
  if (!text) return 0
  if (text === query) return 100
  if (text.startsWith(query)) return 90
  if (text.includes(` ${query}`)) return 80
  if (text.includes(query)) return 70
  const tokens = query.split(' ').filter(Boolean)
  if (!tokens.length) return 0
  if (tokens.every((token) => text.includes(token))) return 60
  return 0
}

const findBestCatalogMatch = (name: string, entries: BioCatalogEntry[]) => {
  const normalized = normalize(name)
  if (normalized.length < 2) return null
  let bestEntry: BioCatalogEntry | null = null
  let bestScore = 0

  for (const entry of entries) {
    let entryScore = 0
    for (const alias of entry.aliases) {
      const aliasNormalized = normalize(alias)
      const score = scoreTextMatch(normalized, aliasNormalized)
      if (score > entryScore) entryScore = score
      if (entryScore === 100) break
    }
    if (entryScore > bestScore) {
      bestScore = entryScore
      bestEntry = entry
      if (bestScore === 100) break
    }
  }

  return bestScore >= 60 ? bestEntry : null
}

const findInCatalog = (name: string) => findBestCatalogMatch(name, seedBioCatalog)

const mergeCatalog = (base: BioCatalogEntry[], extras: BioCatalogEntry[]) => {
  const merged = [...base]
  const aliasSet = new Set<string>()

  for (const entry of merged) {
    for (const alias of entry.aliases) {
      aliasSet.add(normalize(alias))
    }
  }

  for (const entry of extras) {
    const isDup = entry.aliases.some((alias) => aliasSet.has(normalize(alias)))
    if (isDup) continue
    merged.push(entry)
    for (const alias of entry.aliases) {
      aliasSet.add(normalize(alias))
    }
  }

  return merged
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))

const startOfWeekMonday = (date: Date) => {
  const result = new Date(date)
  const mondayBasedDay = (result.getDay() + 6) % 7
  result.setDate(result.getDate() - mondayBasedDay)
  result.setHours(0, 0, 0, 0)
  return result
}

const dayLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const toDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const fromDateKey = (key: string) => {
  const [year, month, day] = key.split('-').map((part) => Number(part))
  return new Date(year, month - 1, day)
}

const formatDays = (days: number[]) => {
  const labels = days
    .slice()
    .sort((a, b) => a - b)
    .map((day) => dayLabels[(day + 6) % 7])
  return labels.join(', ')
}

const buildProtocolKey = (label: string) => {
  const base = normalize(label).replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  const suffix = crypto.randomUUID().slice(0, 8)
  return `${base || 'rotina'}_${suffix}`
}

const timeToMinutes = (time: string) => {
  const [h, m] = time.split(':').map((part) => Number(part))
  return h * 60 + m
}

const normalizeTime = (value: string) => (value.length >= 5 ? value.slice(0, 5) : value)

const DEFAULT_LIGHTING_PHASES: LightingPhase[] = defaultLightingPhasesData

const DEFAULT_LIGHTING_BY_TIME = new Map(DEFAULT_LIGHTING_PHASES.map((phase) => [phase.time, phase]))

const defaultLightingPhases = (): LightingPhase[] =>
  DEFAULT_LIGHTING_PHASES.map((phase) => ({ ...phase }))

const normalizeLightingFromCloud = (phases: LightingPhase[]) => {
  const initialIds = phases.map((phase) => phase.id)
  const seenTimes = new Set<string>()
  const normalized: LightingPhase[] = []

  for (const phase of [...phases].sort(
    (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time),
  )) {
    const time = normalizeTime(String(phase.time))
    if (seenTimes.has(time)) continue
    seenTimes.add(time)

    const canonical = DEFAULT_LIGHTING_BY_TIME.get(time)
    if (canonical) {
      normalized.push({
        ...phase,
        id: canonical.id,
        name: phase.name || canonical.name,
        time,
      })
    } else {
      normalized.push({ ...phase, time })
    }
  }

  const normalizedIdSet = new Set(normalized.map((phase) => phase.id))
  const idsToDelete = initialIds.filter((id) => !normalizedIdSet.has(id))
  const needsWriteBack = idsToDelete.length > 0 || normalized.some((p) => !initialIds.includes(p.id))

  return { normalized, idsToDelete, needsWriteBack }
}

const getStatus = (value: number, min?: number, max?: number) => {
  if (min === undefined || max === undefined) return 'Sem faixa'
  if (value < min) return 'Baixo'
  if (value > max) return 'Alto'
  return 'Ideal'
}

type TrendArrow = 'up' | 'down' | 'flat'
type InsightBadge = 'Ideal' | 'Atenção' | 'Crítico' | 'Sem faixa'

type ParameterInsight = {
  latest: ParameterEntry | null
  previous: ParameterEntry | null
  delta: number | null
  daysBetween: number | null
  dailyRate: number | null
  arrow: TrendArrow
  badge: InsightBadge
  projectedDaysToBound: number | null
  projectedBound: 'min' | 'max' | null
  projectedDaysToCriticalMin: number | null
  criticalMin: number | null
}

const TREND_WINDOW_DAYS = 7
const MIN_RATE_INTERVAL_DAYS = 0.25

const aggressiveDailyRateByParameter: Partial<Record<ParameterKey, number>> = {
  kh: 0.5,
}

const criticalLimitsByParameter: Partial<Record<ParameterKey, { min?: number; max?: number }>> = {
  kh: { min: 6.5 },
  ph: { min: 7.8, max: 8.5 },
}

const arrowSymbol: Record<TrendArrow, string> = {
  up: '↑',
  down: '↓',
  flat: '→',
}

const formatSigned = (value: number, maximumFractionDigits: number) => {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  const abs = Math.abs(value)
  const formatted = new Intl.NumberFormat('pt-BR', { maximumFractionDigits }).format(abs)
  return `${sign}${formatted}`
}

const normalizeTankSettingsSnapshot = (
  settings: Map<ParameterKey, TankParameterSetting>,
) =>
  JSON.stringify(
    Array.from(settings.values())
      .map((item) => ({
        parameter: item.parameter,
        isCustomEnabled: item.isCustomEnabled,
        customMin: item.customMin,
        customMax: item.customMax,
      }))
      .sort((a, b) => a.parameter.localeCompare(b.parameter)),
  )

const pickLatestEntry = (items: ParameterEntry[]) => {
  let latest: ParameterEntry | null = null
  for (const entry of items) {
    if (!latest) {
      latest = entry
      continue
    }
    if (new Date(entry.measuredAt).getTime() > new Date(latest.measuredAt).getTime()) {
      latest = entry
    }
  }
  return latest
}

const computeParameterInsight = (
  allEntries: ParameterEntry[],
  definition: ParameterDefinition,
  safeZones: Map<ParameterKey, { min: number; max: number }>,
): ParameterInsight => {
  const items = allEntries
    .filter((entry) => entry.parameter === definition.key)
    .slice()
    .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime())

  const latest = items.length > 0 ? items[items.length - 1] : null
  const previous = items.length > 1 ? items[items.length - 2] : null
  const safe = safeZones.get(definition.key) ?? null
  const min = safe ? safe.min : definition.min
  const max = safe ? safe.max : definition.max

  let delta: number | null = null
  let daysBetween: number | null = null
  let dailyRate: number | null = null

  if (latest && previous) {
    delta = latest.value - previous.value
    const diffMs = new Date(latest.measuredAt).getTime() - new Date(previous.measuredAt).getTime()
    const diffDays = diffMs / 86400000
    if (diffDays > 0) {
      daysBetween = diffDays
      if (diffDays >= MIN_RATE_INTERVAL_DAYS) dailyRate = delta / diffDays
    }
  }

  const arrow: TrendArrow =
    delta === null || Math.abs(delta) < 1e-12 ? 'flat' : delta > 0 ? 'up' : 'down'

  const status = latest ? getStatus(latest.value, min, max) : 'Sem faixa'
  let badge: InsightBadge =
    status === 'Sem faixa' ? 'Sem faixa' : status === 'Ideal' ? 'Ideal' : 'Crítico'

  let projectedDaysToBound: number | null = null
  let projectedBound: 'min' | 'max' | null = null

  if (latest && dailyRate !== null && min !== undefined && max !== undefined && status === 'Ideal') {
    if (dailyRate < 0) {
      const remaining = latest.value - min
      if (remaining > 0) {
        projectedDaysToBound = remaining / Math.abs(dailyRate)
        projectedBound = 'min'
      }
    } else if (dailyRate > 0) {
      const remaining = max - latest.value
      if (remaining > 0) {
        projectedDaysToBound = remaining / dailyRate
        projectedBound = 'max'
      }
    }
  }

  const aggressiveThreshold = aggressiveDailyRateByParameter[definition.key]
  if (badge === 'Ideal' && dailyRate !== null && aggressiveThreshold !== undefined) {
    if (Math.abs(dailyRate) >= aggressiveThreshold) {
      badge = 'Atenção'
    }
  }

  if (
    badge === 'Ideal' &&
    projectedDaysToBound !== null &&
    Number.isFinite(projectedDaysToBound) &&
    projectedDaysToBound <= TREND_WINDOW_DAYS
  ) {
    badge = 'Atenção'
  }

  const criticalMin = criticalLimitsByParameter[definition.key]?.min ?? null
  let projectedDaysToCriticalMin: number | null = null

  if (latest && dailyRate !== null && criticalMin !== null && dailyRate < 0) {
    const remaining = latest.value - criticalMin
    if (remaining > 0) projectedDaysToCriticalMin = remaining / Math.abs(dailyRate)
  }

  return {
    latest,
    previous,
    delta,
    daysBetween,
    dailyRate,
    arrow,
    badge,
    projectedDaysToBound,
    projectedBound,
    projectedDaysToCriticalMin,
    criticalMin,
  }
}

type ChartPoint = { x: number; y: number }

const buildMonotonePath = (points: ChartPoint[]) => {
  if (points.length < 2) return ''
  const n = points.length
  const x = points.map((p) => p.x)
  const y = points.map((p) => p.y)
  const dx = new Array<number>(n - 1)
  const m = new Array<number>(n - 1)

  for (let i = 0; i < n - 1; i += 1) {
    const dxi = x[i + 1] - x[i]
    dx[i] = dxi === 0 ? 1 : dxi
    m[i] = (y[i + 1] - y[i]) / dx[i]
  }

  const t = new Array<number>(n)
  t[0] = m[0]
  t[n - 1] = m[n - 2]

  for (let i = 1; i < n - 1; i += 1) {
    const m0 = m[i - 1]
    const m1 = m[i]
    if (m0 === 0 || m1 === 0 || m0 * m1 <= 0) {
      t[i] = 0
    } else {
      t[i] = (m0 + m1) / 2
    }
  }

  for (let i = 0; i < n - 1; i += 1) {
    const mi = m[i]
    if (mi === 0) {
      t[i] = 0
      t[i + 1] = 0
      continue
    }
    const a = t[i] / mi
    const b = t[i + 1] / mi
    const s = a * a + b * b
    if (s > 9) {
      const r = 3 / Math.sqrt(s)
      t[i] = r * a * mi
      t[i + 1] = r * b * mi
    }
  }

  const fmt = (value: number) => Number(value.toFixed(2))
  let d = `M ${fmt(x[0])},${fmt(y[0])}`

  for (let i = 0; i < n - 1; i += 1) {
    const h = x[i + 1] - x[i]
    const c1x = x[i] + h / 3
    const c1y = y[i] + (t[i] * h) / 3
    const c2x = x[i + 1] - h / 3
    const c2y = y[i + 1] - (t[i + 1] * h) / 3
    d += ` C ${fmt(c1x)},${fmt(c1y)} ${fmt(c2x)},${fmt(c2y)} ${fmt(x[i + 1])},${fmt(
      y[i + 1],
    )}`
  }

  return d
}

const normalizeParameterValue = (parameter: ParameterKey, rawValue: number) => {
  if (parameter !== 'salinidade') return rawValue
  if (rawValue >= 1000 && rawValue <= 1100) return rawValue / 1000
  return rawValue
}

const sanitizeParameterEntries = (items: ParameterEntry[]) =>
  items.map((entry) => ({
    ...entry,
    value: normalizeParameterValue(entry.parameter, entry.value),
  }))

const parseOptionalNumber = (raw: string) => {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

const parseNumberWithFallback = (raw: string, fallback: number) => {
  const value = Number(raw)
  return Number.isFinite(value) ? value : fallback
}

const safeJsonParseArray = <T,>(raw: string | null, fallback: T[]) => {
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as T[]) : fallback
  } catch {
    return fallback
  }
}

const formatSyncError = (error: unknown) => {
  if (error instanceof Error) return error.message || 'Erro desconhecido'
  if (!error || typeof error !== 'object') return 'Erro desconhecido'
  const candidate = error as Record<string, unknown>
  const message = typeof candidate.message === 'string' ? candidate.message : ''
  const code = typeof candidate.code === 'string' ? candidate.code : ''
  const details = typeof candidate.details === 'string' ? candidate.details : ''
  const hint = typeof candidate.hint === 'string' ? candidate.hint : ''
  const status = typeof candidate.status === 'number' ? String(candidate.status) : ''
  const pieces = [message, code && `code=${code}`, status && `status=${status}`, details, hint].filter(
    (item) => Boolean(item),
  )
  return pieces.join(' • ') || 'Erro desconhecido'
}

const NOW_AT_BOOT = Date.now()
const DEFAULT_UI_SETTINGS: UiSettings = {
  title: 'Monitoramento do aquario',
  subtitle: 'Controle diário do aquário no PC e no celular',
  subtitleEnabled: true,
}

function App() {
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'parametros' | 'protocolos' | 'iluminacao' | 'inventario' | 'configuracoes'
  >('dashboard')
  const [parameter, setParameter] = useState<ParameterKey>('kh')
  const [value, setValue] = useState<string>('')
  const [note, setNote] = useState<string>('')
  const [filterParameter, setFilterParameter] = useState<'todos' | ParameterKey>('todos')
  const [periodDays, setPeriodDays] = useState<7 | 30 | 90 | 365>(30)
  const [dashboardPeriodDays, setDashboardPeriodDays] = useState<7 | 30 | 90 | 365>(30)
  const [entries, setEntries] = useState<ParameterEntry[]>([])
  const [bioType, setBioType] = useState<BioType>('peixe')
  const [bioName, setBioName] = useState<string>('')
  const [bioScientificName, setBioScientificName] = useState<string>('')
  const [bioPosition, setBioPosition] = useState<string>('')
  const [bioNote, setBioNote] = useState<string>('')
  const [bioEditingId, setBioEditingId] = useState<string | null>(null)
  const [bioEntries, setBioEntries] = useState<BioEntry[]>([])
  const [faunaSubmenu, setFaunaSubmenu] = useState<FaunaSubmenu>('peixe')
  const [faunaSearch, setFaunaSearch] = useState<string>('')
  const [catalogEntries, setCatalogEntries] = useState<BioCatalogEntry[]>(seedBioCatalog)
  const [bioDeepDivePreviewById, setBioDeepDivePreviewById] = useState<
    Map<string, { reefCompatible: string | null; lighting: string | null; flow: string | null }>
  >(() => new Map())
  const [isSearchingBio, setIsSearchingBio] = useState<boolean>(false)
  const [protocolDefinitions, setProtocolDefinitions] = useState<ProtocolDefinition[]>(
    defaultProtocolDefinitions,
  )
  const [protocolChecks, setProtocolChecks] = useState<ProtocolCheck[]>([])
  const [protocolLogs, setProtocolLogs] = useState<ProtocolLog[]>([])
  const [protocolNote, setProtocolNote] = useState<string>('')
  const [protocolEditingKey, setProtocolEditingKey] = useState<ProtocolKey | null>(null)
  const [protocolEditLabel, setProtocolEditLabel] = useState<string>('')
  const [protocolEditDays, setProtocolEditDays] = useState<number[]>([])
  const [protocolEditQuantity, setProtocolEditQuantity] = useState<string>('')
  const [protocolEditUnit, setProtocolEditUnit] = useState<string>('')
  const [protocolAddLabel, setProtocolAddLabel] = useState<string>('')
  const [protocolAddDays, setProtocolAddDays] = useState<number[]>([])
  const [protocolAddQuantity, setProtocolAddQuantity] = useState<string>('')
  const [protocolAddUnit, setProtocolAddUnit] = useState<string>('ml')
  const [isProtocolModalOpen, setIsProtocolModalOpen] = useState<boolean>(false)
  const [protocolModalMode, setProtocolModalMode] = useState<'add' | 'edit'>('add')
  const [lightingPhases, setLightingPhases] = useState<LightingPhase[]>([])
  const [isLightingModalOpen, setIsLightingModalOpen] = useState<boolean>(false)
  const [lightingEditingId, setLightingEditingId] = useState<string | null>(null)
  const [lightingEditName, setLightingEditName] = useState<string>('')
  const [lightingEditTime, setLightingEditTime] = useState<string>('08:30')
  const [lightingEditUv, setLightingEditUv] = useState<string>('0')
  const [lightingEditWhite, setLightingEditWhite] = useState<string>('0')
  const [lightingEditBlue, setLightingEditBlue] = useState<string>('0')
  const [syncState, setSyncState] = useState<SyncState>(
    isSupabaseEnabled ? 'syncing' : 'local',
  )
  const [syncErrorDetail, setSyncErrorDetail] = useState<string | null>(null)
  const [storageError, setStorageError] = useState<string | null>(null)
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(isSupabaseEnabled)
  const [nowMs, setNowMs] = useState<number>(NOW_AT_BOOT)
  const [syncReloadNonce, setSyncReloadNonce] = useState<number>(0)
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState<boolean>(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false)
  const [uiSettings, setUiSettings] = useState<UiSettings>(DEFAULT_UI_SETTINGS)
  const [safeZones, setSafeZones] = useState<Map<ParameterKey, { min: number; max: number }>>(
    () => new Map(),
  )
  const [safeZonesBase, setSafeZonesBase] = useState<
    Map<ParameterKey, { min: number; max: number }>
  >(() => new Map())
  const [tankSettings, setTankSettings] = useState<Map<ParameterKey, TankParameterSetting>>(
    () => new Map(),
  )
  const [savedTankSettings, setSavedTankSettings] = useState<
    Map<ParameterKey, TankParameterSetting>
  >(() => new Map())
  const [isSavingTankSettings, setIsSavingTankSettings] = useState<boolean>(false)
  const [cloudConsumptionRates, setCloudConsumptionRates] = useState<Map<ParameterKey, number>>(
    () => new Map(),
  )
  const [bioRequirementState, setBioRequirementState] = useState<
    'idle' | 'loading' | 'found' | 'not_found' | 'error'
  >('idle')
  const [bioRequirementPreview, setBioRequirementPreview] = useState<{
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
  } | null>(null)
  const [animalDetailsEntry, setAnimalDetailsEntry] = useState<BioEntry | null>(null)
  const [animalDetailsCatalogEntry, setAnimalDetailsCatalogEntry] = useState<BioCatalogEntry | null>(null)
  const [animalRequirementState, setAnimalRequirementState] = useState<
    'idle' | 'loading' | 'found' | 'not_found' | 'error'
  >('idle')
  const [animalRequirement, setAnimalRequirement] = useState<{
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
  } | null>(null)
  const [parameterAlert, setParameterAlert] = useState<{ title: string; message: string } | null>(
    null,
  )
  const [lastMeasurementFeedback, setLastMeasurementFeedback] = useState<{
    parameter: ParameterKey
    value: number
    measuredAt: string
    previousValue: number | null
    delta: number | null
    daysBetween: number | null
    dailyRate: number | null
    protocolLabel: string | null
    protocolPerformedAt: string | null
    deltaSinceProtocol: number | null
  } | null>(null)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const animalRequirementRequestIdRef = useRef(0)
  const handleCloudWriteError = useCallback((detail: string) => {
    setSyncState('error')
    setSyncErrorDetail(detail)
  }, [])

  const handleCloudWriteOnline = useCallback(() => {
    setSyncState('online')
    setSyncErrorDetail(null)
  }, [])

  const {
    pendingWrites,
    enqueue: enqueueCloudWrite,
    retry: retryCloudWrites,
    clear: clearCloudWrites,
  } = useCloudWriteQueue({
    enabled: isSupabaseEnabled,
    userId: authUser?.id ?? null,
    formatError: formatSyncError,
    onError: handleCloudWriteError,
    onOnline: handleCloudWriteOnline,
  })

  const entriesStorageKey = isSupabaseEnabled
    ? authUser
      ? `reef-system-entries:${authUser.id}`
      : null
    : 'reef-system-entries'
  const bioEntriesStorageKey = isSupabaseEnabled
    ? authUser
      ? `reef-system-bio-entries:${authUser.id}`
      : null
    : 'reef-system-bio-entries'
  const catalogStorageKey = isSupabaseEnabled
    ? authUser
      ? `reef-system-bio-catalog:${authUser.id}`
      : null
    : 'reef-system-bio-catalog'
  const protocolLogsStorageKey = isSupabaseEnabled
    ? authUser
      ? `reef-system-protocol-logs:${authUser.id}`
      : null
    : 'reef-system-protocol-logs'
  const protocolDefinitionsStorageKey = isSupabaseEnabled
    ? authUser
      ? `reef-system-protocol-definitions:${authUser.id}`
      : null
    : 'reef-system-protocol-definitions'
  const protocolChecksStorageKey = isSupabaseEnabled
    ? authUser
      ? `reef-system-protocol-checks:${authUser.id}`
      : null
    : 'reef-system-protocol-checks'
  const lightingPhasesStorageKey = isSupabaseEnabled
    ? authUser
      ? `reef-system-lighting-phases:${authUser.id}`
      : null
    : 'reef-system-lighting-phases'
  const uiSettingsStorageKey = isSupabaseEnabled
    ? authUser
      ? `reef-system-ui-settings:${authUser.id}`
      : null
    : 'reef-system-ui-settings'
  const profileAvatarStorageKey = isSupabaseEnabled
    ? authUser
      ? `reef-system-profile-avatar:${authUser.id}`
      : null
    : 'reef-system-profile-avatar'
  const tankSettingsStorageKey = isSupabaseEnabled
    ? authUser
      ? `reef-system-tank-settings:${authUser.id}`
      : null
    : 'reef-system-tank-settings'

  const safeLocalStorageSetItem = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value)
      setStorageError(null)
      return true
    } catch {
      setStorageError('Armazenamento local cheio')
      return false
    }
  }

  const safeLocalStorageRemoveItem = (key: string) => {
    try {
      localStorage.removeItem(key)
      setStorageError(null)
      return true
    } catch {
      setStorageError('Armazenamento local cheio')
      return false
    }
  }

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle()
    } catch (error) {
      logError('auth-login', error)
      setSyncState('error')
      setSyncErrorDetail(formatSyncError(error))
    }
  }

  const handleLogout = async () => {
    try {
      await signOut()
      clearCloudWrites()
      setSyncState('local')
      setSyncErrorDetail(null)
    } catch (error) {
      logError('auth-logout', error)
      setSyncState('error')
      setSyncErrorDetail(formatSyncError(error))
    }
  }

  const handleRetrySync = () => {
    if (!isSupabaseEnabled) return
    setSyncErrorDetail(null)
    setSyncState('syncing')
    retryCloudWrites()
    setSyncReloadNonce((current) => current + 1)
  }

  const handleOpenSettings = () => {
    setIsSettingsOpen(true)
    setIsProfileMenuOpen(false)
  }

  const handleCloseSettings = () => {
    setIsSettingsOpen(false)
  }

  const handleRequestAvatarChange = () => {
    avatarInputRef.current?.click()
  }

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const next = typeof reader.result === 'string' ? reader.result : null
      if (!next) return
      setProfileAvatarUrl(next)
      if (profileAvatarStorageKey) {
        void (async () => {
          try {
            await idbSet(profileAvatarStorageKey, next)
            safeLocalStorageRemoveItem(profileAvatarStorageKey)
          } catch (error) {
            logError('avatar-idb-set', error)
            safeLocalStorageSetItem(profileAvatarStorageKey, next)
          }
        })()
      }
      setIsProfileMenuOpen(false)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveAvatar = () => {
    setProfileAvatarUrl(null)
    if (profileAvatarStorageKey) {
      void (async () => {
        try {
          await idbDel(profileAvatarStorageKey)
        } catch (error) {
          logError('avatar-idb-del', error)
        }
        safeLocalStorageRemoveItem(profileAvatarStorageKey)
      })()
    }
    setIsProfileMenuOpen(false)
  }

  const handleSaveUiSettings = (next: UiSettings) => {
    setUiSettings(next)
    if (uiSettingsStorageKey) safeLocalStorageSetItem(uiSettingsStorageKey, JSON.stringify(next))
    setIsSettingsOpen(false)
  }

  const handleSaveTankSettings = async () => {
    if (isSavingTankSettings) return
    if (isSupabaseEnabled && !authUser) {
      setSyncState('error')
      setSyncErrorDetail('Faça login para salvar configurações do tanque')
      return
    }

    setIsSavingTankSettings(true)
    try {
      if (!isSupabaseEnabled) {
        setSavedTankSettings(new Map(tankSettings))
        setSyncState('local')
        setSyncErrorDetail(null)
        return
      }
      const userId = authUser?.id
      if (!userId) return

      const updatedAt = new Date().toISOString()
      await upsertCloudUserParameterSettings(
        Array.from(tankSettings.values()).map((item) => ({
          parameter: item.parameter,
          isCustomEnabled: item.isCustomEnabled,
          customMin: item.customMin,
          customMax: item.customMax,
          updatedAt,
        })),
        userId,
      )

      const refreshedSafeZoneRows = await fetchSafeZones()
      const refreshedSafeZoneMap = new Map<ParameterKey, { min: number; max: number }>()
      const refreshedSafeZoneBaseMap = new Map<ParameterKey, { min: number; max: number }>()
      for (const row of refreshedSafeZoneRows) {
        if (!row.parameter) continue
        if (
          row.baseMin !== null &&
          row.baseMax !== null &&
          Number.isFinite(row.baseMin) &&
          Number.isFinite(row.baseMax)
        ) {
          refreshedSafeZoneBaseMap.set(row.parameter as ParameterKey, { min: row.baseMin, max: row.baseMax })
        }
        if (
          row.zoneMin !== null &&
          row.zoneMax !== null &&
          Number.isFinite(row.zoneMin) &&
          Number.isFinite(row.zoneMax)
        ) {
          refreshedSafeZoneMap.set(row.parameter as ParameterKey, { min: row.zoneMin, max: row.zoneMax })
        }
      }
      setSafeZonesBase(refreshedSafeZoneBaseMap)
      setSafeZones(refreshedSafeZoneMap)
      setSavedTankSettings(new Map(tankSettings))
      setSyncState('online')
      setSyncErrorDetail(null)
    } catch (error) {
      logError('tank-settings-save', error)
      const code = (error as { code?: string } | null)?.code ?? ''
      const message = (error as { message?: string } | null)?.message ?? ''
      if (code === 'PGRST205' || message.includes("Could not find the table 'public.user_parameter_settings'")) {
        setSavedTankSettings(new Map(tankSettings))
        setSyncState('online')
        setSyncErrorDetail(null)
        return
      }
      setSyncState('error')
      setSyncErrorDetail(formatSyncError(error))
    } finally {
      setIsSavingTankSettings(false)
    }
  }

  const handleCancelTankSettings = () => {
    setTankSettings(new Map(savedTankSettings))
    setSyncErrorDetail(null)
    if (!isSupabaseEnabled) setSyncState('local')
  }

  useEffect(() => {
    if (!isSupabaseEnabled) return
    let alive = true
    setIsAuthLoading(true)
    void (async () => {
      try {
        const session = await getSession()
        if (!alive) return
        setAuthUser(session?.user ?? null)
      } catch {
        if (!alive) return
        setAuthUser(null)
      }
      if (alive) setIsAuthLoading(false)
    })()
    const unsubscribe = onAuthStateChange((session) => {
      setAuthUser(session?.user ?? null)
      setIsAuthLoading(false)
    })
    return () => {
      alive = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    setIsProfileMenuOpen(false)
    clearCloudWrites()
  }, [authUser?.id, clearCloudWrites])

  useEffect(() => {
    if (!profileAvatarStorageKey) {
      setProfileAvatarUrl(null)
      return
    }
    let alive = true
    void (async () => {
      try {
        const stored = await idbGet(profileAvatarStorageKey)
        if (!alive) return
        if (stored) {
          setProfileAvatarUrl(stored)
          safeLocalStorageRemoveItem(profileAvatarStorageKey)
          return
        }
        const legacy = localStorage.getItem(profileAvatarStorageKey)
        if (!alive) return
        setProfileAvatarUrl(legacy || null)
        if (legacy) {
          try {
            await idbSet(profileAvatarStorageKey, legacy)
            safeLocalStorageRemoveItem(profileAvatarStorageKey)
          } catch (error) {
            logError('avatar-idb-migrate', error)
          }
        }
      } catch (error) {
        logError('avatar-idb-get', error)
        if (!alive) return
        const legacy = localStorage.getItem(profileAvatarStorageKey)
        setProfileAvatarUrl(legacy || null)
      }
    })()
    return () => {
      alive = false
    }
  }, [profileAvatarStorageKey])

  useEffect(() => {
    if (!uiSettingsStorageKey) {
      setUiSettings(DEFAULT_UI_SETTINGS)
      return
    }
    const raw = localStorage.getItem(uiSettingsStorageKey)
    if (!raw) {
      setUiSettings(DEFAULT_UI_SETTINGS)
      return
    }
    try {
      const parsed = JSON.parse(raw) as Partial<UiSettings>
      const rawTitle = typeof parsed.title === 'string' ? parsed.title : null
      let title = rawTitle ?? DEFAULT_UI_SETTINGS.title
      const subtitle =
        typeof parsed.subtitle === 'string' ? parsed.subtitle : DEFAULT_UI_SETTINGS.subtitle
      const subtitleEnabled =
        typeof parsed.subtitleEnabled === 'boolean'
          ? parsed.subtitleEnabled
          : DEFAULT_UI_SETTINGS.subtitleEnabled
      if (rawTitle === 'Reef System 300L') {
        title = DEFAULT_UI_SETTINGS.title
        safeLocalStorageSetItem(uiSettingsStorageKey, JSON.stringify({ title, subtitle, subtitleEnabled }))
      }
      setUiSettings({ title, subtitle, subtitleEnabled })
    } catch {
      setUiSettings(DEFAULT_UI_SETTINGS)
    }
  }, [uiSettingsStorageKey])

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 60000)
    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (!isSupabaseEnabled || !authUser) {
      setBioRequirementState('idle')
      setBioRequirementPreview(null)
      return
    }
    const scientific = bioScientificName.trim()
    if (!scientific) {
      setBioRequirementState('idle')
      setBioRequirementPreview(null)
      return
    }
    let alive = true
    setBioRequirementState('loading')
    void (async () => {
      try {
        const requirement = await fetchBioRequirementByScientificName(scientific)
        if (!alive) return
        if (!requirement) {
          setBioRequirementState('not_found')
          setBioRequirementPreview(null)
          return
        }
        setBioRequirementState('found')
        setBioRequirementPreview(requirement)
      } catch (error) {
        logError('bio-requirements', error)
        if (!alive) return
        setBioRequirementState('error')
        setBioRequirementPreview(null)
      }
    })()
    return () => {
      alive = false
    }
  }, [authUser, bioScientificName])

  useEffect(() => {
    const loadData = async () => {
      const localSeed: ParameterEntry[] = [
        {
          id: crypto.randomUUID(),
          parameter: 'kh',
          value: 7,
          measuredAt: new Date(Date.now() - 86400000 * 4).toISOString(),
          note: 'Valor inicial do sistema',
        },
        {
          id: crypto.randomUUID(),
          parameter: 'calcio',
          value: 448,
          measuredAt: new Date(Date.now() - 86400000 * 4).toISOString(),
          note: 'Valor inicial do sistema',
        },
        {
          id: crypto.randomUUID(),
          parameter: 'salinidade',
          value: 1.025,
          measuredAt: new Date(Date.now() - 86400000).toISOString(),
          note: 'Medição de referência',
        },
      ]
      if (isSupabaseEnabled && isAuthLoading) {
        setSyncState('syncing')
        return
      }

      if (isSupabaseEnabled && !authUser) {
        setEntries([])
        setBioEntries([])
        setCatalogEntries(seedBioCatalog)
        setProtocolDefinitions(defaultProtocolDefinitions)
        setProtocolChecks([])
        setProtocolLogs([])
        setLightingPhases(defaultLightingPhases())
        setSafeZones(new Map())
        setSafeZonesBase(new Map())
        setTankSettings(new Map())
        setSavedTankSettings(new Map())
        setCloudConsumptionRates(new Map())
        setSyncState('local')
        return
      }

      const localEntriesCache = entriesStorageKey ? localStorage.getItem(entriesStorageKey) : null
      const localBioCache = bioEntriesStorageKey ? localStorage.getItem(bioEntriesStorageKey) : null
      const localCatalogCache = catalogStorageKey ? localStorage.getItem(catalogStorageKey) : null
      const localProtocolCache = protocolLogsStorageKey
        ? localStorage.getItem(protocolLogsStorageKey)
        : null
      const localProtocolDefCache = protocolDefinitionsStorageKey
        ? localStorage.getItem(protocolDefinitionsStorageKey)
        : null
      const localProtocolCheckCache = protocolChecksStorageKey
        ? localStorage.getItem(protocolChecksStorageKey)
        : null
      const localLightingCache = lightingPhasesStorageKey
        ? localStorage.getItem(lightingPhasesStorageKey)
        : null
      const localTankSettingsCache = tankSettingsStorageKey
        ? localStorage.getItem(tankSettingsStorageKey)
        : null
      const localEntries = sanitizeParameterEntries(
        safeJsonParseArray<ParameterEntry>(localEntriesCache, localSeed),
      )
      const localBio = safeJsonParseArray<BioEntry>(localBioCache, [])
      const localCatalog = safeJsonParseArray<BioCatalogEntry>(localCatalogCache, [])
      const localProtocolLogs = safeJsonParseArray<ProtocolLog>(localProtocolCache, [])
      const localProtocolDefinitionsRaw = safeJsonParseArray<ProtocolDefinition>(
        localProtocolDefCache,
        [],
      )
      const localProtocolDefinitions =
        localProtocolDefinitionsRaw.length > 0
          ? localProtocolDefinitionsRaw
          : defaultProtocolDefinitions
      const localProtocolChecks = safeJsonParseArray<ProtocolCheck>(localProtocolCheckCache, [])
      const defaultLighting = defaultLightingPhases()
      const localLightingRaw = safeJsonParseArray<LightingPhase>(localLightingCache, [])
      const localLighting: LightingPhase[] =
        localLightingRaw.length > 0
          ? localLightingRaw.map((item) => ({
              ...item,
              time: normalizeTime(String(item.time)),
              uv: parseNumberWithFallback(String(item.uv ?? 0), 0),
              white: parseNumberWithFallback(String(item.white ?? 0), 0),
              blue: parseNumberWithFallback(String(item.blue ?? 0), 0),
            }))
          : defaultLighting
      const localTankSettingsRaw = safeJsonParseArray<TankParameterSetting>(localTankSettingsCache, [])
      const localTankSettingsMap = new Map<ParameterKey, TankParameterSetting>(
        localTankSettingsRaw
          .filter((item) => Boolean(item?.parameter))
          .map((item) => [
            item.parameter,
            {
              parameter: item.parameter,
              isCustomEnabled: Boolean(item.isCustomEnabled),
              customMin: item.customMin ?? null,
              customMax: item.customMax ?? null,
              updatedAt: item.updatedAt || new Date(0).toISOString(),
            },
          ]),
      )

      if (!isSupabaseEnabled) {
        const baseSafe = new Map<ParameterKey, { min: number; max: number }>()
        for (const definition of parameterDefinitions) {
          if (definition.min === undefined || definition.max === undefined) continue
          baseSafe.set(definition.key, { min: definition.min, max: definition.max })
        }
        const finalSafe = new Map(baseSafe)
        for (const item of localTankSettingsMap.values()) {
          if (!item.isCustomEnabled) continue
          if (item.customMin === null || item.customMax === null) continue
          if (!Number.isFinite(item.customMin) || !Number.isFinite(item.customMax)) continue
          finalSafe.set(item.parameter, { min: item.customMin, max: item.customMax })
        }
        setEntries(localEntries)
        setBioEntries(localBio)
        setCatalogEntries(mergeCatalog(seedBioCatalog, localCatalog))
        setProtocolDefinitions(localProtocolDefinitions)
        setProtocolChecks(localProtocolChecks)
        setProtocolLogs(localProtocolLogs)
        setLightingPhases(localLighting)
        setSafeZones(finalSafe)
        setSafeZonesBase(baseSafe)
        setTankSettings(localTankSettingsMap)
        setSavedTankSettings(new Map(localTankSettingsMap))
        setCloudConsumptionRates(new Map())
        setSyncState('local')
        setSyncErrorDetail(null)
        return
      }

      const userId = authUser?.id
      if (!userId) {
        setSyncState('error')
        setSyncErrorDetail('Faça login para sincronizar')
        return
      }

      let syncStage = 'Preparando sincronização'
      try {
        setSyncState('syncing')
        syncStage = 'Carregando dados do Supabase'
        const cloudData = await fetchCloudData()
        const safeZoneRows = await fetchSafeZones()
        const consumptionRows = await fetchConsumptionRates()
        const safeZoneMap = new Map<ParameterKey, { min: number; max: number }>()
        const safeZoneBaseMap = new Map<ParameterKey, { min: number; max: number }>()
        for (const row of safeZoneRows) {
          if (!row.parameter) continue
          if (
            row.baseMin !== null &&
            row.baseMax !== null &&
            Number.isFinite(row.baseMin) &&
            Number.isFinite(row.baseMax)
          ) {
            safeZoneBaseMap.set(row.parameter as ParameterKey, { min: row.baseMin, max: row.baseMax })
          }
          if (
            row.zoneMin !== null &&
            row.zoneMax !== null &&
            Number.isFinite(row.zoneMin) &&
            Number.isFinite(row.zoneMax)
          ) {
            safeZoneMap.set(row.parameter as ParameterKey, { min: row.zoneMin, max: row.zoneMax })
          }
        }
        setSafeZones(safeZoneMap)
        setSafeZonesBase(safeZoneBaseMap)
        const consumptionMap = new Map<ParameterKey, number>()
        for (const row of consumptionRows) {
          if (!row.parameter) continue
          if (consumptionMap.has(row.parameter as ParameterKey)) continue
          consumptionMap.set(row.parameter as ParameterKey, row.dailyRate)
        }
        setCloudConsumptionRates(consumptionMap)
        const cloudTankSettingsMap = new Map(
          cloudData.userParameterSettings
            .filter((item) => Boolean(item.parameter))
            .map((item) => [
              item.parameter as ParameterKey,
              {
                parameter: item.parameter as ParameterKey,
                isCustomEnabled: item.isCustomEnabled,
                customMin: item.customMin,
                customMax: item.customMax,
                updatedAt: item.updatedAt,
              },
            ]),
        )
        const effectiveTankSettingsMap =
          cloudTankSettingsMap.size > 0 ? cloudTankSettingsMap : localTankSettingsMap
        setTankSettings(new Map(effectiveTankSettingsMap))
        setSavedTankSettings(new Map(effectiveTankSettingsMap))
        const cloudIsEmpty =
          cloudData.parameters.length === 0 &&
          cloudData.bio.length === 0 &&
          cloudData.catalog.length === 0 &&
          cloudData.protocolLogs.length === 0 &&
          cloudData.protocolDefinitions.length === 0 &&
          cloudData.protocolChecks.length === 0 &&
          cloudData.lightingPhases.length === 0 &&
          cloudData.userParameterSettings.length === 0

        const hasLocalCache = Boolean(
          localEntriesCache ||
            localBioCache ||
            localCatalogCache ||
            localProtocolCache ||
            localProtocolDefCache ||
            localProtocolCheckCache ||
            localLightingCache ||
            localTankSettingsCache,
        )

        if (cloudIsEmpty && hasLocalCache) {
          syncStage = 'Enviando medições de parâmetros'
          await upsertCloudParameters(
            localEntries.map((item) => ({
              id: item.id,
              parameter: item.parameter,
              value: item.value,
              measuredAt: item.measuredAt,
              note: item.note,
            })),
            userId,
          )

          syncStage = 'Enviando inventário biológico'
          await upsertCloudBios(
            localBio.map((item) => ({
              id: item.id,
              type: item.type,
              name: item.name,
              scientificName: item.scientificName,
              position: item.position,
              note: item.note,
              createdAt: item.createdAt,
            })),
            userId,
          )

          syncStage = 'Enviando catálogo de organismos'
          await upsertCloudCatalogEntries(
            localCatalog.map((item) => ({
              aliases: item.aliases,
              type: item.type,
              scientificName: item.scientificName,
              position: item.position,
              note: item.note,
            })),
            userId,
          )

          syncStage = 'Enviando definições de protocolo'
          await upsertCloudProtocolDefinitions(
            localProtocolDefinitions.map((item) => ({
              protocolKey: item.key,
              label: item.label,
              days: item.days,
              quantity: item.quantity,
              unit: item.unit,
            })),
            userId,
          )

          syncStage = 'Enviando checks de protocolo'
          await upsertCloudProtocolChecks(
            localProtocolChecks.map((item) => ({
              id: item.id,
              protocolKey: item.protocolKey,
              weekStart: item.weekStart,
              dayIndex: item.dayIndex,
              checkedAt: item.checkedAt,
              quantity: item.quantity,
              unit: item.unit,
              note: item.note,
            })),
            userId,
          )

          syncStage = 'Enviando configurações do tanque'
          await upsertCloudUserParameterSettings(
            Array.from(localTankSettingsMap.values()).map((item) => ({
              parameter: item.parameter,
              isCustomEnabled: item.isCustomEnabled,
              customMin: item.customMin,
              customMax: item.customMax,
              updatedAt: new Date().toISOString(),
            })),
            userId,
          )

          syncStage = 'Enviando histórico de protocolos'
          await upsertCloudProtocolLogs(
            localProtocolLogs.map((item) => ({
              id: item.id,
              protocolKey: item.protocolKey,
              performedAt: item.performedAt,
              note: item.note,
            })),
            userId,
          )

          syncStage = 'Enviando fases de iluminação'
          await upsertCloudLightingPhases(
            localLighting.map((item) => ({
              id: item.id,
              name: item.name,
              time: item.time,
              uv: item.uv,
              white: item.white,
              blue: item.blue,
            })),
            userId,
          )

          setEntries(localEntries)
          setBioEntries(localBio)
          setCatalogEntries(mergeCatalog(seedBioCatalog, localCatalog))
          setProtocolDefinitions(localProtocolDefinitions)
          setProtocolChecks(localProtocolChecks)
          setProtocolLogs(localProtocolLogs)
          setLightingPhases(localLighting)
          setTankSettings(localTankSettingsMap)
          setSavedTankSettings(new Map(localTankSettingsMap))
          const refreshedSafeZoneRows = await fetchSafeZones()
          const refreshedSafeZoneMap = new Map<ParameterKey, { min: number; max: number }>()
          const refreshedSafeZoneBaseMap = new Map<ParameterKey, { min: number; max: number }>()
          for (const row of refreshedSafeZoneRows) {
            if (!row.parameter) continue
            if (
              row.baseMin !== null &&
              row.baseMax !== null &&
              Number.isFinite(row.baseMin) &&
              Number.isFinite(row.baseMax)
            ) {
              refreshedSafeZoneBaseMap.set(row.parameter as ParameterKey, {
                min: row.baseMin,
                max: row.baseMax,
              })
            }
            if (
              row.zoneMin !== null &&
              row.zoneMax !== null &&
              Number.isFinite(row.zoneMin) &&
              Number.isFinite(row.zoneMax)
            ) {
              refreshedSafeZoneMap.set(row.parameter as ParameterKey, { min: row.zoneMin, max: row.zoneMax })
            }
          }
          setSafeZones(refreshedSafeZoneMap)
          setSafeZonesBase(refreshedSafeZoneBaseMap)
          setSyncState('online')
          return
        }
        setEntries(
          sanitizeParameterEntries(
            cloudData.parameters.map((item) => ({
              id: item.id,
              parameter: item.parameter as ParameterKey,
              value: item.value,
              measuredAt: item.measuredAt,
              note: item.note,
            })),
          ),
        )
        setBioEntries(
          cloudData.bio.map((item) => ({
            id: item.id,
            type: item.type as BioType,
            name: item.name,
            scientificName: item.scientificName,
            position: item.position,
            note: item.note,
            createdAt: item.createdAt,
          })),
        )
        setCatalogEntries(
          mergeCatalog(
            seedBioCatalog,
            cloudData.catalog.map((item) => ({
              aliases: item.aliases,
              type: item.type as BioType,
              scientificName: item.scientificName,
              position: item.position,
              note: item.note,
            })),
          ),
        )
        setProtocolDefinitions(
          cloudData.protocolDefinitions.length
            ? cloudData.protocolDefinitions.map((item) => ({
                key: item.protocolKey as ProtocolKey,
                label: item.label,
                days: item.days,
                quantity: item.quantity,
                unit: item.unit,
              }))
            : localProtocolDefinitions,
        )
        setProtocolChecks(
          cloudData.protocolChecks.map((item) => ({
            id: item.id,
            protocolKey: item.protocolKey as ProtocolKey,
            weekStart: item.weekStart,
            dayIndex: item.dayIndex,
            checkedAt: item.checkedAt,
            quantity: item.quantity,
            unit: item.unit,
            note: item.note,
          })),
        )
        setProtocolLogs(
          cloudData.protocolLogs.map((item) => ({
            id: item.id,
            protocolKey: item.protocolKey as ProtocolKey,
            performedAt: item.performedAt,
            note: item.note,
          })),
        )
        if (cloudData.lightingPhases.length) {
          const mappedLighting = cloudData.lightingPhases.map((item) => ({
            id: item.id,
            name: item.name,
            time: normalizeTime(String(item.time)),
            uv: item.uv,
            white: item.white,
            blue: item.blue,
          }))
          const { normalized, idsToDelete, needsWriteBack } =
            normalizeLightingFromCloud(mappedLighting)
          if (needsWriteBack) {
            await upsertCloudLightingPhases(
              normalized.map((item) => ({
                id: item.id,
                name: item.name,
                time: item.time,
                uv: item.uv,
                white: item.white,
                blue: item.blue,
              })),
              userId,
            )
            await Promise.all(idsToDelete.map((id) => deleteCloudLightingPhase(id)))
          }
          setLightingPhases(normalized)
        } else {
          setLightingPhases(localLighting)
        }
        setSyncState('online')
        setSyncErrorDetail(null)
      } catch (error) {
        logError('sync-loadData', error)
        const baseSafe = new Map<ParameterKey, { min: number; max: number }>()
        for (const definition of parameterDefinitions) {
          if (definition.min === undefined || definition.max === undefined) continue
          baseSafe.set(definition.key, { min: definition.min, max: definition.max })
        }
        const finalSafe = new Map(baseSafe)
        for (const item of localTankSettingsMap.values()) {
          if (!item.isCustomEnabled) continue
          if (item.customMin === null || item.customMax === null) continue
          if (!Number.isFinite(item.customMin) || !Number.isFinite(item.customMax)) continue
          finalSafe.set(item.parameter, { min: item.customMin, max: item.customMax })
        }
        setEntries(localEntries)
        setBioEntries(localBio)
        setCatalogEntries(mergeCatalog(seedBioCatalog, localCatalog))
        setProtocolDefinitions(localProtocolDefinitions)
        setProtocolChecks(localProtocolChecks)
        setProtocolLogs(localProtocolLogs)
        setLightingPhases(localLighting)
        setSafeZones(finalSafe)
        setSafeZonesBase(baseSafe)
        setTankSettings(localTankSettingsMap)
        setSavedTankSettings(new Map(localTankSettingsMap))
        setCloudConsumptionRates(new Map())
        setSyncState('error')
        const detail = formatSyncError(error)
        setSyncErrorDetail(typeof syncStage === 'string' ? `${syncStage}: ${detail}` : detail)
      }
    }

    void loadData()
  }, [
    authUser,
    bioEntriesStorageKey,
    catalogStorageKey,
    entriesStorageKey,
    isAuthLoading,
    lightingPhasesStorageKey,
    protocolChecksStorageKey,
    protocolDefinitionsStorageKey,
    protocolLogsStorageKey,
    tankSettingsStorageKey,
    syncReloadNonce,
  ])

  useEffect(() => {
    const base = new Map<ParameterKey, { min: number; max: number }>(safeZonesBase)
    for (const definition of parameterDefinitions) {
      if (definition.min === undefined || definition.max === undefined) continue
      if (base.has(definition.key)) continue
      base.set(definition.key, { min: definition.min, max: definition.max })
    }
    const next = new Map(base)
    for (const setting of tankSettings.values()) {
      if (!setting.isCustomEnabled) continue
      if (setting.customMin === null || setting.customMax === null) continue
      if (!Number.isFinite(setting.customMin) || !Number.isFinite(setting.customMax)) continue
      next.set(setting.parameter, { min: setting.customMin, max: setting.customMax })
    }
    setSafeZones(next)
  }, [safeZonesBase, tankSettings])

  useEffect(() => {
    if (!entriesStorageKey) return
    safeLocalStorageSetItem(entriesStorageKey, JSON.stringify(entries))
  }, [entries, entriesStorageKey])

  useEffect(() => {
    if (!bioEntriesStorageKey) return
    safeLocalStorageSetItem(bioEntriesStorageKey, JSON.stringify(bioEntries))
  }, [bioEntries, bioEntriesStorageKey])

  useEffect(() => {
    if (!protocolLogsStorageKey) return
    safeLocalStorageSetItem(protocolLogsStorageKey, JSON.stringify(protocolLogs))
  }, [protocolLogs, protocolLogsStorageKey])

  useEffect(() => {
    if (!protocolDefinitionsStorageKey) return
    safeLocalStorageSetItem(protocolDefinitionsStorageKey, JSON.stringify(protocolDefinitions))
  }, [protocolDefinitions, protocolDefinitionsStorageKey])

  useEffect(() => {
    if (!protocolChecksStorageKey) return
    safeLocalStorageSetItem(protocolChecksStorageKey, JSON.stringify(protocolChecks))
  }, [protocolChecks, protocolChecksStorageKey])

  useEffect(() => {
    if (!lightingPhasesStorageKey) return
    safeLocalStorageSetItem(lightingPhasesStorageKey, JSON.stringify(lightingPhases))
  }, [lightingPhases, lightingPhasesStorageKey])

  useEffect(() => {
    if (!tankSettingsStorageKey) return
    safeLocalStorageSetItem(tankSettingsStorageKey, JSON.stringify(Array.from(tankSettings.values())))
  }, [tankSettings, tankSettingsStorageKey])

  useEffect(() => {
    const extras = catalogEntries.filter(
      (entry) =>
        !seedBioCatalog.some((seed) =>
          seed.aliases.some((seedAlias) =>
            entry.aliases.some((alias) => normalize(alias) === normalize(seedAlias)),
          ),
        ),
    )
    if (!catalogStorageKey) return
    safeLocalStorageSetItem(catalogStorageKey, JSON.stringify(extras))
  }, [catalogEntries, catalogStorageKey])

  const latestByParameter = useMemo(() => {
    const map = new Map<ParameterKey, ParameterEntry>()
    for (const entry of entries) {
      const current = map.get(entry.parameter)
      if (
        !current ||
        new Date(entry.measuredAt).getTime() > new Date(current.measuredAt).getTime()
      ) {
        map.set(entry.parameter, entry)
      }
    }
    return parameterDefinitions.map((definition) => ({
      definition,
      latest: map.get(definition.key),
    }))
  }, [entries])

  const filteredEntries = useMemo(() => {
    const threshold = nowMs - periodDays * 86400000
    return entries
      .filter((entry) => new Date(entry.measuredAt).getTime() >= threshold)
      .filter((entry) =>
        filterParameter === 'todos' ? true : entry.parameter === filterParameter,
      )
      .sort(
        (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime(),
      )
  }, [entries, filterParameter, nowMs, periodDays])

  const dashboardEntries = useMemo(() => {
    const threshold = nowMs - dashboardPeriodDays * 86400000
    return entries
      .filter((entry) => new Date(entry.measuredAt).getTime() >= threshold)
      .sort(
        (a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime(),
      )
  }, [dashboardPeriodDays, entries, nowMs])

  const chartPaths = useMemo(() => {
    if (dashboardEntries.length === 0) return []
    const width = 320
    const height = 120
    const paddingTop = 14
    const paddingBottom = 10

    const orderMap = new Map<string, number>()
    parameterDefinitions.forEach((definition, index) => {
      orderMap.set(definition.key, index)
    })

    const entriesByKey = new Map<string, ParameterEntry[]>()
    for (const entry of dashboardEntries) {
      const list = entriesByKey.get(entry.parameter)
      if (list) list.push(entry)
      else entriesByKey.set(entry.parameter, [entry])
    }

    const keys = Array.from(entriesByKey.keys()).sort((a, b) => {
      const ao = orderMap.get(a)
      const bo = orderMap.get(b)
      if (ao !== undefined && bo !== undefined) return ao - bo
      if (ao !== undefined) return -1
      if (bo !== undefined) return 1
      return a.localeCompare(b, 'pt-BR')
    })

    const laneCount = keys.length
    let laneGap = laneCount <= 6 ? 10 : laneCount <= 10 ? 6 : 3
    let laneHeight =
      laneCount > 0 ? (height - paddingTop - paddingBottom - (laneCount - 1) * laneGap) / laneCount : 0
    if (laneHeight < 8) {
      laneGap = 2
      laneHeight =
        laneCount > 0
          ? (height - paddingTop - paddingBottom - (laneCount - 1) * laneGap) / laneCount
          : 0
    }
    laneHeight = Math.max(5, laneHeight)

    return keys
      .map((key, laneIndex) => {
        const seriesEntries =
          entriesByKey.get(key)?.slice().sort((a, b) => {
            return new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime()
          }) ?? []
        if (seriesEntries.length === 0) return null

        const seriesTimestamps = seriesEntries.map((entry) => new Date(entry.measuredAt).getTime())
        const minTimestamp = Math.min(...seriesTimestamps)
        const maxTimestamp = Math.max(...seriesTimestamps)
        const timestampRange = maxTimestamp - minTimestamp || 1

        const definition = parameterDefinitions.find((d) => d.key === key)
        const label = definition?.label ?? key
        const color = getSeriesColor(key)

        const values = seriesEntries.map((entry) => entry.value)
        const minValue = Math.min(...values)
        const maxValue = Math.max(...values)
        const range = maxValue - minValue

        const laneTop = paddingTop + laneIndex * (laneHeight + laneGap)
        const points: ChartPoint[] = seriesEntries.map((entry) => {
          const x =
            ((new Date(entry.measuredAt).getTime() - minTimestamp) / timestampRange) * width
          const normalized = range === 0 ? 0.5 : (entry.value - minValue) / range
          const y = laneTop + laneHeight - normalized * laneHeight
          return { x, y }
        })

        const pointsInLane = points.map((point) => ({ x: point.x, y: point.y - laneTop }))

        const safe = safeZones.get(key as ParameterKey) ?? null
        const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
        const safeBand =
          safe && range !== 0
            ? (() => {
                const yMinRaw = laneTop + laneHeight - ((safe.min - minValue) / range) * laneHeight
                const yMaxRaw = laneTop + laneHeight - ((safe.max - minValue) / range) * laneHeight
                const y0 = clamp(Math.min(yMinRaw, yMaxRaw), laneTop, laneTop + laneHeight)
                const y1 = clamp(Math.max(yMinRaw, yMaxRaw), laneTop, laneTop + laneHeight)
                const h = y1 - y0
                if (h <= 1) return null
                return { y: y0, height: h }
              })()
            : null

        const safeBandInLane = safeBand ? { y: safeBand.y - laneTop, height: safeBand.height } : null

        return {
          key,
          label,
          color,
          laneIndex,
          laneTop,
          laneHeight,
          laneGap,
          path: buildMonotonePath(points),
          points,
          lanePath: buildMonotonePath(pointsInLane),
          lanePoints: pointsInLane,
          safeBand,
          safeBandInLane,
        }
      })
      .filter(
        (
          value,
        ): value is {
          key: string
          label: string
          color: string
          laneIndex: number
          laneTop: number
          laneHeight: number
          laneGap: number
          path: string
          points: ChartPoint[]
          lanePath: string
          lanePoints: ChartPoint[]
          safeBand: { y: number; height: number } | null
          safeBandInLane: { y: number; height: number } | null
        } => Boolean(value),
      )
  }, [dashboardEntries, safeZones])

  const parameterInsights = useMemo(() => {
    const map = new Map<ParameterKey, ParameterInsight>()
    for (const definition of parameterDefinitions) {
      map.set(definition.key, computeParameterInsight(entries, definition, safeZones))
    }
    return map
  }, [entries, safeZones])

  const dashboardInsightCards = useMemo(() => {
    const candidates = parameterDefinitions
      .map((definition) => ({ definition, insight: parameterInsights.get(definition.key) ?? null }))
      .filter(
        (item) => {
          const latest = item.insight?.latest
          if (!latest) return false
          const cloudRate = cloudConsumptionRates.get(item.definition.key)
          const rate = cloudRate ?? item.insight?.dailyRate ?? null
          return rate !== null && Number.isFinite(rate)
        },
      )
      .sort(
        (a, b) => {
          const aRate = cloudConsumptionRates.get(a.definition.key) ?? a.insight?.dailyRate ?? 0
          const bRate = cloudConsumptionRates.get(b.definition.key) ?? b.insight?.dailyRate ?? 0
          return Math.abs(bRate) - Math.abs(aRate)
        },
      )
      .slice(0, 4)

    return candidates
      .map(({ definition, insight }) => {
        const latest = insight?.latest
        if (!latest) return null
        const rate = cloudConsumptionRates.get(definition.key) ?? insight?.dailyRate ?? null
        if (rate === null || !Number.isFinite(rate)) return null
        const isConsumption = rate < 0 && ['kh', 'calcio', 'magnesio'].includes(definition.key)
        const metricLabel = isConsumption ? 'Consumo estimado' : 'Variação estimada'
        const rateLabel = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(
          isConsumption ? Math.abs(rate) : rate,
        )
        const rateSuffix = definition.unit ? ` ${definition.unit}/dia` : ' /dia'
        const daysLabel = cloudConsumptionRates.has(definition.key)
          ? ' (base: Supabase)'
          : insight?.daysBetween !== null
            ? ` (base: ${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(insight.daysBetween)} dias)`
            : ''

        let autonomy = ''
        const safe = safeZones.get(definition.key) ?? null
        if (safe) {
          const min = safe.min
          const max = safe.max
          const daysToLeaveSafe =
            rate > 0 ? (max - latest.value) / rate : rate < 0 ? (latest.value - min) / Math.abs(rate) : null
          if (daysToLeaveSafe !== null && Number.isFinite(daysToLeaveSafe) && daysToLeaveSafe > 0) {
            autonomy = ` · Sai da zona segura em ~${new Intl.NumberFormat('pt-BR', {
              maximumFractionDigits: 0,
            }).format(daysToLeaveSafe)} dias`
          }
        } else if (insight?.projectedDaysToCriticalMin !== null && Number.isFinite(insight.projectedDaysToCriticalMin)) {
          autonomy = ` · Limite em ~${new Intl.NumberFormat('pt-BR', {
            maximumFractionDigits: 0,
          }).format(insight.projectedDaysToCriticalMin)} dias`
        } else if (insight?.projectedDaysToBound !== null && Number.isFinite(insight.projectedDaysToBound)) {
          autonomy = ` · Sai do ideal em ~${new Intl.NumberFormat('pt-BR', {
            maximumFractionDigits: 0,
          }).format(insight.projectedDaysToBound)} dias`
        }

        return `${definition.label}: ${metricLabel} ${rateLabel}${rateSuffix}${daysLabel}${autonomy}`
      })
      .filter((value): value is string => Boolean(value))
  }, [cloudConsumptionRates, parameterInsights, safeZones])

  const safeZoneAlertCards = useMemo(() => {
    const formatNumber = (value: number) =>
      new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(value)

    const cards: string[] = []
    for (const definition of parameterDefinitions) {
      const safe = safeZones.get(definition.key)
      if (!safe) continue
      const latest = latestByParameter.find((item) => item.definition.key === definition.key)?.latest
      if (!latest) continue

      const min = safe.min
      const max = safe.max
      const value = latest.value
      if (value >= min && value <= max) continue

      const rate = cloudConsumptionRates.get(definition.key) ?? null
      const rangeLabel = `${formatNumber(min)}–${formatNumber(max)}${definition.unit ? ` ${definition.unit}` : ''}`.trim()
      const valueLabel = `${formatNumber(value)}${definition.unit ? ` ${definition.unit}` : ''}`.trim()

      let projection = ''
      if (rate !== null && Number.isFinite(rate) && rate !== 0) {
        if (value < min && rate > 0) {
          const days = (min - value) / rate
          if (Number.isFinite(days) && days > 0) {
            projection = ` · Volta em ~${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(days)} dias`
          }
        } else if (value > max && rate < 0) {
          const days = (value - max) / Math.abs(rate)
          if (Number.isFinite(days) && days > 0) {
            projection = ` · Volta em ~${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(days)} dias`
          }
        }
      }

      cards.push(`${definition.label}: ${valueLabel} · Fora da zona segura (${rangeLabel})${projection}`)
    }
    return cards
  }, [cloudConsumptionRates, latestByParameter, safeZones])

  const dashboardAlertCards = useMemo(() => {
    const insightCards = parameterDefinitions
      .map((definition) => {
        const insight = parameterInsights.get(definition.key)
        const latest = insight?.latest ?? null
        if (!insight || !latest) return null
        if (insight.badge === 'Ideal' || insight.badge === 'Sem faixa') return null

        const valueLabel = `${new Intl.NumberFormat('pt-BR', {
          maximumFractionDigits: 3,
        }).format(latest.value)}${definition.unit ? ` ${definition.unit}` : ''}`.trim()

        const rateLabel =
          insight.dailyRate !== null && Number.isFinite(insight.dailyRate)
            ? `${formatSigned(insight.dailyRate, 3)}${definition.unit ? ` ${definition.unit}/dia` : ' /dia'}`
            : null

        const autonomyLabel =
          insight.projectedDaysToCriticalMin !== null && Number.isFinite(insight.projectedDaysToCriticalMin)
            ? `Limite em ~${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(insight.projectedDaysToCriticalMin)} dias`
            : insight.projectedDaysToBound !== null && Number.isFinite(insight.projectedDaysToBound)
              ? `Sai do ideal em ~${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(insight.projectedDaysToBound)} dias`
              : null

        const details = [rateLabel, autonomyLabel].filter(Boolean).join(' · ')
        return `${definition.label}: ${valueLabel} · ${insight.badge}${details ? ` · ${details}` : ''}`
      })
      .filter((value): value is string => Boolean(value))

    return [...safeZoneAlertCards, ...insightCards]
  }, [parameterInsights, safeZoneAlertCards])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!value) return
    const parsedValue = Number(value)
    if (!Number.isFinite(parsedValue)) return
    const newEntry: ParameterEntry = {
      id: crypto.randomUUID(),
      parameter,
      value: normalizeParameterValue(parameter, parsedValue),
      measuredAt: new Date().toISOString(),
      note,
    }

    const previousEntry = pickLatestEntry(
      entries.filter((entry) => entry.parameter === newEntry.parameter),
    )
    const delta = previousEntry ? newEntry.value - previousEntry.value : null
    const daysBetween =
      previousEntry !== null
        ? (new Date(newEntry.measuredAt).getTime() - new Date(previousEntry.measuredAt).getTime()) /
          86400000
        : null
    const dailyRate =
      delta !== null && daysBetween !== null && daysBetween >= MIN_RATE_INTERVAL_DAYS
        ? delta / daysBetween
        : null

    const performedAtMs = new Date(newEntry.measuredAt).getTime()
    const latestProtocolLog =
      protocolLogs
        .filter((log) => new Date(log.performedAt).getTime() <= performedAtMs)
        .slice()
        .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime())[0] ??
      null
    const protocolLabel =
      latestProtocolLog?.protocolKey
        ? protocolDefinitions.find((d) => d.key === latestProtocolLog.protocolKey)?.label ?? null
        : null

    let deltaSinceProtocol: number | null = null
    if (latestProtocolLog) {
      const latestParameterBeforeProtocol = pickLatestEntry(
        entries
          .filter((entry) => entry.parameter === newEntry.parameter)
          .filter(
            (entry) =>
              new Date(entry.measuredAt).getTime() <=
              new Date(latestProtocolLog.performedAt).getTime(),
          ),
      )
      if (latestParameterBeforeProtocol) {
        deltaSinceProtocol = newEntry.value - latestParameterBeforeProtocol.value
      }
    }

    setLastMeasurementFeedback({
      parameter: newEntry.parameter,
      value: newEntry.value,
      measuredAt: newEntry.measuredAt,
      previousValue: previousEntry?.value ?? null,
      delta,
      daysBetween: daysBetween !== null && Number.isFinite(daysBetween) ? daysBetween : null,
      dailyRate,
      protocolLabel,
      protocolPerformedAt: latestProtocolLog?.performedAt ?? null,
      deltaSinceProtocol,
    })

    if (newEntry.parameter === 'ph') {
      const minCritical = criticalLimitsByParameter.ph?.min
      const maxCritical = criticalLimitsByParameter.ph?.max
      if (
        (minCritical !== undefined && newEntry.value < minCritical) ||
        (maxCritical !== undefined && newEntry.value > maxCritical)
      ) {
        const rangeLabel =
          minCritical !== undefined && maxCritical !== undefined
            ? `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(minCritical)}–${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(maxCritical)}`
            : ''
        const message =
          minCritical !== undefined && newEntry.value < minCritical
            ? `pH abaixo do recomendado (${rangeLabel}). Causas comuns: CO₂ alto no ambiente, baixa aeração/troca gasosa, excesso de carga orgânica, efluente ácido de reator de cálcio. Ações seguras: aumentar aeração, melhorar captação de ar do skimmer (ou scrubber de CO₂), conferir alcalinidade e evitar correções bruscas.`
            : `pH acima do recomendado (${rangeLabel}). Causas comuns: excesso de kalkwasser/álcali, fotoperíodo e macroalgas elevando pH no pico, baixa disponibilidade de CO₂. Ações seguras: reduzir correções, revisar dosagens e confirmar leitura (calibração/sonda/teste).`
        setParameterAlert({ title: 'Alerta de pH', message })
      }
    }

    setEntries((current) => [...current, newEntry])
    if (isSupabaseEnabled && authUser) {
      enqueueCloudWrite('Medição de parâmetro', async () => {
        await upsertCloudParameter(
          {
            id: newEntry.id,
            parameter: newEntry.parameter,
            value: newEntry.value,
            measuredAt: newEntry.measuredAt,
            note: newEntry.note,
          },
          authUser.id,
        )
      })
    }
    setValue('')
    setNote('')
  }

  const handleDeleteParameterEntry = async (entryId: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== entryId))
    if (isSupabaseEnabled && authUser) {
      enqueueCloudWrite('Excluir medição de parâmetro', async () => {
        await deleteCloudParameter(entryId)
      })
    }
  }

  const handleAddBio = async (event: FormEvent) => {
    event.preventDefault()
    if (!bioName.trim()) return
    const catalogMatch = findCatalogMatch(bioName) ?? findInCatalog(bioName)
    const entryId = bioEditingId ?? crypto.randomUUID()
    const existing = bioEntries.find((item) => item.id === entryId)
    const newBioEntry: BioEntry = {
      id: entryId,
      type: catalogMatch?.type ?? bioType,
      name: bioName.trim(),
      scientificName: bioScientificName.trim() || catalogMatch?.scientificName || '',
      position: bioPosition.trim() || catalogMatch?.position || '',
      note: bioNote.trim() || catalogMatch?.note || '',
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    }
    setBioEntries((current) => {
      if (!bioEditingId) return [...current, newBioEntry]
      return current.map((item) => (item.id === bioEditingId ? newBioEntry : item))
    })
    if (isSupabaseEnabled && authUser) {
      enqueueCloudWrite('Organismo do inventário', async () => {
        await upsertCloudBio(
          {
            id: newBioEntry.id,
            type: newBioEntry.type,
            name: newBioEntry.name,
            scientificName: newBioEntry.scientificName,
            position: newBioEntry.position,
            note: newBioEntry.note,
            createdAt: newBioEntry.createdAt,
          },
          authUser.id,
        )
      })
    }
    setBioName('')
    setBioScientificName('')
    setBioPosition('')
    setBioNote('')
    setBioEditingId(null)
  }

  const handleDeleteBioEntry = async (entryId: string) => {
    setBioEntries((current) => current.filter((entry) => entry.id !== entryId))
    if (bioEditingId === entryId) {
      setBioEditingId(null)
      setBioName('')
      setBioScientificName('')
      setBioPosition('')
      setBioNote('')
    }
    if (isSupabaseEnabled && authUser) {
      enqueueCloudWrite('Excluir organismo do inventário', async () => {
        await deleteCloudBio(entryId)
      })
    }
  }

  const handleStartEditBioEntry = (entry: BioEntry) => {
    setBioEditingId(entry.id)
    setBioType(entry.type)
    setBioName(entry.name)
    setBioScientificName(entry.scientificName)
    setBioPosition(entry.position)
    setBioNote(entry.note)
  }

  const handleCancelEditBioEntry = () => {
    setBioEditingId(null)
    setBioName('')
    setBioScientificName('')
    setBioPosition('')
    setBioNote('')
  }

  const findCatalogMatch = (name: string) => findBestCatalogMatch(name, catalogEntries)

  const openAnimalDetails = (entry: BioEntry) => {
    setAnimalDetailsEntry(entry)
    setAnimalDetailsCatalogEntry(null)
    setAnimalRequirement(null)
    const trimmedScientific = entry.scientificName.trim()
    if (!isSupabaseEnabled) {
      setAnimalRequirementState(trimmedScientific ? 'not_found' : 'idle')
      return
    }

    animalRequirementRequestIdRef.current += 1
    const requestId = animalRequirementRequestIdRef.current
    setAnimalRequirementState('loading')

    void fetchBioDeepDiveByEntryId(entry.id)
      .then((data) => {
        if (animalRequirementRequestIdRef.current !== requestId) return
        if (data?.catalog) setAnimalDetailsCatalogEntry(data.catalog)
        if (data?.requirement) {
          setAnimalRequirement(data.requirement)
          setAnimalRequirementState('found')
          return
        }
        if (!trimmedScientific) {
          setAnimalRequirement(null)
          setAnimalRequirementState('idle')
          return
        }
        void fetchBioRequirementByScientificName(trimmedScientific)
          .then((fallback) => {
            if (animalRequirementRequestIdRef.current !== requestId) return
            if (!fallback) {
              setAnimalRequirement(null)
              setAnimalRequirementState('not_found')
              return
            }
            setAnimalRequirement(fallback)
            setAnimalRequirementState('found')
          })
          .catch((error) => {
            if (animalRequirementRequestIdRef.current !== requestId) return
            logError('bio-details-requirements', error)
            setAnimalRequirement(null)
            setAnimalRequirementState('error')
          })
      })
      .catch((error) => {
        if (animalRequirementRequestIdRef.current !== requestId) return
        logError('bio-details-deep-dive', error)
        if (!trimmedScientific) {
          setAnimalRequirement(null)
          setAnimalRequirementState('idle')
          return
        }
        void fetchBioRequirementByScientificName(trimmedScientific)
          .then((fallback) => {
            if (animalRequirementRequestIdRef.current !== requestId) return
            if (!fallback) {
              setAnimalRequirement(null)
              setAnimalRequirementState('not_found')
              return
            }
            setAnimalRequirement(fallback)
            setAnimalRequirementState('found')
          })
          .catch((fallbackError) => {
            if (animalRequirementRequestIdRef.current !== requestId) return
            logError('bio-details-requirements', fallbackError)
            setAnimalRequirement(null)
            setAnimalRequirementState('error')
          })
      })
  }

  const closeAnimalDetails = () => {
    setAnimalDetailsEntry(null)
    setAnimalDetailsCatalogEntry(null)
    setAnimalRequirement(null)
    setAnimalRequirementState('idle')
  }

  const bioSearchRequestIdRef = useRef(0)
  const bioSearchAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (activeTab !== 'inventario' || !isSupabaseEnabled || !authUser) {
      setBioDeepDivePreviewById(new Map())
      return
    }

    let cancelled = false
    void fetchBioDeepDivePreviews()
      .then((rows) => {
        if (cancelled) return
        const next = new Map<
          string,
          { reefCompatible: string | null; lighting: string | null; flow: string | null }
        >()
        for (const row of rows) {
          next.set(row.entryId, {
            reefCompatible: row.reefCompatible,
            lighting: row.lighting,
            flow: row.flow,
          })
        }
        setBioDeepDivePreviewById(next)
      })
      .catch((error) => {
        if (cancelled) return
        logError('bio-deep-dive-previews', error)
        setBioDeepDivePreviewById(new Map())
      })

    return () => {
      cancelled = true
    }
  }, [activeTab, authUser, bioEntries, isSupabaseEnabled, syncReloadNonce])

  useEffect(() => {
    return () => {
      bioSearchAbortRef.current?.abort()
    }
  }, [])

  const searchExternalBio = async (
    name: string,
    signal?: AbortSignal,
  ): Promise<BioCatalogEntry | null> => {
    const trimmed = name.trim()
    if (!trimmed) return null
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 8000)
    const handleAbort = () => controller.abort()
    if (signal) {
      if (signal.aborted) return null
      signal.addEventListener('abort', handleAbort, { once: true })
    }
    try {
      const gbifResponse = await fetch(
        `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(trimmed)}`,
        { signal: controller.signal },
      )
      if (gbifResponse.ok) {
        const gbifData = await gbifResponse.json()
        if (gbifData?.scientificName) {
          const newEntry: BioCatalogEntry = {
            aliases: [trimmed, gbifData.canonicalName || trimmed],
            type: bioType,
            scientificName: gbifData.scientificName,
            position: '',
            note: 'Adicionado automaticamente por busca externa (GBIF)',
          }
          return newEntry
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return null
      logError('gbif-search', error)
      return null
    } finally {
      window.clearTimeout(timeoutId)
      if (signal) signal.removeEventListener('abort', handleAbort)
    }
    return null
  }

  const fillBioByName = async () => {
    const nameSnapshot = bioName.trim()
    if (!nameSnapshot) return
    const localMatch = findCatalogMatch(nameSnapshot)
    if (localMatch) {
      bioSearchAbortRef.current?.abort()
      setIsSearchingBio(false)
      setBioType(localMatch.type)
      if (!bioScientificName.trim()) setBioScientificName(localMatch.scientificName)
      if (!bioPosition.trim()) setBioPosition(localMatch.position)
      if (!bioNote.trim()) setBioNote(localMatch.note)
      return
    }

    bioSearchRequestIdRef.current += 1
    const requestId = bioSearchRequestIdRef.current
    bioSearchAbortRef.current?.abort()
    const controller = new AbortController()
    bioSearchAbortRef.current = controller

    setIsSearchingBio(true)
    const externalMatch = await searchExternalBio(nameSnapshot, controller.signal)
    if (bioSearchRequestIdRef.current !== requestId) return
    setIsSearchingBio(false)
    if (!externalMatch) return
    setCatalogEntries((current) => mergeCatalog(current, [externalMatch]))
    if (isSupabaseEnabled && authUser) {
      enqueueCloudWrite('Catálogo de organismos', async () => {
        await upsertCloudCatalog(externalMatch, authUser.id)
      })
    }
    setBioType(externalMatch.type)
    if (!bioScientificName.trim()) setBioScientificName(externalMatch.scientificName)
    if (!bioPosition.trim()) setBioPosition(externalMatch.position)
    if (!bioNote.trim()) setBioNote(externalMatch.note)
  }

  const bioNameSuggestions = useMemo(() => {
    const query = normalize(bioName)
    if (query.length < 2) return []
    const seen = new Set<string>()
    const matches: Array<{ label: string; score: number }> = []

    for (const entry of catalogEntries) {
      for (const alias of entry.aliases) {
        const aliasNormalized = normalize(alias)
        const score = scoreTextMatch(query, aliasNormalized)
        if (!score) continue
        if (seen.has(aliasNormalized)) continue
        seen.add(aliasNormalized)
        matches.push({ label: alias, score })
      }
    }

    return matches
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' })
      })
      .slice(0, 12)
      .map((match) => match.label)
  }, [bioName, catalogEntries])

  const faunaItems = useMemo(() => {
    const normalizedSearch = normalize(faunaSearch)
    const filtered = bioEntries
      .filter((item) => item.type === faunaSubmenu)
      .filter((item) =>
        normalizedSearch
          ? `${normalize(item.name)} ${normalize(item.scientificName)}`.includes(
              normalizedSearch,
            )
          : true,
      )
      .slice()

    if (!normalizedSearch) {
      return filtered.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
    }

    return filtered
      .map((item) => {
        const nameScore = scoreTextMatch(normalizedSearch, normalize(item.name))
        const scientificScore = scoreTextMatch(normalizedSearch, normalize(item.scientificName))
        return { item, score: Math.max(nameScore, scientificScore) }
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return new Date(b.item.createdAt).getTime() - new Date(a.item.createdAt).getTime()
      })
      .map(({ item }) => item)
  }, [bioEntries, faunaSubmenu, faunaSearch])

  const faunaCounts = useMemo(() => {
    return {
      todos: bioEntries.length,
      coral: bioEntries.filter((item) => item.type === 'coral').length,
      invertebrado: bioEntries.filter((item) => item.type === 'invertebrado').length,
      peixe: bioEntries.filter((item) => item.type === 'peixe').length,
    }
  }, [bioEntries])

  const [todayKey, setTodayKey] = useState(() => toDateKey(new Date()))

  useEffect(() => {
    const scheduleNextTick = () => {
      const now = new Date()
      const nextMidnight = new Date(now)
      nextMidnight.setHours(24, 0, 0, 0)
      const delay = nextMidnight.getTime() - now.getTime()
      return window.setTimeout(() => {
        setTodayKey(toDateKey(new Date()))
      }, Math.max(1000, delay))
    }

    const timeoutId = scheduleNextTick()
    return () => window.clearTimeout(timeoutId)
  }, [todayKey])

  const protocolWeekStart = useMemo(
    () => startOfWeekMonday(fromDateKey(todayKey)),
    [todayKey],
  )
  const protocolWeekStartKey = useMemo(() => toDateKey(protocolWeekStart), [protocolWeekStart])
  const todayProtocolDayIndex = useMemo(() => {
    const date = fromDateKey(todayKey)
    return ((date.getDay() + 6) % 7) + 1
  }, [todayKey])

  const protocolChecksSorted = useMemo(() => {
    return protocolChecks
      .slice()
      .sort(
        (a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime(),
      )
  }, [protocolChecks])

  const latestProtocolByKey = useMemo(() => {
    const map = new Map<ProtocolKey, ProtocolCheck>()
    for (const log of protocolChecksSorted) {
      if (!map.has(log.protocolKey)) map.set(log.protocolKey, log)
    }
    return map
  }, [protocolChecksSorted])

  const protocolDoneSet = useMemo(() => {
    const set = new Set<string>()
    for (const log of protocolChecks) {
      if (log.weekStart === protocolWeekStartKey) {
        set.add(`${log.protocolKey}:${log.dayIndex}`)
      }
    }
    return set
  }, [protocolChecks, protocolWeekStartKey])

  const protocolsDueToday = useMemo(() => {
    return protocolDefinitions
      .filter((definition) => definition.days.includes(todayProtocolDayIndex))
      .map((definition) => {
        const done = protocolDoneSet.has(`${definition.key}:${todayProtocolDayIndex}`)
        const latest = latestProtocolByKey.get(definition.key) ?? null
        const doseLabel =
          definition.quantity === null
            ? 'Sem quantidade'
            : `${definition.quantity} ${definition.unit}`.trim()
        return { definition, done, latest, doseLabel }
      })
      .filter((item) => !item.done)
      .sort((a, b) => {
        return a.definition.label.localeCompare(b.definition.label, 'pt-BR')
      })
  }, [latestProtocolByKey, protocolDefinitions, protocolDoneSet, todayProtocolDayIndex])

  const isDoneThisWeek = (key: ProtocolKey, dayIndex: number) => {
    return protocolDoneSet.has(`${key}:${dayIndex}`)
  }

  const findCheck = (key: ProtocolKey, dayIndex: number) => {
    return protocolChecks.find(
      (log) =>
        log.protocolKey === key &&
        log.weekStart === protocolWeekStartKey &&
        log.dayIndex === dayIndex,
    )
  }

  const handleToggleProtocolCheck = async (key: ProtocolKey, dayIndex: number) => {
    const existing = findCheck(key, dayIndex)
    if (existing) {
      setProtocolChecks((current) => current.filter((log) => log.id !== existing.id))
      setProtocolLogs((current) => current.filter((log) => log.id !== existing.id))
      if (isSupabaseEnabled && authUser) {
        enqueueCloudWrite('Excluir check de protocolo', async () => {
          await deleteCloudProtocolCheck(existing.id)
        })
        enqueueCloudWrite('Excluir log de protocolo', async () => {
          await deleteCloudProtocolLog(existing.id)
        })
      }
      return
    }

    const definition = protocolDefinitions.find((d) => d.key === key)
    const newCheck: ProtocolCheck = {
      id: crypto.randomUUID(),
      protocolKey: key,
      weekStart: protocolWeekStartKey,
      dayIndex,
      checkedAt: new Date().toISOString(),
      quantity: definition?.quantity ?? null,
      unit: definition?.unit ?? '',
      note: protocolNote,
    }
    setProtocolChecks((current) => [newCheck, ...current])
    setProtocolLogs((current) => [
      {
        id: newCheck.id,
        protocolKey: newCheck.protocolKey,
        performedAt: newCheck.checkedAt,
        note: newCheck.note,
      },
      ...current,
    ])
    setProtocolNote('')
    if (isSupabaseEnabled && authUser) {
      if (definition) {
        enqueueCloudWrite('Definição de protocolo', async () => {
          await upsertCloudProtocolDefinition(
            {
              protocolKey: definition.key,
              label: definition.label,
              days: definition.days,
              quantity: definition.quantity,
              unit: definition.unit,
            },
            authUser.id,
          )
        })
      }
      enqueueCloudWrite('Check de protocolo', async () => {
        await upsertCloudProtocolCheck(
          {
            id: newCheck.id,
            protocolKey: newCheck.protocolKey,
            weekStart: newCheck.weekStart,
            dayIndex: newCheck.dayIndex,
            checkedAt: newCheck.checkedAt,
            quantity: newCheck.quantity,
            unit: newCheck.unit,
            note: newCheck.note,
          },
          authUser.id,
        )
      })
      enqueueCloudWrite('Log de protocolo', async () => {
        await upsertCloudProtocolLog(
          {
            id: newCheck.id,
            protocolKey: newCheck.protocolKey,
            performedAt: newCheck.checkedAt,
            note: newCheck.note,
          },
          authUser.id,
        )
      })
    }
  }

  const handleDeleteProtocolHistoryEntry = async (entryId: string) => {
    setProtocolChecks((current) => current.filter((item) => item.id !== entryId))
    setProtocolLogs((current) => current.filter((item) => item.id !== entryId))
    if (isSupabaseEnabled && authUser) {
      enqueueCloudWrite('Excluir check de protocolo', async () => {
        await deleteCloudProtocolCheck(entryId)
      })
      enqueueCloudWrite('Excluir log de protocolo', async () => {
        await deleteCloudProtocolLog(entryId)
      })
    }
  }

  const handleStartEditProtocol = (definition: ProtocolDefinition) => {
    setProtocolEditingKey(definition.key)
    setProtocolEditLabel(definition.label)
    setProtocolEditDays(definition.days)
    setProtocolEditQuantity(definition.quantity === null ? '' : String(definition.quantity))
    setProtocolEditUnit(definition.unit)
  }

  const handleSaveProtocol = async (key: ProtocolKey) => {
    const parsedQuantity = parseOptionalNumber(protocolEditQuantity)
    const next = protocolDefinitions.map((item) =>
      item.key === key
        ? {
            ...item,
            label: protocolEditLabel.trim() || item.label,
            days: protocolEditDays.slice().sort((a, b) => a - b),
            quantity: parsedQuantity,
            unit: protocolEditUnit.trim(),
          }
        : item,
    )
    setProtocolDefinitions(next)
    setProtocolEditingKey(null)
    setIsProtocolModalOpen(false)
    if (isSupabaseEnabled && authUser) {
      const saved = next.find((d) => d.key === key)
      if (!saved) return
      enqueueCloudWrite('Definição de protocolo', async () => {
        await upsertCloudProtocolDefinition(
          {
            protocolKey: saved.key,
            label: saved.label,
            days: saved.days,
            quantity: saved.quantity,
            unit: saved.unit,
          },
          authUser.id,
        )
      })
    }
  }

  const handleDeleteRoutine = async (key: ProtocolKey) => {
    setProtocolDefinitions((current) => current.filter((item) => item.key !== key))
    setProtocolChecks((current) => current.filter((item) => item.protocolKey !== key))
    setProtocolLogs((current) => current.filter((item) => item.protocolKey !== key))
    if (isSupabaseEnabled && authUser) {
      enqueueCloudWrite('Excluir checks do protocolo', async () => {
        await deleteCloudProtocolChecksByKey(key)
      })
      enqueueCloudWrite('Excluir logs do protocolo', async () => {
        await deleteCloudProtocolLogsByKey(key)
      })
      enqueueCloudWrite('Excluir definição do protocolo', async () => {
        await deleteCloudProtocolDefinition(key)
      })
    }
  }

  const openAddRoutineModal = () => {
    setProtocolModalMode('add')
    setProtocolAddLabel('')
    setProtocolAddDays([])
    setProtocolAddQuantity('')
    setProtocolAddUnit('ml')
    setIsProtocolModalOpen(true)
  }

  const openEditRoutineModal = (definition: ProtocolDefinition) => {
    setProtocolModalMode('edit')
    handleStartEditProtocol(definition)
    setIsProtocolModalOpen(true)
  }

  const closeProtocolModal = () => {
    setIsProtocolModalOpen(false)
    setProtocolEditingKey(null)
  }

  const openEditLightingModal = (phase: LightingPhase) => {
    setLightingEditingId(phase.id)
    setLightingEditName(phase.name)
    setLightingEditTime(phase.time)
    setLightingEditUv(String(phase.uv))
    setLightingEditWhite(String(phase.white))
    setLightingEditBlue(String(phase.blue))
    setIsLightingModalOpen(true)
  }

  const closeLightingModal = () => {
    setIsLightingModalOpen(false)
    setLightingEditingId(null)
  }

  const handleSaveLightingPhase = async () => {
    if (!lightingEditingId) return
    const next: LightingPhase[] = lightingPhases
      .map((item) =>
        item.id === lightingEditingId
          ? {
              ...item,
              name: lightingEditName.trim() || item.name,
              time: lightingEditTime,
              uv: parseNumberWithFallback(lightingEditUv, item.uv),
              white: parseNumberWithFallback(lightingEditWhite, item.white),
              blue: parseNumberWithFallback(lightingEditBlue, item.blue),
            }
          : item,
      )
      .slice()
      .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))

    setLightingPhases(next)
    setIsLightingModalOpen(false)
    if (isSupabaseEnabled && authUser) {
      const saved = next.find((item) => item.id === lightingEditingId)
      if (!saved) return
      enqueueCloudWrite('Fase de iluminação', async () => {
        await upsertCloudLightingPhase(saved, authUser.id)
      })
    }
  }

  const handleAddRoutine = async () => {
    const label = protocolAddLabel.trim()
    if (!label) return
    const days = protocolAddDays.slice().sort((a, b) => a - b)
    if (days.length === 0) return
    const parsedQuantity = parseOptionalNumber(protocolAddQuantity)
    const unit = protocolAddUnit.trim()
    const key = buildProtocolKey(label)
    const newDefinition: ProtocolDefinition = { key, label, days, quantity: parsedQuantity, unit }
    setProtocolDefinitions((current) => [...current, newDefinition])
    setProtocolAddLabel('')
    setProtocolAddDays([])
    setProtocolAddQuantity('')
    setProtocolAddUnit('ml')
    setIsProtocolModalOpen(false)
    if (isSupabaseEnabled && authUser) {
      enqueueCloudWrite('Definição de protocolo', async () => {
        await upsertCloudProtocolDefinition(
          {
            protocolKey: newDefinition.key,
            label: newDefinition.label,
            days: newDefinition.days,
            quantity: newDefinition.quantity,
            unit: newDefinition.unit,
          },
          authUser.id,
        )
      })
    }
  }

  const hasPendingTankSettingsChanges =
    normalizeTankSettingsSnapshot(tankSettings) !== normalizeTankSettingsSnapshot(savedTankSettings)

  if (isSupabaseEnabled && isAuthLoading) {
    return (
      <main className="app">
        <Header
          mode="loading"
          message="Carregando login..."
          uiSettings={uiSettings}
          isSupabaseEnabled={isSupabaseEnabled}
          authUser={authUser}
          profileAvatarUrl={profileAvatarUrl}
          isProfileMenuOpen={isProfileMenuOpen}
          setIsProfileMenuOpen={setIsProfileMenuOpen}
          handleRequestAvatarChange={handleRequestAvatarChange}
          handleOpenSettings={handleOpenSettings}
          handleRemoveAvatar={handleRemoveAvatar}
          handleLogout={handleLogout}
          avatarInputRef={avatarInputRef}
          handleAvatarChange={handleAvatarChange}
          syncState={syncState === 'online' && pendingWrites > 0 ? 'syncing' : syncState}
          syncErrorDetail={syncErrorDetail}
          pendingWrites={pendingWrites}
          storageError={storageError}
          onRetrySync={handleRetrySync}
        />
      </main>
    )
  }

  if (isSupabaseEnabled && !authUser) {
    return (
      <main className="app auth-screen">
        <section className="auth-card">
          <h1>{DEFAULT_UI_SETTINGS.title}</h1>
          <p className="auth-subtitle">Entre com Google para ver apenas seus registros</p>
          <button type="button" className="google-btn" onClick={handleGoogleLogin}>
            <span className="google-icon" aria-hidden="true">
              <svg viewBox="0 0 48 48">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.1 0 5.9 1.1 8.1 3.2l6-6C34.5 3.2 29.6 1 24 1 14.9 1 7.1 6.2 3.3 13.8l7.4 5.7C12.6 13.6 17.9 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.5 24.5c0-1.6-.1-2.7-.4-4H24v7.6h12.8c-.3 2-1.7 5.1-4.9 7.2l7.5 5.8c4.4-4.1 7.1-10.2 7.1-17.6z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.7 28.4c-.5-1.4-.8-2.9-.8-4.4s.3-3 .8-4.4l-7.4-5.7C1.9 16.7 1 20.2 1 24s.9 7.3 2.3 10.1l7.4-5.7z"
                />
                <path
                  fill="#34A853"
                  d="M24 47c5.6 0 10.3-1.8 13.7-5l-7.5-5.8c-2 1.4-4.7 2.4-6.2 2.4-6.1 0-11.4-4.1-13.3-9.9l-7.4 5.7C7.1 41.8 14.9 47 24 47z"
                />
              </svg>
            </span>
            Entrar com Google
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="app">
      <Header
        mode="main"
        uiSettings={uiSettings}
        isSupabaseEnabled={isSupabaseEnabled}
        authUser={authUser}
        profileAvatarUrl={profileAvatarUrl}
        isProfileMenuOpen={isProfileMenuOpen}
        setIsProfileMenuOpen={setIsProfileMenuOpen}
        handleRequestAvatarChange={handleRequestAvatarChange}
        handleOpenSettings={handleOpenSettings}
        handleRemoveAvatar={handleRemoveAvatar}
        handleLogout={handleLogout}
        avatarInputRef={avatarInputRef}
        handleAvatarChange={handleAvatarChange}
        syncState={syncState === 'online' && pendingWrites > 0 ? 'syncing' : syncState}
        syncErrorDetail={syncErrorDetail}
        pendingWrites={pendingWrites}
        storageError={storageError}
        onRetrySync={handleRetrySync}
      />
      <ParameterAlertModal alert={parameterAlert} onClose={() => setParameterAlert(null)} />
      {isSettingsOpen && (
        <SettingsModal
          uiSettings={uiSettings}
          defaultTitle={DEFAULT_UI_SETTINGS.title}
          onClose={handleCloseSettings}
          onSave={handleSaveUiSettings}
        />
      )}
      {animalDetailsEntry && (
        <AnimalDetailsModal
          entry={animalDetailsEntry}
          catalogEntry={
            animalDetailsCatalogEntry ??
            findCatalogMatch(animalDetailsEntry.name) ??
            (animalDetailsEntry.scientificName.trim()
              ? findCatalogMatch(animalDetailsEntry.scientificName)
              : null) ??
            null
          }
          requirementState={animalRequirementState}
          requirement={animalRequirement}
          formatDate={formatDate}
          onClose={closeAnimalDetails}
          onEdit={() => {
            handleStartEditBioEntry(animalDetailsEntry)
            closeAnimalDetails()
            setActiveTab('inventario')
          }}
          onDelete={() => {
            void handleDeleteBioEntry(animalDetailsEntry.id)
            closeAnimalDetails()
          }}
        />
      )}

      <nav className="tabs">
        <button
          className={activeTab === 'dashboard' ? 'active' : ''}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button
          className={activeTab === 'parametros' ? 'active' : ''}
          onClick={() => setActiveTab('parametros')}
        >
          Parâmetros
        </button>
        <button
          className={activeTab === 'protocolos' ? 'active' : ''}
          onClick={() => setActiveTab('protocolos')}
        >
          Protocolos
        </button>
        <button
          className={activeTab === 'iluminacao' ? 'active' : ''}
          onClick={() => setActiveTab('iluminacao')}
        >
          Iluminação
        </button>
        <button
          className={activeTab === 'inventario' ? 'active' : ''}
          onClick={() => setActiveTab('inventario')}
        >
          Inventário
        </button>
        <button
          className={activeTab === 'configuracoes' ? 'active' : ''}
          onClick={() => setActiveTab('configuracoes')}
        >
          Configurações
        </button>
      </nav>

      {activeTab === 'dashboard' && (
        <DashboardTab
          latestByParameter={latestByParameter}
          parameterInsights={parameterInsights}
          safeZones={safeZones}
          cloudConsumptionRates={cloudConsumptionRates}
          formatSigned={formatSigned}
          arrowSymbol={arrowSymbol}
          dashboardPeriodDays={dashboardPeriodDays}
          setDashboardPeriodDays={setDashboardPeriodDays}
          chartPaths={chartPaths}
          dashboardAlertCards={dashboardAlertCards}
          dashboardInsightCards={dashboardInsightCards}
          dayLabel={dayLabels[(todayProtocolDayIndex + 6) % 7]}
          protocolsDueToday={protocolsDueToday}
          formatDate={formatDate}
          onToggleProtocolCheck={(key, dayIndex) => void handleToggleProtocolCheck(key, dayIndex)}
          todayProtocolDayIndex={todayProtocolDayIndex}
        />
      )}

      {activeTab === 'parametros' && (
        <ParametersTab
          parameterDefinitions={parameterDefinitions}
          parameter={parameter}
          setParameter={setParameter}
          value={value}
          setValue={setValue}
          note={note}
          setNote={setNote}
          onSubmit={handleSubmit}
          lastMeasurementFeedback={lastMeasurementFeedback}
          formatDate={formatDate}
          formatSigned={formatSigned}
          filterParameter={filterParameter}
          setFilterParameter={setFilterParameter}
          periodDays={periodDays}
          setPeriodDays={setPeriodDays}
          filteredEntries={filteredEntries}
          onDeleteEntry={handleDeleteParameterEntry}
        />
      )}

      {activeTab === 'protocolos' && (
        <ProtocolsTab
          protocolNote={protocolNote}
          setProtocolNote={setProtocolNote}
          protocolDefinitions={protocolDefinitions}
          latestProtocolByKey={latestProtocolByKey}
          formatDays={formatDays}
          formatDate={formatDate}
          dayLabels={dayLabels}
          isDoneThisWeek={isDoneThisWeek}
          onToggleProtocolCheck={(key, dayIndex) => void handleToggleProtocolCheck(key, dayIndex)}
          openAddRoutineModal={openAddRoutineModal}
          openEditRoutineModal={openEditRoutineModal}
          onDeleteRoutine={(key) => void handleDeleteRoutine(key)}
          protocolChecksSorted={protocolChecksSorted}
          onDeleteProtocolHistoryEntry={(id) => void handleDeleteProtocolHistoryEntry(id)}
          isProtocolModalOpen={isProtocolModalOpen}
          closeProtocolModal={closeProtocolModal}
          protocolModalMode={protocolModalMode}
          protocolEditingKey={protocolEditingKey}
          protocolAddLabel={protocolAddLabel}
          setProtocolAddLabel={setProtocolAddLabel}
          protocolAddDays={protocolAddDays}
          setProtocolAddDays={setProtocolAddDays}
          protocolAddQuantity={protocolAddQuantity}
          setProtocolAddQuantity={setProtocolAddQuantity}
          protocolAddUnit={protocolAddUnit}
          setProtocolAddUnit={setProtocolAddUnit}
          onAddRoutine={() => void handleAddRoutine()}
          protocolEditLabel={protocolEditLabel}
          setProtocolEditLabel={setProtocolEditLabel}
          protocolEditDays={protocolEditDays}
          setProtocolEditDays={setProtocolEditDays}
          protocolEditQuantity={protocolEditQuantity}
          setProtocolEditQuantity={setProtocolEditQuantity}
          protocolEditUnit={protocolEditUnit}
          setProtocolEditUnit={setProtocolEditUnit}
          onSaveProtocol={(key) => void handleSaveProtocol(key)}
        />
      )}

      {activeTab === 'iluminacao' && (
        <LightingTab
          lightingPhases={lightingPhases}
          timeToMinutes={timeToMinutes}
          openEditLightingModal={openEditLightingModal}
          isLightingModalOpen={isLightingModalOpen}
          closeLightingModal={closeLightingModal}
          lightingEditName={lightingEditName}
          setLightingEditName={setLightingEditName}
          lightingEditTime={lightingEditTime}
          setLightingEditTime={setLightingEditTime}
          lightingEditUv={lightingEditUv}
          setLightingEditUv={setLightingEditUv}
          lightingEditWhite={lightingEditWhite}
          setLightingEditWhite={setLightingEditWhite}
          lightingEditBlue={lightingEditBlue}
          setLightingEditBlue={setLightingEditBlue}
          onSaveLightingPhase={() => void handleSaveLightingPhase()}
        />
      )}

      {activeTab === 'inventario' && (
        <InventoryTab
          onSubmitBio={(event) => void handleAddBio(event)}
          bioType={bioType}
          setBioType={setBioType}
          bioName={bioName}
          setBioName={setBioName}
          bioNameSuggestions={bioNameSuggestions}
          bioScientificName={bioScientificName}
          setBioScientificName={setBioScientificName}
          bioPosition={bioPosition}
          setBioPosition={setBioPosition}
          bioNote={bioNote}
          setBioNote={setBioNote}
          fillBioByName={() => void fillBioByName()}
          isSearchingBio={isSearchingBio}
          bioEditingId={bioEditingId}
          onCancelEditBioEntry={handleCancelEditBioEntry}
          bioRequirementState={bioRequirementState}
          bioRequirementPreview={bioRequirementPreview}
          faunaCounts={faunaCounts}
          faunaSubmenu={faunaSubmenu}
          setFaunaSubmenu={setFaunaSubmenu}
          faunaSearch={faunaSearch}
          setFaunaSearch={setFaunaSearch}
          faunaItems={faunaItems}
          formatDate={formatDate}
          bioDeepDivePreviewById={bioDeepDivePreviewById}
          onOpenBioDetails={openAnimalDetails}
          onStartEditBioEntry={handleStartEditBioEntry}
          onDeleteBioEntry={handleDeleteBioEntry}
        />
      )}

      {activeTab === 'configuracoes' && (
        <TankSettingsTab
          parameterDefinitions={parameterDefinitions}
          safeZones={safeZones}
          safeZonesBase={safeZonesBase}
          settings={
            new Map(
              Array.from(tankSettings.entries()).map(([key, item]) => [
                key,
                { isCustomEnabled: item.isCustomEnabled, customMin: item.customMin, customMax: item.customMax },
              ]),
            )
          }
          onChangeSetting={(parameterKey, next) => {
            setTankSettings((current) => {
              const updatedAt = new Date().toISOString()
              const nextMap = new Map(current)
              nextMap.set(parameterKey, {
                parameter: parameterKey,
                isCustomEnabled: next.isCustomEnabled,
                customMin: next.customMin,
                customMax: next.customMax,
                updatedAt,
              })
              return nextMap
            })
          }}
          onCancel={handleCancelTankSettings}
          canCancel={hasPendingTankSettingsChanges}
          onSave={() => void handleSaveTankSettings()}
          isSaving={isSavingTankSettings}
        />
      )}
    </main>
  )
}

export default App
