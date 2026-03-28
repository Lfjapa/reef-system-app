import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { isSupabaseEnabled } from '../lib/supabase'
import { normalize } from '../lib/catalogUtils'
import { defaultProtocolDefinitionsData } from '../data/defaults'
import {
  deleteCloudProtocolCheck,
  deleteCloudProtocolChecksByKey,
  deleteCloudProtocolDefinition,
  deleteCloudProtocolLog,
  deleteCloudProtocolLogsByKey,
  upsertCloudProtocolCheck,
  upsertCloudProtocolDefinition,
  upsertCloudProtocolLog,
} from '../lib/cloudStore'

type ProtocolKey = string

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

const defaultProtocolDefinitions: ProtocolDefinition[] = defaultProtocolDefinitionsData

const parseOptionalNumber = (raw: string) => {
  const parsed = parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : null
}

const buildProtocolKey = (label: string) => {
  const base = normalize(label).replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  const suffix = crypto.randomUUID().slice(0, 8)
  return `${base || 'rotina'}_${suffix}`
}

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

const startOfWeekMonday = (date: Date) => {
  const result = new Date(date)
  const mondayBasedDay = (result.getDay() + 6) % 7
  result.setDate(result.getDate() - mondayBasedDay)
  result.setHours(0, 0, 0, 0)
  return result
}

const safeLocalStorageSetItem = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage full — ignore
  }
}

type Props = {
  authUser: User | null
  enqueueCloudWrite: (label: string, fn: () => Promise<void>) => void
}

export function useProtocols({ authUser, enqueueCloudWrite }: Props) {
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
  const [todayKey, setTodayKey] = useState(() => toDateKey(new Date()))

  // ── Storage keys ──
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

  // ── Persist ──
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

  // ── Midnight date refresh ──
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

  // ── Derived ──
  const protocolWeekStart = useMemo(
    () => startOfWeekMonday(fromDateKey(todayKey)),
    [todayKey],
  )
  const protocolWeekStartKey = useMemo(() => toDateKey(protocolWeekStart), [protocolWeekStart])

  const todayProtocolDayIndex = useMemo(() => {
    const date = fromDateKey(todayKey)
    return ((date.getDay() + 6) % 7) + 1
  }, [todayKey])

  const protocolChecksSorted = useMemo(() =>
    protocolChecks
      .slice()
      .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime()),
    [protocolChecks],
  )

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

  const protocolsDueToday = useMemo(() =>
    protocolDefinitions
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
      .sort((a, b) => a.definition.label.localeCompare(b.definition.label, 'pt-BR')),
    [latestProtocolByKey, protocolDefinitions, protocolDoneSet, todayProtocolDayIndex],
  )

  // ── Handlers ──
  const isDoneThisWeek = useCallback(
    (key: ProtocolKey, dayIndex: number) => protocolDoneSet.has(`${key}:${dayIndex}`),
    [protocolDoneSet],
  )

  const handleToggleProtocolCheck = useCallback(
    async (key: ProtocolKey, dayIndex: number) => {
      const existing = protocolChecks.find(
        (log) =>
          log.protocolKey === key &&
          log.weekStart === protocolWeekStartKey &&
          log.dayIndex === dayIndex,
      )
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
    },
    [authUser, enqueueCloudWrite, protocolChecks, protocolDefinitions, protocolNote, protocolWeekStartKey],
  )

  const handleDeleteProtocolHistoryEntry = useCallback(
    async (entryId: string) => {
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
    },
    [authUser, enqueueCloudWrite],
  )

  const handleSaveProtocol = useCallback(
    async (key: ProtocolKey) => {
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
    },
    [authUser, enqueueCloudWrite, protocolDefinitions, protocolEditDays, protocolEditLabel, protocolEditQuantity, protocolEditUnit],
  )

  const handleDeleteRoutine = useCallback(
    async (key: ProtocolKey) => {
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
    },
    [authUser, enqueueCloudWrite],
  )

  const handleAddRoutine = useCallback(async () => {
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
  }, [authUser, enqueueCloudWrite, protocolAddDays, protocolAddLabel, protocolAddQuantity, protocolAddUnit])

  const openAddRoutineModal = useCallback(() => {
    setProtocolModalMode('add')
    setProtocolAddLabel('')
    setProtocolAddDays([])
    setProtocolAddQuantity('')
    setProtocolAddUnit('ml')
    setIsProtocolModalOpen(true)
  }, [])

  const openEditRoutineModal = useCallback((definition: ProtocolDefinition) => {
    setProtocolModalMode('edit')
    setProtocolEditingKey(definition.key)
    setProtocolEditLabel(definition.label)
    setProtocolEditDays(definition.days)
    setProtocolEditQuantity(definition.quantity === null ? '' : String(definition.quantity))
    setProtocolEditUnit(definition.unit)
    setIsProtocolModalOpen(true)
  }, [])

  const closeProtocolModal = useCallback(() => {
    setIsProtocolModalOpen(false)
    setProtocolEditingKey(null)
  }, [])

  return {
    protocolDefinitions, setProtocolDefinitions,
    protocolChecks, setProtocolChecks,
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
    protocolWeekStartKey,
    protocolChecksSorted,
    latestProtocolByKey,
    protocolDoneSet,
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
    // storage keys exposed for loadData in App.tsx
    protocolLogsStorageKey,
    protocolDefinitionsStorageKey,
    protocolChecksStorageKey,
  }
}
