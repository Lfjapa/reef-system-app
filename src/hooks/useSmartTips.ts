import { useMemo } from 'react'
import { computeSmartTips, type SmartTip } from '../lib/tipsEngine'

type BioEntry = {
  name: string
  scientificName: string
  type: 'peixe' | 'coral' | 'invertebrado'
}

type InsightBadge = 'Ideal' | 'Atenção' | 'Crítico' | 'Sem faixa'

type ParameterInsight = {
  badge: InsightBadge
  dailyRate: number | null
  latest: { value: number } | null
}

type ProtocolLog = {
  protocolKey: string
  performedAt: string
}

type LatestByParameterItem = {
  definition: { key: string }
  latest?: { value: number }
}

type Props = {
  latestByParameter: LatestByParameterItem[]
  safeZones: Map<string, { min: number; max: number }>
  cloudConsumptionRates: Map<string, number>
  bioEntries: BioEntry[]
  parameterInsights: Map<string, ParameterInsight>
  protocolLogs: ProtocolLog[]
}

export const useSmartTips = ({
  latestByParameter,
  safeZones,
  cloudConsumptionRates,
  bioEntries,
  parameterInsights,
  protocolLogs,
}: Props): SmartTip[] => {
  const latestValues = useMemo(() => {
    const map = new Map<string, number>()
    for (const { definition, latest } of latestByParameter) {
      if (latest !== undefined) map.set(definition.key, latest.value)
    }
    return map
  }, [latestByParameter])

  return useMemo(
    () =>
      computeSmartTips(
        latestValues,
        safeZones,
        cloudConsumptionRates,
        bioEntries,
        parameterInsights,
        protocolLogs,
      ),
    [latestValues, safeZones, cloudConsumptionRates, bioEntries, parameterInsights, protocolLogs],
  )
}

export type { SmartTip }
