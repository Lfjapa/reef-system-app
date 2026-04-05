import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { User } from '@supabase/supabase-js'
import { isSupabaseEnabled } from '../lib/supabase'
import { mergeCatalog } from '../lib/catalogUtils'
import { logError } from '../lib/log'
import { useUiSettings } from './useUiSettings'
import { useProfileAvatar } from './useProfileAvatar'
import {
  defaultLightingPhasesData,
  defaultProtocolDefinitionsData,
  parameterDefinitionsData,
  seedBioCatalogData,
} from '../data/defaults'
import {
  deleteCloudLightingPhase,
  fetchCloudData,
  fetchConsumptionRates,
  fetchSafeZones,
  fetchCloudUserSettings,
  upsertCloudBios,
  upsertCloudCatalogEntries,
  upsertCloudParameters,
  upsertCloudProtocolChecks,
  upsertCloudProtocolDefinitions,
  upsertCloudProtocolLogs,
  upsertCloudLightingPhases,
  upsertCloudUserParameterSettings,
} from '../lib/cloudStore'
import { signInWithGoogle, signOut } from '../lib/auth'
import type { BioCatalogEntry, BioType } from '../lib/catalogUtils'

type ParameterKey = string
type SyncState = 'local' | 'syncing' | 'online' | 'error'
type ProtocolKey = string

type ParameterEntry = {
  id: string
  parameter: ParameterKey
  value: number
  measuredAt: string
  note: string
}

type BioEntry = {
  id: string
  type: BioType
  name: string
  scientificName: string
  position: string
  note: string
  createdAt: string
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

type TankParameterSetting = {
  parameter: ParameterKey
  isCustomEnabled: boolean
  customMin: number | null
  customMax: number | null
  updatedAt: string
}

const defaultProtocolDefinitions: ProtocolDefinition[] = defaultProtocolDefinitionsData
const seedBioCatalog: BioCatalogEntry[] = seedBioCatalogData

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
  const pieces = [message, code && `code=${code}`, status && `status=${status}`, details, hint].filter(Boolean)
  return pieces.join(' • ') || 'Erro desconhecido'
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

const normalizeTime = (value: string) => (value.length >= 5 ? value.slice(0, 5) : value)

const timeToMinutes = (time: string) => {
  const [h, m] = time.split(':').map((part) => Number(part))
  return h * 60 + m
}

const DEFAULT_LIGHTING_PHASES: LightingPhase[] = defaultLightingPhasesData
const DEFAULT_LIGHTING_BY_TIME = new Map(DEFAULT_LIGHTING_PHASES.map((phase) => [phase.time, phase]))

const defaultLightingPhases = (): LightingPhase[] =>
  DEFAULT_LIGHTING_PHASES.map((phase) => ({ ...phase }))

const normalizeLightingFromCloud = (phases: LightingPhase[]) => {
  const initialIds = phases.map((phase) => phase.id)
  const seenTimes = new Set<string>()
  const normalized: LightingPhase[] = []
  for (const phase of [...phases].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))) {
    const time = normalizeTime(String(phase.time))
    if (seenTimes.has(time)) continue
    seenTimes.add(time)
    const canonical = DEFAULT_LIGHTING_BY_TIME.get(time)
    if (canonical) {
      normalized.push({ ...phase, id: canonical.id, name: phase.name || canonical.name, time })
    } else {
      normalized.push({ ...phase, time })
    }
  }
  const normalizedIdSet = new Set(normalized.map((phase) => phase.id))
  const idsToDelete = initialIds.filter((id) => !normalizedIdSet.has(id))
  const needsWriteBack = idsToDelete.length > 0 || normalized.some((p) => !initialIds.includes(p.id))
  return { normalized, idsToDelete, needsWriteBack }
}

const normalizeTankSettingsSnapshot = (settings: Map<ParameterKey, TankParameterSetting>) =>
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

