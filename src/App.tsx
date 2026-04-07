import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import './App.css'
import Header from './components/shared/Header'
import ParameterAlertModal from './components/shared/ParameterAlertModal'
import SettingsModal from './components/shared/SettingsModal'
import DashboardTab from './components/Dashboard/DashboardTab'
import { calcTankHealthScore } from './lib/tankHealthScore'
import ParametersTab from './components/Parameters/ParametersTab'
import ProtocolsTab from './components/Protocols/ProtocolsTab'
import LightingTab from './components/Lighting/LightingTab'
import InventoryTab from './components/Inventory/InventoryTab'
import AnimalDetailsModal from './components/Inventory/AnimalDetailsModal'
import TankSettingsTab from './components/Settings/TankSettingsTab'
import { parameterDefinitionsData } from './data/defaults'
import { useCloudWriteQueue } from './hooks/useCloudWriteQueue'
import { useSmartTips } from './hooks/useSmartTips'
import { useAnimalsAtRisk } from './hooks/useAnimalsAtRisk'
import { useWaterChange } from './hooks/useWaterChange'
import { useBioEntries } from './hooks/useBioEntries'
import { useParameterEntries } from './hooks/useParameterEntries'
import { useProtocols } from './hooks/useProtocols'
import { useAppSync } from './hooks/useAppSync'
import DosingCalculatorModal from './components/shared/DosingCalculatorModal'
import { checkCompatibility } from './lib/compatibilityEngine'
import { findBestCatalogMatch } from './lib/catalogUtils'
import { isSupabaseEnabled } from './lib/supabase'
import {
  fetchCloudWaterChanges,
  upsertCloudLightingPhase,
  upsertCloudUserSettings,
  upsertCloudWaterChange,
} from './lib/cloudStore'
import { getSession, onAuthStateChange } from './lib/auth'

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

type SyncState = 'local' | 'syncing' | 'online' | 'error'

type UiSettings = {
  title: string
  subtitle: string
  subtitleEnabled: boolean
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

const formatSyncError = (error: unknown) => {
  if (error instanceof Error) return error.message || 'Erro desconhecido'
  if (!error || typeof error !== 'object') return 'Erro desconhecido'
  const candidate = error as Record<string, unknown>
  const message = typeof candidate.message === 'string' ? candidate.message : ''
  const code = typeof candidate.code === 'string' ? candidate.code : ''
  const details = typeof candidate.details === 'string' ? candidate.details : ''
  const hint = typeof candidate.hint === 'string' ? candidate.hint : ''
  const status = typeof candidate.status === 'number' ? String(candidate.status) : ''
  const pieces = [message, code && `code=${code}`, status && `status=${status}`, details, hint].filter(Boolean)
  return pieces.join(' • ') || 'Erro desconhecido'
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))

const dayLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const formatDays = (days: number[]) => {
  const labels = days
    .slice()
    .sort((a, b) => a - b)
    .map((day) => dayLabels[(day + 6) % 7])
  return labels.join(', ')
}

