import { useCallback, useEffect, useMemo, useState } from 'react'

export type WaterChangeEntry = {
  id: string
  performedAt: string
  volumeLiters: number | null
  volumePercent: number | null
  note: string
}

type Props = {
  storageKey: string | null
  latestNitrate: number | null
  latestPhosphate: number | null
  latestNitrite: number | null
  nitrateMax: number
  phosphateMax: number
  onCloudWrite?: (entry: WaterChangeEntry) => void
}

const safeJsonParse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export const useWaterChange = ({
  storageKey,
  latestNitrate,
  latestPhosphate,
  latestNitrite,
  nitrateMax,
  phosphateMax,
  onCloudWrite,
}: Props) => {
  const [waterChanges, setWaterChanges] = useState<WaterChangeEntry[]>(() => {
    if (!storageKey) return []
    return safeJsonParse<WaterChangeEntry[]>(localStorage.getItem(storageKey), [])
  })
  const [currentTimeMs, setCurrentTimeMs] = useState(() => new Date().getTime())

  useEffect(() => {
    const updateCurrentTime = () => setCurrentTimeMs(new Date().getTime())
    const intervalId = window.setInterval(updateCurrentTime, 60_000)
    return () => window.clearInterval(intervalId)
  }, [])

  const suggestedChangePercent = useMemo((): number | null => {
    // Nitrite present: emergency TPA
    if (latestNitrite !== null && latestNitrite > 0.1) return 30

    // Nitrate elevated
    if (latestNitrate !== null && latestNitrate > nitrateMax) {
      const target = nitrateMax / 2
      const pct = Math.round(((latestNitrate - target) / latestNitrate) * 100)
      return Math.max(10, Math.min(50, pct))
    }

    // Phosphate elevated
    if (latestPhosphate !== null && latestPhosphate > phosphateMax) return 20

    return null
  }, [latestNitrate, latestPhosphate, latestNitrite, nitrateMax, phosphateMax])

  const suggestedReason = useMemo((): string | null => {
    const fmt = (v: number, digits = 2) =>
      new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(v)
    if (latestNitrite !== null && latestNitrite > 0.1)
      return `Nitrito detectado (${fmt(latestNitrite, 2)} ppm)`
    if (latestNitrate !== null && latestNitrate > nitrateMax)
      return `Nitrato elevado (${fmt(latestNitrate, 1)} ppm)`
    if (latestPhosphate !== null && latestPhosphate > phosphateMax)
      return `Fosfato elevado (${fmt(latestPhosphate, 3)} ppm)`
    return null
  }, [latestNitrate, latestPhosphate, latestNitrite, nitrateMax, phosphateMax])

  const addWaterChange = useCallback(
    (entry: Omit<WaterChangeEntry, 'id'>) => {
      const newEntry: WaterChangeEntry = {
        ...entry,
        id: crypto.randomUUID(),
      }
      setWaterChanges((prev) => {
        const next = [newEntry, ...prev]
        if (storageKey) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(next))
          } catch {
            // storage full — ignore
          }
        }
        return next
      })
      onCloudWrite?.(newEntry)
    },
    [storageKey, onCloudWrite],
  )

  const replaceWaterChanges = useCallback(
    (entries: WaterChangeEntry[]) => {
      setWaterChanges(entries)
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(entries))
        } catch {
          // storage full — ignore
        }
      }
    },
    [storageKey],
  )

  const recentChanges = useMemo(() => waterChanges.slice(0, 5), [waterChanges])

  const daysSinceLastChange = useMemo((): number | null => {
    const last = waterChanges[0]
    if (!last) return null
    return (currentTimeMs - new Date(last.performedAt).getTime()) / 86400000
  }, [currentTimeMs, waterChanges])

  return {
    waterChanges,
    recentChanges,
    suggestedChangePercent,
    suggestedReason,
    daysSinceLastChange,
    addWaterChange,
    replaceWaterChanges,
  }
}