type Props = {
  authUser: User | null
  isAuthLoading: boolean
  setSyncState: (s: SyncState) => void
  setSyncErrorDetail: (d: string | null) => void
  clearCloudWrites: () => void
  retryCloudWrites: () => void
  syncReloadNonce: number
  setSyncReloadNonce: Dispatch<SetStateAction<number>>
  setEntries: Dispatch<SetStateAction<ParameterEntry[]>>
  setBioEntries: Dispatch<SetStateAction<BioEntry[]>>
  setCatalogEntries: Dispatch<SetStateAction<BioCatalogEntry[]>>
  setProtocolDefinitions: Dispatch<SetStateAction<ProtocolDefinition[]>>
  setProtocolChecks: Dispatch<SetStateAction<ProtocolCheck[]>>
  setProtocolLogs: Dispatch<SetStateAction<ProtocolLog[]>>
  setLightingPhases: Dispatch<SetStateAction<LightingPhase[]>>
  setTankVolumeLiters: Dispatch<SetStateAction<number>>
  setSumpLiters: Dispatch<SetStateAction<number>>
  setRockKg: Dispatch<SetStateAction<number>>
}

export function useAppSync({
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
}: Props) {
  const [storageError, setStorageError] = useState<string | null>(null)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState<boolean>(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false)
  const [safeZones, setSafeZones] = useState<Map<ParameterKey, { min: number; max: number }>>(() => new Map())
  const [safeZonesBase, setSafeZonesBase] = useState<Map<ParameterKey, { min: number; max: number }>>(() => new Map())
  const [tankSettings, setTankSettings] = useState<Map<ParameterKey, TankParameterSetting>>(() => new Map())
  const [savedTankSettings, setSavedTankSettings] = useState<Map<ParameterKey, TankParameterSetting>>(() => new Map())
  const [isSavingTankSettings, setIsSavingTankSettings] = useState<boolean>(false)
  const [cloudConsumptionRates, setCloudConsumptionRates] = useState<Map<ParameterKey, number>>(() => new Map())

  // ── Storage keys ──
  const entriesStorageKey = isSupabaseEnabled
    ? authUser ? `reef-system-entries:${authUser.id}` : null
    : 'reef-system-entries'
  const bioEntriesStorageKey = isSupabaseEnabled
    ? authUser ? `reef-system-bio-entries:${authUser.id}` : null
    : 'reef-system-bio-entries'
  const catalogStorageKey = isSupabaseEnabled
    ? authUser ? `reef-system-bio-catalog:${authUser.id}` : null
    : 'reef-system-bio-catalog'
  const lightingPhasesStorageKey = isSupabaseEnabled
    ? authUser ? `reef-system-lighting-phases:${authUser.id}` : null
    : 'reef-system-lighting-phases'
  const protocolLogsStorageKey = isSupabaseEnabled
    ? authUser ? `reef-system-protocol-logs:${authUser.id}` : null
    : 'reef-system-protocol-logs'
  const protocolDefinitionsStorageKey = isSupabaseEnabled
    ? authUser ? `reef-system-protocol-definitions:${authUser.id}` : null
    : 'reef-system-protocol-definitions'
  const protocolChecksStorageKey = isSupabaseEnabled
    ? authUser ? `reef-system-protocol-checks:${authUser.id}` : null
    : 'reef-system-protocol-checks'
  const tankSettingsStorageKey = isSupabaseEnabled
    ? authUser ? `reef-system-tank-settings:${authUser.id}` : null
    : 'reef-system-tank-settings'
  const uiSettingsStorageKey = isSupabaseEnabled
    ? authUser ? `reef-system-ui-settings:${authUser.id}` : null
    : 'reef-system-ui-settings'
  const profileAvatarStorageKey = isSupabaseEnabled
    ? authUser ? `reef-system-profile-avatar:${authUser.id}` : null
    : 'reef-system-profile-avatar'

  // ── Storage helpers ──
  const safeLocalStorageSetItem = useCallback((key: string, value: string) => {
    try {
      localStorage.setItem(key, value)
      setStorageError(null)
      return true
    } catch {
      setStorageError('Armazenamento local cheio')
      return false
    }
  }, [])

  const safeLocalStorageRemoveItem = useCallback((key: string) => {
    try {
      localStorage.removeItem(key)
      setStorageError(null)
      return true
    } catch {
      setStorageError('Armazenamento local cheio')
      return false
    }
  }, [])

  // ── Hooks extraídos: avatar e UI settings ──
  const { uiSettings, handleSaveUiSettings } = useUiSettings({
    storageKey: uiSettingsStorageKey,
    safeLocalStorageSetItem,
    setIsSettingsOpen,
  })

  const {
    profileAvatarUrl,
    avatarInputRef,
    handleRequestAvatarChange,
    handleAvatarChange,
    handleRemoveAvatar,
  } = useProfileAvatar({
    storageKey: profileAvatarStorageKey,
    safeLocalStorageSetItem,
    safeLocalStorageRemoveItem,
    setIsProfileMenuOpen,
  })

  // ── Profile menu clear on auth change ──
  useEffect(() => {
    setIsProfileMenuOpen(false)
    clearCloudWrites()
  }, [authUser?.id, clearCloudWrites])

  // ── safeZones derivation ──
  useEffect(() => {
    const parameterDefinitions = parameterDefinitionsData
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

  // ── Persist lighting phases ──
  useEffect(() => {
    if (!lightingPhasesStorageKey) return
    // lighting phases state is managed externally (setLightingPhases passed in)
    // persistence is handled here via a ref pattern is not needed since
    // setLightingPhases is external — lighting effect stays in App.tsx
  }, [lightingPhasesStorageKey])

  // ── Persist tank settings ──
  useEffect(() => {
    if (!tankSettingsStorageKey) return
    safeLocalStorageSetItem(tankSettingsStorageKey, JSON.stringify(Array.from(tankSettings.values())))
  }, [tankSettings, tankSettingsStorageKey, safeLocalStorageSetItem])

  // ── loadData ──
  useEffect(() => {
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

    const loadData = async () => {
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
      const localProtocolCache = protocolLogsStorageKey ? localStorage.getItem(protocolLogsStorageKey) : null
      const localProtocolDefCache = protocolDefinitionsStorageKey ? localStorage.getItem(protocolDefinitionsStorageKey) : null
      const localProtocolCheckCache = protocolChecksStorageKey ? localStorage.getItem(protocolChecksStorageKey) : null
      const localLightingCache = lightingPhasesStorageKey ? localStorage.getItem(lightingPhasesStorageKey) : null
      const localTankSettingsCache = tankSettingsStorageKey ? localStorage.getItem(tankSettingsStorageKey) : null

      const parameterDefinitions = parameterDefinitionsData
      const localEntries = sanitizeParameterEntries(
        safeJsonParseArray<ParameterEntry>(localEntriesCache, localSeed),
      )
      const localBio = safeJsonParseArray<BioEntry>(localBioCache, [])
      const localCatalog = safeJsonParseArray<BioCatalogEntry>(localCatalogCache, [])
      const localProtocolLogs = safeJsonParseArray<ProtocolLog>(localProtocolCache, [])
      const localProtocolDefinitionsRaw = safeJsonParseArray<ProtocolDefinition>(localProtocolDefCache, [])
      const localProtocolDefinitions =
        localProtocolDefinitionsRaw.length > 0 ? localProtocolDefinitionsRaw : defaultProtocolDefinitions
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
          if (row.baseMin !== null && row.baseMax !== null && Number.isFinite(row.baseMin) && Number.isFinite(row.baseMax)) {
            safeZoneBaseMap.set(row.parameter as ParameterKey, { min: row.baseMin, max: row.baseMax })
          }
          if (row.zoneMin !== null && row.zoneMax !== null && Number.isFinite(row.zoneMin) && Number.isFinite(row.zoneMax)) {
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
        const effectiveTankSettingsMap = cloudTankSettingsMap.size > 0 ? cloudTankSettingsMap : localTankSettingsMap
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
          localEntriesCache || localBioCache || localCatalogCache ||
          localProtocolCache || localProtocolDefCache || localProtocolCheckCache ||
          localLightingCache || localTankSettingsCache,
        )

        if (cloudIsEmpty && hasLocalCache) {
          syncStage = 'Enviando medições de parâmetros'
          await upsertCloudParameters(localEntries.map((item) => ({
            id: item.id, parameter: item.parameter, value: item.value, measuredAt: item.measuredAt, note: item.note,
          })), userId)

          syncStage = 'Enviando inventário biológico'
          await upsertCloudBios(localBio.map((item) => ({
            id: item.id, type: item.type, name: item.name, scientificName: item.scientificName,
            position: item.position, note: item.note, createdAt: item.createdAt,
          })), userId)

          syncStage = 'Enviando catálogo de organismos'
          await upsertCloudCatalogEntries(localCatalog.map((item) => ({
            aliases: item.aliases, type: item.type, scientificName: item.scientificName,
            position: item.position, note: item.note,
          })), userId)

          syncStage = 'Enviando definições de protocolo'
          await upsertCloudProtocolDefinitions(localProtocolDefinitions.map((item) => ({
            protocolKey: item.key, label: item.label, days: item.days, quantity: item.quantity, unit: item.unit,
          })), userId)

          syncStage = 'Enviando checks de protocolo'
          await upsertCloudProtocolChecks(localProtocolChecks.map((item) => ({
            id: item.id, protocolKey: item.protocolKey, weekStart: item.weekStart,
            dayIndex: item.dayIndex, checkedAt: item.checkedAt, quantity: item.quantity,
            unit: item.unit, note: item.note,
          })), userId)

          syncStage = 'Enviando configurações do tanque'
          await upsertCloudUserParameterSettings(
            Array.from(localTankSettingsMap.values()).map((item) => ({
              parameter: item.parameter, isCustomEnabled: item.isCustomEnabled,
              customMin: item.customMin, customMax: item.customMax, updatedAt: new Date().toISOString(),
            })), userId)

          syncStage = 'Enviando histórico de protocolos'
          await upsertCloudProtocolLogs(localProtocolLogs.map((item) => ({
            id: item.id, protocolKey: item.protocolKey, performedAt: item.performedAt, note: item.note,
          })), userId)

          syncStage = 'Enviando fases de iluminação'
          await upsertCloudLightingPhases(localLighting.map((item) => ({
            id: item.id, name: item.name, time: item.time, uv: item.uv, white: item.white, blue: item.blue,
          })), userId)

          setEntries(localEntries)
          setBioEntries(localBio)
          setCatalogEntries(mergeCatalog(seedBioCatalog, localCatalog))
          setProtocolDefinitions(localProtocolDefinitions)
          setProtocolChecks(localProtocolChecks)
          setProtocolLogs(localProtocolLogs)
          setLightingPhases(localLighting)
          setTankSettings(localTankSettingsMap)
          setSavedTankSettings(new Map(localTankSettingsMap))

          const refreshedRows = await fetchSafeZones()
          const refreshedMap = new Map<ParameterKey, { min: number; max: number }>()
          const refreshedBaseMap = new Map<ParameterKey, { min: number; max: number }>()
          for (const row of refreshedRows) {
            if (!row.parameter) continue
            if (row.baseMin !== null && row.baseMax !== null && Number.isFinite(row.baseMin) && Number.isFinite(row.baseMax)) {
              refreshedBaseMap.set(row.parameter as ParameterKey, { min: row.baseMin, max: row.baseMax })
            }
            if (row.zoneMin !== null && row.zoneMax !== null && Number.isFinite(row.zoneMin) && Number.isFinite(row.zoneMax)) {
              refreshedMap.set(row.parameter as ParameterKey, { min: row.zoneMin, max: row.zoneMax })
            }
          }
          setSafeZones(refreshedMap)
          setSafeZonesBase(refreshedBaseMap)
          setSyncState('online')
          return
        }

        setEntries(sanitizeParameterEntries(cloudData.parameters.map((item) => ({
          id: item.id, parameter: item.parameter as ParameterKey, value: item.value,
          measuredAt: item.measuredAt, note: item.note,
        }))))
        setBioEntries(cloudData.bio.map((item) => ({
          id: item.id, type: item.type as BioType, name: item.name,
          scientificName: item.scientificName, position: item.position, note: item.note, createdAt: item.createdAt,
        })))
        setCatalogEntries(mergeCatalog(seedBioCatalog, cloudData.catalog.map((item) => ({
          aliases: item.aliases, type: item.type as BioType, scientificName: item.scientificName,
          position: item.position, note: item.note,
        }))))
        setProtocolDefinitions(
          cloudData.protocolDefinitions.length
            ? cloudData.protocolDefinitions.map((item) => ({
                key: item.protocolKey as ProtocolKey, label: item.label,
                days: item.days, quantity: item.quantity, unit: item.unit,
              }))
            : localProtocolDefinitions,
        )
        setProtocolChecks(cloudData.protocolChecks.map((item) => ({
          id: item.id, protocolKey: item.protocolKey as ProtocolKey, weekStart: item.weekStart,
          dayIndex: item.dayIndex, checkedAt: item.checkedAt, quantity: item.quantity,
          unit: item.unit, note: item.note,
        })))
        setProtocolLogs(cloudData.protocolLogs.map((item) => ({
          id: item.id, protocolKey: item.protocolKey as ProtocolKey,
          performedAt: item.performedAt, note: item.note,
        })))

        if (cloudData.lightingPhases.length) {
          const mappedLighting = cloudData.lightingPhases.map((item) => ({
            id: item.id, name: item.name, time: normalizeTime(String(item.time)),
            uv: item.uv, white: item.white, blue: item.blue,
          }))
          const { normalized, idsToDelete, needsWriteBack } = normalizeLightingFromCloud(mappedLighting)
          if (needsWriteBack) {
            await upsertCloudLightingPhases(normalized.map((item) => ({
              id: item.id, name: item.name, time: item.time, uv: item.uv, white: item.white, blue: item.blue,
            })), userId)
            await Promise.all(idsToDelete.map((id) => deleteCloudLightingPhase(id)))
          }
          setLightingPhases(normalized)
        } else {
          setLightingPhases(localLighting)
        }

        try {
          const userSettings = await fetchCloudUserSettings()
          if (userSettings) {
            setTankVolumeLiters(userSettings.tankVolumeLiters)
            localStorage.setItem('reef-system-tank-volume', String(userSettings.tankVolumeLiters))
            setSumpLiters(userSettings.sumpLiters)
            localStorage.setItem('reef-system-sump-liters', String(userSettings.sumpLiters))
            setRockKg(userSettings.rockKg)
            localStorage.setItem('reef-system-rock-kg', String(userSettings.rockKg))
          }
        } catch {
          // table may not exist yet — silently ignore
        }

        setSyncState('online')
        setSyncErrorDetail(null)
      } catch (error) {
        logError('sync-loadData', error)
        const baseSafe = new Map<ParameterKey, { min: number; max: number }>()
        for (const definition of parameterDefinitionsData) {
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
    setBioEntries,
    setCatalogEntries,
    setEntries,
    setLightingPhases,
    setProtocolChecks,
    setProtocolDefinitions,
    setProtocolLogs,
    setSyncErrorDetail,
    setSyncState,
    setTankVolumeLiters,
  ])

  // ── Handlers ──
  const handleGoogleLogin = useCallback(async () => {
    try {
      await signInWithGoogle()
    } catch (error) {
      logError('auth-login', error)
      setSyncState('error')
      setSyncErrorDetail(formatSyncError(error))
    }
  }, [setSyncErrorDetail, setSyncState])

  const handleLogout = useCallback(async () => {
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
  }, [clearCloudWrites, setSyncErrorDetail, setSyncState])

  const handleRetrySync = useCallback(() => {
    if (!isSupabaseEnabled) return
    setSyncErrorDetail(null)
    setSyncState('syncing')
    retryCloudWrites()
    setSyncReloadNonce((current) => current + 1)
  }, [retryCloudWrites, setSyncErrorDetail, setSyncReloadNonce, setSyncState])

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true)
    setIsProfileMenuOpen(false)
  }, [])

  const handleCloseSettings = useCallback(() => setIsSettingsOpen(false), [])

  const handleSaveTankSettings = useCallback(async () => {
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
        if (row.baseMin !== null && row.baseMax !== null && Number.isFinite(row.baseMin) && Number.isFinite(row.baseMax)) {
          refreshedSafeZoneBaseMap.set(row.parameter as ParameterKey, { min: row.baseMin, max: row.baseMax })
        }
        if (row.zoneMin !== null && row.zoneMax !== null && Number.isFinite(row.zoneMin) && Number.isFinite(row.zoneMax)) {
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
  }, [authUser, isSavingTankSettings, setSyncErrorDetail, setSyncState, tankSettings])

  const handleCancelTankSettings = useCallback(() => {
    setTankSettings(new Map(savedTankSettings))
    setSyncErrorDetail(null)
    if (!isSupabaseEnabled) setSyncState('local')
  }, [savedTankSettings, setSyncErrorDetail, setSyncState])

  const hasPendingTankSettingsChanges = useMemo(
    () => normalizeTankSettingsSnapshot(tankSettings) !== normalizeTankSettingsSnapshot(savedTankSettings),
    [tankSettings, savedTankSettings],
  )

  return {
    storageError,
    profileAvatarUrl,
    isProfileMenuOpen, setIsProfileMenuOpen,
    isSettingsOpen,
    uiSettings,
    safeZones,
    safeZonesBase,
    cloudConsumptionRates,
    tankSettings, setTankSettings,
    savedTankSettings,
    isSavingTankSettings,
    hasPendingTankSettingsChanges,
    avatarInputRef,
    safeLocalStorageSetItem,
    safeLocalStorageRemoveItem,
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
    // storage keys exposed for App.tsx
    lightingPhasesStorageKey,
    tankSettingsStorageKey,
  }
}
