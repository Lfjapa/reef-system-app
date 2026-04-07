type InsightBadge = 'Ideal' | 'Atenção' | 'Crítico' | 'Sem faixa'

export type TankHealthInput = {
  parameterInsights: Map<string, { badge: InsightBadge }>
  animalsAtRisk: Array<{ violations: Array<{ severity: 'warning' | 'critical' }> }>
  smartTips: Array<{ severity: 'critical' | 'warning' | 'info' }>
}

const PARAM_WEIGHTS: Record<string, number> = {
  kh: 0.18,
  calcio: 0.14,
  magnesio: 0.12,
  ph: 0.12,
  temperatura: 0.12,
  salinidade: 0.10,
  nitrato: 0.08,
  fosfato: 0.06,
  nitrito: 0.05,
  amonia: 0.03,
}

export function calcTankHealthScore(input: TankHealthInput): number {
  const { parameterInsights, animalsAtRisk, smartTips } = input

  // Layer A: Parameter health (max 70 points)
  let weightedSum = 0
  let totalPossibleWeight = 0

  for (const [key, insight] of parameterInsights) {
    if (insight.badge === 'Sem faixa') continue

    const weight = PARAM_WEIGHTS[key] ?? 0.02
    totalPossibleWeight += weight

    if (insight.badge === 'Ideal') {
      weightedSum += weight * 1.0
    } else if (insight.badge === 'Atenção') {
      weightedSum += weight * 0.5
    }
    // Crítico contributes 0
  }

  const paramScore =
    totalPossibleWeight > 0 ? (weightedSum / totalPossibleWeight) * 70 : 70

  // Layer B: Animals at risk deduction (max 15 points)
  let animalDeduction = 0
  for (const animal of animalsAtRisk) {
    for (const v of animal.violations) {
      animalDeduction += v.severity === 'critical' ? 4 : 2
    }
  }
  animalDeduction = Math.min(15, animalDeduction)

  // Layer C: Smart tips deduction (max 15 points)
  let tipDeduction = 0
  for (const tip of smartTips) {
    if (tip.severity === 'critical') tipDeduction += 5
    else if (tip.severity === 'warning') tipDeduction += 2
  }
  tipDeduction = Math.min(15, tipDeduction)

  const raw = paramScore - animalDeduction - tipDeduction
  return Math.round(Math.max(0, Math.min(100, raw)))
}

export function healthScoreColor(score: number): string {
  if (score >= 75) return 'var(--success)'
  if (score >= 45) return 'var(--warning-color)'
  return 'var(--danger)'
}
