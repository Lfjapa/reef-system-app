import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { isSupabaseEnabled } from '../lib/supabase'
import { logError } from '../lib/log'
import { parameterDefinitionsData } from '../data/defaults'
import {
  fetchSafeZones,
  upsertCloudUserParameterSettings,
} from '../lib/cloudStore'
import type { BottleSetting, ParameterKey, SyncState, TankParameterSetting } from '../types'

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

type Props = {
  authUser: User | null
  tankSettingsStorageKey: string | null
  bottleSettingsStorageKey: string | null
  safeLocalStorageSetItem: (key: string, value: string) => boolean
  setSyncState: (s: SyncState) => void
  setSyncErrorDetail: (d: string | null) => void
}

export function useAppSettings({
  authUser,
  tankSettingsStorageKey,
  bottleSettingsStorageKey,
  safeLocalStorageSetItem,
  setSyncState,
  setSyncErrorDetail,
}: Props) {
  const [safeZones, setSafeZones] = useState<Map<ParameterKey, { min: number; max: number }>>(() => new Map())
  const [safeZonesBase, setSafeZonesBase] = useState<Map<ParameterKey, { min: number; max: number }>>(() => new Map())
  const [tankSettings, setTankSettings] = useState<Map<ParameterKey, TankParameterSetting>>(() => new Map())
  const [savedTankSettings, setSavedTankSettings] = useState<Map<ParameterKey, TankParameterSetting>>(() => new Map())
  const [isSavingTankSettings, setIsSavingTankSettings] = useState<boolean>(false)
  const [cloudConsumptionRates, setCloudConsumptionRates] = useState<Map<ParameterKey, number>>(() => new Map())
  const [bottleSettings, setBottleSettings] = useState<Map<ParameterKey, BottleSetting>>(() => {
    if (typeof window === 'undefined' || !bottleSettingsStorageKey) return new Map()
    try {
      const raw = localStorage.getItem(bottleSettingsStorageKey)
      if (!raw) return new Map()
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return new Map()
      return new Map((parsed as BottleSetting[]).map((s) => [s.parameter, s]))
    } catch {
      return new Map()
    }
  })

  // Derive safeZones = base + custom overrides
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

  // Persist tank settings
  useEffect(() => {
    if (!tankSettingsStorageKey) return
    safeLocalStorageSetItem(tankSettingsStorageKey, JSON.stringify(Array.from(tankSettings.values())))
  }, [tankSettings, tankSettingsStorageKey, safeLocalStorageSetItem])

  // Persist bottle settings
  useEffect(() => {
    if (!bottleSettingsStorageKey) return
    safeLocalStorageSetItem(bottleSettingsStorageKey, JSON.stringify(Array.from(bottleSettings.values())))
  }, [bottleSettings, bottleSettingsStorageKey, safeLocalStorageSetItem])

  // Reset bottle settings when user changes
  useEffect(() => {
    if (!bottleSettingsStorageKey) { setBottleSettings(new Map()); return }
    try {
      const raw = localStorage.getItem(bottleSettingsStorageKey)
      if (!raw) { setBottleSettings(new Map()); return }
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) { setBottleSettings(new Map()); return }
      setBottleSettings(new Map((parsed as BottleSetting[]).map((s) => [s.parameter, s])))
    } catch {
      setBottleSettings(new Map())
    }
  }, [bottleSettingsStorageKey])

  const handleChangeBottleSetting = useCallback((parameter: ParameterKey, next: Omit<BottleSetting, 'parameter' | 'updatedAt'>) => {
    setBottleSettings((prev) => {
      const updated = new Map(prev)
      updated.set(parameter, { ...next, parameter, updatedAt: new Date().toISOString() })
      return updated
    })
  }, [])

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
    safeZones, setSafeZones,
    safeZonesBase, setSafeZonesBase,
    tankSettings, setTankSettings,
    savedTankSettings, setSavedTankSettings,
    isSavingTankSettings,
    cloudConsumptionRates, setCloudConsumptionRates,
    bottleSettings,
    handleChangeBottleSetting,
    hasPendingTankSettingsChanges,
    handleSaveTankSettings,
    handleCancelTankSettings,
  }
}
