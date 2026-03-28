export type SmartTip = {
  id: string
  severity: 'critical' | 'warning' | 'info'
  message: string
}

type BioEntryMinimal = {
  name: string
  scientificName: string
  type: 'peixe' | 'coral' | 'invertebrado'
}

type InsightBadge = 'Ideal' | 'Atenção' | 'Crítico' | 'Sem faixa'

type ParameterInsightMinimal = {
  badge: InsightBadge
  dailyRate: number | null
  latest: { value: number } | null
}

type ProtocolLogSimple = {
  protocolKey: string
  performedAt: string
}

const fmt = (value: number, digits = 2) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(value)

const hasSpeciesLike = (bioEntries: BioEntryMinimal[], terms: string[]) =>
  bioEntries.some((entry) => {
    const combined = `${entry.name} ${entry.scientificName}`.toLowerCase()
    return terms.some((term) => combined.includes(term.toLowerCase()))
  })

export const computeSmartTips = (
  latestValues: Map<string, number>,
  safeZones: Map<string, { min: number; max: number }>,
  consumptionRates: Map<string, number>,
  bioEntries: BioEntryMinimal[],
  parameterInsights: Map<string, ParameterInsightMinimal>,
  protocolLogs: ProtocolLogSimple[] = [],
): SmartTip[] => {
  const tips: SmartTip[] = []
  const add = (id: string, severity: SmartTip['severity'], message: string) =>
    tips.push({ id, severity, message })

  const get = (key: string) => latestValues.get(key) ?? null
  const rateFor = (key: string) =>
    consumptionRates.get(key) ?? parameterInsights.get(key)?.dailyRate ?? null
  const safeFor = (key: string) => safeZones.get(key) ?? null

  // KH falling
  const khVal = get('kh')
  const khRate = rateFor('kh')
  const khSafe = safeFor('kh')
  if (khVal !== null && khRate !== null && khRate < -0.2) {
    if (khSafe && khVal <= khSafe.min) {
      add(
        'kh_critical_falling',
        'critical',
        `KH crítico (${fmt(khVal, 1)} dKH) e caindo ${fmt(Math.abs(khRate), 2)} dKH/dia. Dose 2-componente imediatamente.`,
      )
    } else if (khSafe) {
      const daysLeft = (khVal - khSafe.min) / Math.abs(khRate)
      add(
        'kh_critical_falling',
        'critical',
        `KH caindo ${fmt(Math.abs(khRate), 2)} dKH/dia. Estimativa: abaixo do mínimo em ${fmt(daysLeft, 0)} dia(s). Ajuste a dosagem.`,
      )
    }
  } else if (khVal !== null && khSafe && khVal < khSafe.min + 1 && khRate !== null && khRate < 0) {
    add(
      'kh_approaching_min',
      'warning',
      `KH se aproximando do mínimo (${fmt(khVal, 1)} dKH). Taxa atual: ${fmt(khRate, 2)} dKH/dia.`,
    )
  }

  // KH and Ca imbalanced
  const caRate = rateFor('calcio')
  if (
    khRate !== null &&
    caRate !== null &&
    khRate < -0.1 &&
    Math.abs(caRate) < Math.abs(khRate) * 0.3
  ) {
    add(
      'kh_ca_imbalanced',
      'info',
      'KH caindo mais rápido que Cálcio — verifique o equilíbrio da dosagem de 2-partes.',
    )
  }

  // Phosphate high
  const fosfatoVal = get('fosfato')
  const fosfatoSafe = safeFor('fosfato')
  if (fosfatoVal !== null && fosfatoSafe && fosfatoVal > fosfatoSafe.max) {
    const hasEuphyllia = hasSpeciesLike(bioEntries, [
      'Euphyllia',
      'torch',
      'ancora',
      'divisa',
      'glabrescens',
    ])
    if (hasEuphyllia) {
      add(
        'phosphate_high_with_euphyllia',
        'warning',
        `Fosfato elevado (${fmt(fosfatoVal, 3)} ppm) pode causar algodão nos Euphyllia. Considere aumentar o skimmer ou adicionar GFO.`,
      )
    } else {
      add(
        'phosphate_high',
        'warning',
        `Fosfato acima do ideal (${fmt(fosfatoVal, 3)} ppm). Revise alimentação e considere GFO.`,
      )
    }
  }

  // Ammonia critical
  const amoniaVal = get('amonia')
  if (amoniaVal !== null && amoniaVal > 0.1) {
    add(
      'ammonia_critical',
      'critical',
      `Amônia detectada (${fmt(amoniaVal, 2)} ppm) — tóxica para todos os organismos. Ação imediata: reduza alimentação e faça TPA.`,
    )
  }

  // Nitrite critical
  const nitritoVal = get('nitrito')
  if (nitritoVal !== null && nitritoVal > 0.1) {
    add(
      'nitrite_critical',
      'critical',
      `Nitrito elevado (${fmt(nitritoVal, 2)} ppm) — possível desequilíbrio no ciclo. Reduza alimentação e faça TPA.`,
    )
  }

  // Temperature high with tangs
  const tempVal = get('temperatura')
  const tempSafe = safeFor('temperatura')
  if (tempVal !== null && tempSafe && tempVal > tempSafe.max - 0.5) {
    const hasTang = hasSpeciesLike(bioEntries, [
      'Tang',
      'Zebrasoma',
      'Paracanthurus',
      'Ctenochaetus',
      'Acanthurus',
      'Naso',
      'cirurgião',
    ])
    if (hasTang) {
      add(
        'temp_high_with_tangs',
        'warning',
        `Temperatura próxima do limite (${fmt(tempVal, 1)} °C) com Tangs registrados. Verifique o resfriador.`,
      )
    }
  }

  // Nitrate high + TPA overdue
  const nitratoVal = get('nitrato')
  const nitratoSafe = safeFor('nitrato')
  const nitratoMax = nitratoSafe?.max ?? 20
  if (nitratoVal !== null && nitratoVal > nitratoMax) {
    const tpaLogs = protocolLogs
      .filter((log) => log.protocolKey.includes('tpa'))
      .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime())
    const lastTpa = tpaLogs[0]
    const daysSince = lastTpa
      ? (Date.now() - new Date(lastTpa.performedAt).getTime()) / 86400000
      : Infinity
    const target = nitratoMax / 2
    const pct = Math.max(10, Math.min(50, Math.round(((nitratoVal - target) / nitratoVal) * 100)))
    if (!Number.isFinite(daysSince) || daysSince > 10) {
      add(
        'nitrate_tpa_due',
        'warning',
        `Nitrato elevado (${fmt(nitratoVal, 0)} ppm)${!Number.isFinite(daysSince) ? ' e sem TPA registrado' : ` e sem TPA há ${fmt(daysSince, 0)} dias`}. Sugere-se troca de ~${pct}%.`,
      )
    } else {
      add(
        'nitrate_high',
        'warning',
        `Nitrato acima do ideal (${fmt(nitratoVal, 0)} ppm). Sugere-se TPA de ~${pct}% para reduzir.`,
      )
    }
  }

  // Low pH + high nitrate
  const phVal = get('ph')
  if (phVal !== null && phVal < 8.0 && nitratoVal !== null && nitratoVal > 20) {
    const coralCount = bioEntries.filter((e) => e.type === 'coral').length
    add(
      'ph_low_nitrate_high',
      'warning',
      `pH baixo (${fmt(phVal, 2)}) combinado com nitrato elevado (${fmt(nitratoVal, 0)} ppm): estresse crônico${coralCount > 0 ? ` para ${coralCount} coral(is)` : ''}. Priorize aeração e TPA.`,
    )
  }

  // Silicate high (promotes algae)
  const silicatoVal = get('silicato')
  const silicatoSafe = safeFor('silicato')
  if (silicatoVal !== null && silicatoSafe && silicatoVal > silicatoSafe.max) {
    add(
      'silicate_high',
      'info',
      `Silicato elevado (${fmt(silicatoVal, 2)} ppm) pode favorecer algas diatomáceas. Considere troca de osmose ou resina aniônica.`,
    )
  }

  // All ideal
  if (tips.length === 0) {
    const withData = Array.from(parameterInsights.values()).filter((i) => i.latest !== null)
    if (withData.length >= 3 && withData.every((i) => i.badge === 'Ideal')) {
      add('all_ideal', 'info', 'Todos os parâmetros monitorados dentro das faixas ideais. Excelente manejo!')
    }
  }

  const severityOrder: Record<SmartTip['severity'], number> = { critical: 0, warning: 1, info: 2 }
  tips.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
  return tips
}
