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

type TankInfo = {
  displayLiters: number
  totalLiters: number
  systemType: string
}

type Props = {
  latestByParameter: LatestByParameterItem[]
  safeZones: Map<string, { min: number; max: number }>
  cloudConsumptionRates: Map<string, number>
  bioEntries: BioEntry[]
  parameterInsights: Map<string, ParameterInsight>
  protocolLogs: ProtocolLog[]
  tankInfo?: TankInfo
}

export const useSmartTips = ({
  latestByParameter,
  safeZones,
  cloudConsumptionRates,
  bioEntries,
  parameterInsights,
  protocolLogs,
  tankInfo,
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
        tankInfo,
      ),
    [latestValues, safeZones, cloudConsumptionRates, bioEntries, parameterInsights, protocolLogs, tankInfo],
  )
}

export type { SmartTip }
