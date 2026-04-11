import { useMemo } from 'react'
import { parameterDefinitionsData } from '../data/defaults'
import { getStatus } from '../lib/formatters'
import type { ParameterKey, ParameterEntry, ParameterDefinition, TrendArrow, InsightBadge, ParameterInsight } from '../types'

const TREND_WINDOW_DAYS = 7
const MIN_RATE_INTERVAL_DAYS = 0.25

const aggressiveDailyRateByParameter: Partial<Record<ParameterKey, number>> = {
  kh: 0.5,
}

const criticalLimitsByParameter: Partial<Record<ParameterKey, { min?: number; max?: number }>> = {
  kh: { min: 6.5 },
  ph: { min: 7.8, max: 8.5 },
}

export const arrowSymbol: Record<TrendArrow, string> = {
  up: '↑',
  down: '↓',
  flat: '→',
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
    if (Math.abs(dailyRate) >= aggressiveThreshold) badge = 'Atenção'
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
    latest, previous, delta, daysBetween, dailyRate, arrow, badge,
    projectedDaysToBound, projectedBound, projectedDaysToCriticalMin, criticalMin,
  }
}

type Props = {
  entries: ParameterEntry[]
  safeZones: Map<ParameterKey, { min: number; max: number }>
  nowMs: number
  periodDays: number
  filterParameter: string
  dashboardPeriodDays: number
}

export function useParameterInsights({ entries, safeZones, nowMs, periodDays, filterParameter, dashboardPeriodDays }: Props) {
  const parameterDefinitions = parameterDefinitionsData

  const latestByParameter = useMemo(() => {
    const map = new Map<ParameterKey, ParameterEntry>()
    for (const entry of entries) {
      const current = map.get(entry.parameter)
      if (!current || new Date(entry.measuredAt).getTime() > new Date(current.measuredAt).getTime()) {
        map.set(entry.parameter, entry)
      }
    }
    return parameterDefinitions.map((definition) => ({
      definition,
      latest: map.get(definition.key),
    }))
  }, [entries, parameterDefinitions])

  const filteredEntries = useMemo(() => {
    const threshold = nowMs - periodDays * 86400000
    return entries
      .filter((entry) => new Date(entry.measuredAt).getTime() >= threshold)
      .filter((entry) => filterParameter === 'todos' ? true : entry.parameter === filterParameter)
      .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime())
  }, [entries, filterParameter, nowMs, periodDays])

  const dashboardEntries = useMemo(() => {
    const threshold = nowMs - dashboardPeriodDays * 86400000
    return entries
      .filter((entry) => new Date(entry.measuredAt).getTime() >= threshold)
      .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime())
  }, [dashboardPeriodDays, entries, nowMs])

  const parameterInsights = useMemo(() => {
    const map = new Map<ParameterKey, ParameterInsight>()
    for (const definition of parameterDefinitions) {
      map.set(definition.key, computeParameterInsight(entries, definition, safeZones))
    }
    return map
  }, [entries, safeZones, parameterDefinitions])

  const latestValuesMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const { definition, latest } of latestByParameter) {
      if (latest) map.set(definition.key, latest.value)
    }
    return map
  }, [latestByParameter])

  return {
    latestByParameter,
    filteredEntries,
    dashboardEntries,
    parameterInsights,
    latestValuesMap,
  }
}
