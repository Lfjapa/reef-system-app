import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { isSupabaseEnabled } from '../lib/supabase'
import { deleteCloudParameter, upsertCloudParameter } from '../lib/cloudStore'
import { parameterDefinitionsData } from '../data/defaults'
import type { ParameterKey, ParameterEntry, ProtocolLog, ProtocolDefinition } from '../types'

const MIN_RATE_INTERVAL_DAYS = 0.25

const criticalLimitsByParameter: Partial<Record<ParameterKey, { min?: number; max?: number }>> = {
  kh: { min: 6.5 },
  ph: { min: 7.8, max: 8.5 },
}

const normalizeParameterValue = (parameter: ParameterKey, rawValue: number) => {
  if (parameter !== 'salinidade') return rawValue
  if (rawValue >= 1000 && rawValue <= 1100) return rawValue / 1000
  return rawValue
}

const pickLatestEntry = (items: ParameterEntry[]) => {
  let latest: ParameterEntry | null = null
  for (const entry of items) {
    if (!latest) { latest = entry; continue }
    if (new Date(entry.measuredAt).getTime() > new Date(latest.measuredAt).getTime()) {
      latest = entry
    }
  }
  return latest
}

type LastMeasurementFeedback = {
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
}

type Props = {
  storageKey: string | null
  authUser: User | null
  enqueueCloudWrite: (label: string, fn: () => Promise<void>) => void
  protocolLogs: ProtocolLog[]
  protocolDefinitions: ProtocolDefinition[]
}

export function useParameterEntries({
  storageKey,
  authUser,
  enqueueCloudWrite,
  protocolLogs,
  protocolDefinitions,
}: Props) {
  const [parameter, setParameter] = useState<ParameterKey>('kh')
  const [value, setValue] = useState<string>('')
  const [note, setNote] = useState<string>('')
  const [filterParameter, setFilterParameter] = useState<'todos' | ParameterKey>('todos')
  const [periodDays, setPeriodDays] = useState<7 | 30 | 90 | 365>(30)
  const [entries, setEntries] = useState<ParameterEntry[]>([])
  const [parameterAlert, setParameterAlert] = useState<{ title: string; message: string } | null>(null)
  const [lastMeasurementFeedback, setLastMeasurementFeedback] = useState<LastMeasurementFeedback | null>(null)

  // ── Persist entries ──
  useEffect(() => {
    if (!storageKey) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(entries))
    } catch {
      // storage full — ignore
    }
  }, [entries, storageKey])

  const latestByParameter = useMemo(() => {
    const map = new Map<ParameterKey, ParameterEntry>()
    for (const entry of entries) {
      const current = map.get(entry.parameter)
      if (!current || new Date(entry.measuredAt).getTime() > new Date(current.measuredAt).getTime()) {
        map.set(entry.parameter, entry)
      }
    }
    return parameterDefinitionsData.map((definition) => ({
      definition,
      latest: map.get(definition.key),
    }))
  }, [entries])

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
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
    },
    [value, parameter, note, entries, protocolLogs, protocolDefinitions, authUser, enqueueCloudWrite],
  )

  const handleDeleteParameterEntry = useCallback(
    async (entryId: string) => {
      setEntries((current) => current.filter((entry) => entry.id !== entryId))
      if (isSupabaseEnabled && authUser) {
        enqueueCloudWrite('Excluir medição de parâmetro', async () => {
          await deleteCloudParameter(entryId)
        })
      }
    },
    [authUser, enqueueCloudWrite],
  )

  return {
    parameter, setParameter,
    value, setValue,
    note, setNote,
    filterParameter, setFilterParameter,
    periodDays, setPeriodDays,
    entries, setEntries,
    parameterAlert, setParameterAlert,
    lastMeasurementFeedback,
    latestByParameter,
    handleSubmit,
    handleDeleteParameterEntry,
  }
}
