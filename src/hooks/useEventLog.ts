import { useCallback, useEffect, useState } from 'react'
import type { EventLog, EventType } from '../types'

type Props = {
  storageKey: string | null
}

const EVENT_TYPE_TITLES: Record<EventType, string> = {
  medicao: 'Medição',
  tpa: 'Troca parcial de água',
  dosagem: 'Dosagem',
  animal: 'Animal',
  manutencao: 'Manutenção',
  observacao: 'Observação',
  problema: 'Problema',
  tratamento: 'Tratamento',
}

export { EVENT_TYPE_TITLES }

export function useEventLog({ storageKey }: Props) {
  const [eventLogs, setEventLogs] = useState<EventLog[]>(() => {
    if (!storageKey) return []
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return []
      const parsed: unknown = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as EventLog[]) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    if (!storageKey) return
    localStorage.setItem(storageKey, JSON.stringify(eventLogs))
  }, [storageKey, eventLogs])

  // Reset when storage key changes (user login/logout)
  useEffect(() => {
    if (!storageKey) {
      setEventLogs([])
      return
    }
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) { setEventLogs([]); return }
      const parsed: unknown = JSON.parse(raw)
      setEventLogs(Array.isArray(parsed) ? (parsed as EventLog[]) : [])
    } catch {
      setEventLogs([])
    }
  }, [storageKey])

  const addEventLog = useCallback((event: Omit<EventLog, 'id'>) => {
    const newEvent: EventLog = { ...event, id: crypto.randomUUID() }
    setEventLogs((prev) =>
      [newEvent, ...prev].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    )
  }, [])

  const deleteEventLog = useCallback((id: string) => {
    setEventLogs((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const logEvent = useCallback(
    (
      type: EventType,
      title: string,
      note = '',
      amount: number | null = null,
      unit = '',
    ) => {
      addEventLog({
        type,
        title: title || EVENT_TYPE_TITLES[type],
        note,
        amount,
        unit,
        date: new Date().toISOString(),
      })
    },
    [addEventLog],
  )

  return { eventLogs, setEventLogs, addEventLog, deleteEventLog, logEvent }
}
