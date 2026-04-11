import { useCallback, useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { User } from '@supabase/supabase-js'
import { isSupabaseEnabled } from '../lib/supabase'
import { useUiSettings } from './useUiSettings'
import { useProfileAvatar } from './useProfileAvatar'
import { useAppSettings } from './useAppSettings'
import { useCloudSync } from './useCloudSync'
import type { BioCatalogEntry } from '../lib/catalogUtils'
import type {
  SyncState,
  ParameterEntry,
  BioEntry,
  ProtocolDefinition,
  ProtocolLog,
  ProtocolCheck,
  LightingPhase,
} from '../types'

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
  const bottleSettingsStorageKey = isSupabaseEnabled
    ? authUser ? `reef-system-bottle-settings:${authUser.id}` : null
    : 'reef-system-bottle-settings'
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

  // ── Sub-hooks ──
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

  const {
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
  } = useAppSettings({
    authUser,
    tankSettingsStorageKey,
    bottleSettingsStorageKey,
    safeLocalStorageSetItem,
    setSyncState,
    setSyncErrorDetail,
  })

  const { handleGoogleLogin, handleLogout, handleRetrySync } = useCloudSync({
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
    setSafeZones,
    setSafeZonesBase,
    setTankSettings,
    setSavedTankSettings,
    setCloudConsumptionRates,
    entriesStorageKey,
    bioEntriesStorageKey,
    catalogStorageKey,
    lightingPhasesStorageKey,
    protocolLogsStorageKey,
    protocolDefinitionsStorageKey,
    protocolChecksStorageKey,
    tankSettingsStorageKey,
  })

  // ── Profile menu clear on auth change ──
  useEffect(() => {
    setIsProfileMenuOpen(false)
    clearCloudWrites()
  }, [authUser?.id, clearCloudWrites])

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true)
    setIsProfileMenuOpen(false)
  }, [])

  const handleCloseSettings = useCallback(() => setIsSettingsOpen(false), [])

  return {
    storageError,
    profileAvatarUrl,
    isProfileMenuOpen, setIsProfileMenuOpen,
    isSettingsOpen,
    uiSettings,
    safeZones,
    safeZonesBase,
    cloudConsumptionRates,
    bottleSettings,
    handleChangeBottleSetting,
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
    lightingPhasesStorageKey,
    tankSettingsStorageKey,
  }
}
