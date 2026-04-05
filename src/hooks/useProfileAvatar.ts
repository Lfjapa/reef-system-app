import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { idbDel, idbGet, idbSet } from '../lib/idb'
import { logError } from '../lib/log'

type Props = {
  storageKey: string | null
  safeLocalStorageSetItem: (key: string, value: string) => boolean
  safeLocalStorageRemoveItem: (key: string) => boolean
  setIsProfileMenuOpen: (open: boolean) => void
}

export function useProfileAvatar({
  storageKey,
  safeLocalStorageSetItem,
  safeLocalStorageRemoveItem,
  setIsProfileMenuOpen,
}: Props) {
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)

  // Carrega avatar do IndexedDB (com fallback para localStorage legado)
  useEffect(() => {
    if (!storageKey) {
      setProfileAvatarUrl(null)
      return
    }
    let alive = true
    void (async () => {
      try {
        const stored = await idbGet(storageKey)
        if (!alive) return
        if (stored) {
          setProfileAvatarUrl(stored)
          safeLocalStorageRemoveItem(storageKey)
          return
        }
        const legacy = localStorage.getItem(storageKey)
        if (!alive) return
        setProfileAvatarUrl(legacy || null)
        if (legacy) {
          try {
            await idbSet(storageKey, legacy)
            safeLocalStorageRemoveItem(storageKey)
          } catch (error) {
            logError('avatar-idb-migrate', error)
          }
        }
      } catch (error) {
        logError('avatar-idb-get', error)
        if (!alive) return
        const legacy = localStorage.getItem(storageKey)
        setProfileAvatarUrl(legacy || null)
      }
    })()
    return () => {
      alive = false
    }
  }, [storageKey, safeLocalStorageRemoveItem])

  const handleRequestAvatarChange = useCallback(() => {
    avatarInputRef.current?.click()
  }, [])

  const handleAvatarChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        const next = typeof reader.result === 'string' ? reader.result : null
        if (!next) return
        setProfileAvatarUrl(next)
        if (storageKey) {
          void (async () => {
            try {
              await idbSet(storageKey, next)
              safeLocalStorageRemoveItem(storageKey)
            } catch (error) {
              logError('avatar-idb-set', error)
              safeLocalStorageSetItem(storageKey, next)
            }
          })()
        }
        setIsProfileMenuOpen(false)
      }
      reader.readAsDataURL(file)
    },
    [storageKey, safeLocalStorageRemoveItem, safeLocalStorageSetItem, setIsProfileMenuOpen],
  )

  const handleRemoveAvatar = useCallback(() => {
    setProfileAvatarUrl(null)
    if (storageKey) {
      void (async () => {
        try {
          await idbDel(storageKey)
        } catch (error) {
          logError('avatar-idb-del', error)
        }
        safeLocalStorageRemoveItem(storageKey)
      })()
    }
    setIsProfileMenuOpen(false)
  }, [storageKey, safeLocalStorageRemoveItem, setIsProfileMenuOpen])

  return {
    profileAvatarUrl,
    avatarInputRef,
    handleRequestAvatarChange,
    handleAvatarChange,
    handleRemoveAvatar,
  }
}