const timeToMinutes = (time: string) => {
  const [h, m] = time.split(':').map((part) => Number(part))
  return h * 60 + m
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

const parseNumberWithFallback = (raw: string, fallback: number) => {
  const value = Number(raw)
  return Number.isFinite(value) ? value : fallback
}

const NOW_AT_BOOT = Date.now()
const DEFAULT_UI_SETTINGS: UiSettings = {
  title: 'Monitoramento do aquario',
  subtitle: 'Controle diário do aquário no PC e no celular',
  subtitleEnabled: true,
}

type BioEntryForProfile = { name: string; scientificName: string; type: string }

function detectSystemType(entries: BioEntryForProfile[]): string {
  const corals = entries.filter((e) => e.type === 'coral')
  if (corals.length === 0) {
    return entries.length === 0 ? 'Sem inventário' : 'FOWLR (sem corais)'
  }
  const match = (entry: BioEntryForProfile, terms: string[]) => {
    const text = `${entry.name} ${entry.scientificName}`.toLowerCase()
    return terms.some((t) => text.includes(t))
  }
  const SPS = ['acropora', 'montipora', 'pocillopora', 'seriatopora', 'stylophora', 'millepora', 'psammocora', 'pavona', 'turbinaria', 'stylocoeniella']
  const LPS = ['euphyllia', 'trachyphyllia', 'blastomussa', 'micromussa', 'fungia', 'favia', 'favites', 'lobophyllia', 'duncanopsammia', 'caulastrea', 'catalaphyllia', 'acanthastrea', 'galaxea', 'goniopora', 'alveopora', 'nemenzophyllia', 'leptastrea', 'leptoseris', 'echinophyllia', 'hydnophora', 'pectinia', 'cyphastrea', 'scolymia', 'blastomussa', 'micromussa']
  const hasSPS = corals.some((e) => match(e, SPS))
  const hasLPS = corals.some((e) => match(e, LPS))
  if (hasSPS && hasLPS) return 'Recife misto (SPS + LPS)'
  if (hasSPS) return 'Recife SPS'
  if (hasLPS) return 'Recife LPS'
  return 'Recife (softcorals / zoanthídeos)'
}

function App() {
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'parametros' | 'protocolos' | 'iluminacao' | 'inventario' | 'configuracoes'
  >('dashboard')
  const [dashboardPeriodDays, setDashboardPeriodDays] = useState<7 | 30 | 90 | 365>(30)
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
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(isSupabaseEnabled)
  const [nowMs, setNowMs] = useState<number>(NOW_AT_BOOT)
  const [syncReloadNonce, setSyncReloadNonce] = useState<number>(0)
  const [isDosingCalculatorOpen, setIsDosingCalculatorOpen] = useState<boolean>(false)
  const [tankVolumeLiters, setTankVolumeLiters] = useState<number>(() => {
    const raw = localStorage.getItem('reef-system-tank-volume')
    if (!raw) return 300
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : 300
  })
  const [sumpLiters, setSumpLiters] = useState<number>(() => {
    const raw = localStorage.getItem('reef-system-sump-liters')
    if (!raw) return 0
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? n : 0
  })
  const [rockKg, setRockKg] = useState<number>(() => {
    const raw = localStorage.getItem('reef-system-rock-kg')
    if (!raw) return 0
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? n : 0
  })
  const totalSystemLiters = Math.max(1, Math.round(tankVolumeLiters + sumpLiters - rockKg * 0.5))
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

  const {
    bioType, setBioType,
    bioName, setBioName,
    bioScientificName, setBioScientificName,
    bioPosition, setBioPosition,
    bioNote, setBioNote,
    bioEditingId,
    bioEntries, setBioEntries,
    catalogEntries, setCatalogEntries,
    bioDeepDivePreviewById,
    isSearchingBio,
    faunaSubmenu, setFaunaSubmenu,
    faunaSearch, setFaunaSearch,
    bioRequirementState,
    bioRequirementPreview,
    animalDetailsEntry,
    animalDetailsCatalogEntry,
    animalRequirementState,
    animalRequirement,
    bioNameSuggestions,
    faunaItems,
    faunaCounts,
    handleAddBio,
    handleDeleteBioEntry,
    handleStartEditBioEntry,
    handleCancelEditBioEntry,
    openAnimalDetails,
    closeAnimalDetails,
    fillBioByName,
  } = useBioEntries({ authUser, activeTab, syncReloadNonce, enqueueCloudWrite })

  const {
    protocolDefinitions, setProtocolDefinitions,
    setProtocolChecks,
    protocolLogs, setProtocolLogs,
    protocolNote, setProtocolNote,
    protocolEditingKey,
    protocolEditLabel, setProtocolEditLabel,
    protocolEditDays, setProtocolEditDays,
    protocolEditQuantity, setProtocolEditQuantity,
    protocolEditUnit, setProtocolEditUnit,
    protocolAddLabel, setProtocolAddLabel,
    protocolAddDays, setProtocolAddDays,
    protocolAddQuantity, setProtocolAddQuantity,
    protocolAddUnit, setProtocolAddUnit,
    isProtocolModalOpen,
    protocolModalMode,
    todayProtocolDayIndex,
    protocolChecksSorted,
    latestProtocolByKey,
    protocolsDueToday,
    isDoneThisWeek,
    handleToggleProtocolCheck,
    handleDeleteProtocolHistoryEntry,
    handleSaveProtocol,
    handleDeleteRoutine,
    handleAddRoutine,
    openAddRoutineModal,
    openEditRoutineModal,
    closeProtocolModal,
  } = useProtocols({ authUser, enqueueCloudWrite })

  const {
    parameter, setParameter,
    value, setValue,
    note, setNote,
    filterParameter, setFilterParameter,
    periodDays, setPeriodDays,
    entries, setEntries,
    parameterAlert, setParameterAlert,
    lastMeasurementFeedback,
    handleSubmit,
    handleDeleteParameterEntry,
  } = useParameterEntries({
    storageKey: isSupabaseEnabled ? (authUser ? `reef-system-entries:${authUser.id}` : null) : 'reef-system-entries',
    authUser,
    enqueueCloudWrite,
    protocolLogs,
    protocolDefinitions,
  })

  const {
    storageError,
    profileAvatarUrl,
    isProfileMenuOpen, setIsProfileMenuOpen,
    isSettingsOpen,
    uiSettings,
    safeZones,
    safeZonesBase,
    cloudConsumptionRates,
    tankSettings, setTankSettings,
    isSavingTankSettings,
    hasPendingTankSettingsChanges,
    avatarInputRef,
    safeLocalStorageSetItem,
    handleGoogleLogin,
    handleLogout,
    handleRetrySync,
    handleOpenSettings,
    handleCloseSettings,
    handleRequestAvatarChange,
    handleAvatarChange,
    handleRemoveAvatar,
    handleSaveUiSettings,
    handleSaveTankSettings,
    handleCancelTankSettings,
    lightingPhasesStorageKey,
  } = useAppSync({
    authUser,
    isAuthLoading,
    setSyncState,
    setSyncErrorDetail,
    clearCloudWrites,
    retryCloudWrites,
    syncReloadNonce,
    setSyncReloadNonce,
    setEntries,
    setBioEntries,
    setCatalogEntries,
    setProtocolDefinitions,
    setProtocolChecks,
    setProtocolLogs,
    setLightingPhases,
    setTankVolumeLiters,
    setSumpLiters,
    setRockKg,
  })

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
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 60000)
    return () => window.clearInterval(intervalId)
  }, [])


  useEffect(() => {
    if (!lightingPhasesStorageKey) return
    safeLocalStorageSetItem(lightingPhasesStorageKey, JSON.stringify(lightingPhases))
  }, [lightingPhases, lightingPhasesStorageKey, safeLocalStorageSetItem])

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

  const latestValuesMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const { definition, latest } of latestByParameter) {
      if (latest) map.set(definition.key, latest.value)
    }
    return map
  }, [latestByParameter])

  const smartTips = useSmartTips({
    latestByParameter,
    safeZones,
    cloudConsumptionRates,
    bioEntries,
    parameterInsights,
    protocolLogs,
    tankInfo: {
      displayLiters: tankVolumeLiters,
      totalLiters: totalSystemLiters,
      systemType: detectSystemType(bioEntries),
    },
  })

  const animalsAtRisk = useAnimalsAtRisk(bioEntries, bioDeepDivePreviewById, latestValuesMap)

  const tankHealthScore = useMemo(
    () => calcTankHealthScore({ parameterInsights, animalsAtRisk, smartTips }),
    [parameterInsights, animalsAtRisk, smartTips],
  )

  const compatibilityWarnings = useMemo(() => {
    if (!bioEditingId && (bioName.trim() || bioScientificName.trim())) {
      const result = checkCompatibility(
        { name: bioName, scientificName: bioScientificName, type: bioType },
        bioEntries,
        bioRequirementPreview
          ? {
              aggressionLevel: bioRequirementPreview.aggressionLevel ?? null,
              minTankLiters: bioRequirementPreview.minTankLiters ?? null,
              predatorRisk: bioRequirementPreview.predatorRisk ?? [],
              preyRisk: bioRequirementPreview.preyRisk ?? [],
            }
          : undefined,
        { volumeLiters: totalSystemLiters },
      )
      return result.warnings
    }
    return []
  }, [bioName, bioScientificName, bioType, bioEntries, bioEditingId, bioRequirementPreview, totalSystemLiters])

  const waterChangeStorageKey = isSupabaseEnabled
    ? authUser
      ? `reef-system-water-changes:${authUser.id}`
      : null
    : 'reef-system-water-changes'

  const {
    recentChanges: recentWaterChanges,
    suggestedChangePercent,
    suggestedReason,
    daysSinceLastChange,
    addWaterChange,
    replaceWaterChanges,
  } = useWaterChange({
    storageKey: waterChangeStorageKey,
    latestNitrate: latestValuesMap.get('nitrato') ?? null,
    latestPhosphate: latestValuesMap.get('fosfato') ?? null,
    latestNitrite: latestValuesMap.get('nitrito') ?? null,
    nitrateMax: safeZones.get('nitrato')?.max ?? 20,
    phosphateMax: safeZones.get('fosfato')?.max ?? 0.1,
    onCloudWrite: isSupabaseEnabled && authUser
      ? (entry) => {
          enqueueCloudWrite('Troca de água', async () => {
            await upsertCloudWaterChange(
              { id: entry.id, performedAt: entry.performedAt, volumeLiters: entry.volumeLiters, volumePercent: entry.volumePercent, note: entry.note },
              authUser.id,
            )
          })
        }
      : undefined,
  })

  // ── Load water changes from cloud on sync ──
  useEffect(() => {
    if (!isSupabaseEnabled || !authUser) return
    void (async () => {
      try {
        const cloudWaterChanges = await fetchCloudWaterChanges()
        if (cloudWaterChanges.length > 0) {
          replaceWaterChanges(
            cloudWaterChanges.map((wc) => ({
              id: wc.id,
              performedAt: wc.performedAt,
              volumeLiters: wc.volumeLiters,
              volumePercent: wc.volumePercent,
              note: wc.note,
            })),
          )
        }
      } catch {
        // table may not exist yet — silently ignore
      }
    })()
  }, [authUser, replaceWaterChanges, syncReloadNonce])

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
            findBestCatalogMatch(animalDetailsEntry.name, catalogEntries) ??
            (animalDetailsEntry.scientificName.trim()
              ? findBestCatalogMatch(animalDetailsEntry.scientificName, catalogEntries)
              : null) ??
            null
          }
          requirementState={animalRequirementState}
          requirement={animalRequirement}
          latestValues={latestValuesMap}
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
          <span className="tab-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            <span>Dashboard</span>
          </span>
        </button>
        <button
          className={activeTab === 'parametros' ? 'active' : ''}
          onClick={() => setActiveTab('parametros')}
        >
          <span className="tab-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
            </svg>
            <span>Parâmetros</span>
          </span>
        </button>
        <button
          className={activeTab === 'protocolos' ? 'active' : ''}
          onClick={() => setActiveTab('protocolos')}
        >
          <span className="tab-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            <span>Protocolos</span>
          </span>
        </button>
        <button
          className={activeTab === 'iluminacao' ? 'active' : ''}
          onClick={() => setActiveTab('iluminacao')}
        >
          <span className="tab-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
            </svg>
            <span>Iluminação</span>
          </span>
        </button>
        <button
          className={activeTab === 'inventario' ? 'active' : ''}
          onClick={() => setActiveTab('inventario')}
        >
          <span className="tab-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <span>Inventário</span>
          </span>
        </button>
        <button
          className={activeTab === 'configuracoes' ? 'active' : ''}
          onClick={() => setActiveTab('configuracoes')}
        >
          <span className="tab-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span>Configurações</span>
          </span>
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
          smartTips={smartTips}
          animalsAtRisk={animalsAtRisk}
          tankInfo={{
            name: uiSettings.title,
            volumeLiters: tankVolumeLiters,
            systemType: detectSystemType(bioEntries),
          }}
          onNavigate={(tab) => setActiveTab(tab)}
          tankHealthScore={tankHealthScore}
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
          safeZones={safeZones}
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
          onOpenDosingCalculator={() => setIsDosingCalculatorOpen(true)}
          waterChangeSuggestion={suggestedChangePercent}
          waterChangeSuggestionReason={suggestedReason}
          waterChangeDaysSinceLast={daysSinceLastChange}
          recentWaterChanges={recentWaterChanges}
          onAddWaterChange={addWaterChange}
          todayProtocolDayIndex={todayProtocolDayIndex}
        />
      )}

      {isDosingCalculatorOpen && (
        <DosingCalculatorModal
          latestValues={latestValuesMap}
          tankVolumeLiters={tankVolumeLiters}
          totalSystemLiters={totalSystemLiters}
          onTankVolumeChange={(vol) => {
            setTankVolumeLiters(vol)
            localStorage.setItem('reef-system-tank-volume', String(vol))
            if (isSupabaseEnabled && authUser) {
              enqueueCloudWrite('Configurações do aquário', async () => {
                await upsertCloudUserSettings({ tankVolumeLiters: vol, sumpLiters, rockKg }, authUser.id)
              })
            }
          }}
          onClose={() => setIsDosingCalculatorOpen(false)}
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
          compatibilityWarnings={compatibilityWarnings}
          animalsAtRisk={animalsAtRisk}
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
          displayTankLiters={tankVolumeLiters}
          sumpLiters={sumpLiters}
          rockKg={rockKg}
          totalSystemLiters={totalSystemLiters}
          systemType={detectSystemType(bioEntries)}
          onChangeAquarioInfo={(info) => {
            setTankVolumeLiters(info.displayTankLiters)
            setSumpLiters(info.sumpLiters)
            setRockKg(info.rockKg)
            localStorage.setItem('reef-system-tank-volume', String(info.displayTankLiters))
            localStorage.setItem('reef-system-sump-liters', String(info.sumpLiters))
            localStorage.setItem('reef-system-rock-kg', String(info.rockKg))
            if (isSupabaseEnabled && authUser) {
              enqueueCloudWrite('Informações do aquário', async () => {
                await upsertCloudUserSettings({
                  tankVolumeLiters: info.displayTankLiters,
                  sumpLiters: info.sumpLiters,
                  rockKg: info.rockKg,
                }, authUser.id)
              })
            }
          }}
        />
      )}
    </main>
  )
}

export default App
