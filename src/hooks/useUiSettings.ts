import { useCallback, useEffect, useState } from 'react'

export type UiSettings = {
  title: string
  subtitle: string
  subtitleEnabled: boolean
}

export const DEFAULT_UI_SETTINGS: UiSettings = {
  title: 'Monitoramento do aquario',
  subtitle: 'Controle diário do aquário no PC e no celular',
  subtitleEnabled: true,
}

type Props = {
  storageKey: string | null
  safeLocalStorageSetItem: (key: string, value: string) => boolean
  setIsSettingsOpen: (open: boolean) => void
}

export function useUiSettings({ storageKey, safeLocalStorageSetItem, setIsSettingsOpen }: Props) {
  const [uiSettings, setUiSettings] = useState<UiSettings>(DEFAULT_UI_SETTINGS)

  useEffect(() => {
    if (!storageKey) {
      setUiSettings(DEFAULT_UI_SETTINGS)
      return
    }
    const raw = localStorage.getItem(storageKey)
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
        safeLocalStorageSetItem(storageKey, JSON.stringify({ title, subtitle, subtitleEnabled }))
      }
      setUiSettings({ title, subtitle, subtitleEnabled })
    } catch {
      setUiSettings(DEFAULT_UI_SETTINGS)
    }
  }, [storageKey, safeLocalStorageSetItem])

  const handleSaveUiSettings = useCallback(
    (next: UiSettings) => {
      setUiSettings(next)
      if (storageKey) safeLocalStorageSetItem(storageKey, JSON.stringify(next))
      setIsSettingsOpen(false)
    },
    [safeLocalStorageSetItem, storageKey, setIsSettingsOpen],
  )

  return { uiSettings, handleSaveUiSettings }
}
