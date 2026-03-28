type InsightBadge = 'Ideal' | 'Atenção' | 'Crítico' | 'Sem faixa'

type ParameterInsight = {
  badge: InsightBadge
  latest?: { value: number } | null
  arrow?: string
  dailyRate?: number | null
  projectedDaysToBound?: number | null
  projectedDaysToCriticalMin?: number | null
}

type Props = {
  parameterInsights: Map<string, ParameterInsight>
}

const FISH_PARAMS = ['temperatura', 'salinidade', 'ph', 'amonia', 'nitrito', 'nitrato']
const CORAL_PARAMS = ['kh', 'calcio', 'magnesio', 'fosfato', 'temperatura', 'ph']
const INVERT_PARAMS = ['salinidade', 'temperatura', 'ph', 'calcio']

function countHealthy(
  insights: Map<string, ParameterInsight>,
  keys: string[],
): { ideal: number; total: number } {
  let ideal = 0
  let total = 0
  for (const key of keys) {
    const insight = insights.get(key)
    if (!insight || insight.badge === 'Sem faixa') continue
    total++
    if (insight.badge === 'Ideal') ideal++
  }
  return { ideal, total }
}

function statusColor(ideal: number, total: number): string {
  if (total === 0) return 'neutral'
  const ratio = ideal / total
  if (ratio === 1) return 'ideal'
  if (ratio >= 0.66) return 'attention'
  return 'critical'
}

export default function ParameterHealthSummary({ parameterInsights }: Props) {
  const fish = countHealthy(parameterInsights, FISH_PARAMS)
  const coral = countHealthy(parameterInsights, CORAL_PARAMS)
  const invert = countHealthy(parameterInsights, INVERT_PARAMS)

  if (fish.total === 0 && coral.total === 0 && invert.total === 0) return null

  return (
    <div className="param-health-summary">
      {fish.total > 0 && (
        <div className={`param-health-card status-badge ${statusColor(fish.ideal, fish.total)}`}>
          <span className="param-health-icon">&#x1F41F;</span>
          <span className="param-health-label">Peixes</span>
          <span className="param-health-count">
            {fish.ideal}/{fish.total}
          </span>
        </div>
      )}
      {coral.total > 0 && (
        <div className={`param-health-card status-badge ${statusColor(coral.ideal, coral.total)}`}>
          <span className="param-health-icon">&#x1FAB8;</span>
          <span className="param-health-label">Corais</span>
          <span className="param-health-count">
            {coral.ideal}/{coral.total}
          </span>
        </div>
      )}
      {invert.total > 0 && (
        <div className={`param-health-card status-badge ${statusColor(invert.ideal, invert.total)}`}>
          <span className="param-health-icon">&#x1F990;</span>
          <span className="param-health-label">Inverts</span>
          <span className="param-health-count">
            {invert.ideal}/{invert.total}
          </span>
        </div>
      )}
    </div>
  )
}
