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

type TankInfo = {
  displayLiters: number
  totalLiters: number
  systemType: string
}

const tpaLiters = (totalLiters: number, pct: number) =>
  `≈${Math.round(totalLiters * pct / 100)} L`

export const computeSmartTips = (
  latestValues: Map<string, number>,
  safeZones: Map<string, { min: number; max: number }>,
  consumptionRates: Map<string, number>,
  bioEntries: BioEntryMinimal[],
  parameterInsights: Map<string, ParameterInsightMinimal>,
  protocolLogs: ProtocolLogSimple[] = [],
  tankInfo?: TankInfo,
): SmartTip[] => {
  const tips: SmartTip[] = []
  const added = new Set<string>()
  const add = (id: string, severity: SmartTip['severity'], message: string) => {
    if (!added.has(id)) {
      added.add(id)
      tips.push({ id, severity, message })
    }
  }

  const get = (key: string) => latestValues.get(key) ?? null
  const rateFor = (key: string) =>
    consumptionRates.get(key) ?? parameterInsights.get(key)?.dailyRate ?? null
  const safeFor = (key: string) => safeZones.get(key) ?? null
  const vol = tankInfo?.totalLiters ?? 0

  // ─── KH ───────────────────────────────────────────────────────────────────
  const khVal = get('kh')
  const khRate = rateFor('kh')
  const khSafe = safeFor('kh')

  if (khVal !== null && khRate !== null && khRate < -0.2) {
    if (khSafe && khVal <= khSafe.min) {
      add(
        'kh_critical_falling',
        'critical',
        `KH crítico (${fmt(khVal, 1)} dKH) e caindo ${fmt(Math.abs(khRate), 2)} dKH/dia. Aumente a dosagem do carbonato/parte B gradualmente — não dobre de uma vez, pois KH subindo rápido é tão perigoso quanto caindo. Aumento seguro: ~0,1 dKH por dia.`,
      )
    } else if (khSafe) {
      const daysLeft = (khVal - khSafe.min) / Math.abs(khRate)
      add(
        'kh_critical_falling',
        'critical',
        `KH caindo ${fmt(Math.abs(khRate), 2)} dKH/dia — abaixo do mínimo em ~${fmt(daysLeft, 0)} dia(s). Ajuste a dosagem do carbonato/parte B agora, aumentando gradualmente (~0,1 dKH/dia) para evitar choque nos corais.`,
      )
    }
  } else if (khVal !== null && khSafe && khVal < khSafe.min + 1 && khRate !== null && khRate < 0) {
    add(
      'kh_approaching_min',
      'warning',
      `KH se aproximando do mínimo (${fmt(khVal, 1)} dKH, taxa: ${fmt(khRate, 2)} dKH/dia). Aumente levemente a dosagem do carbonato/parte B antes de atingir o limite.`,
    )
  }

  if (khVal !== null && khRate !== null && khRate > 0.15) {
    add(
      'kh_rising',
      'warning',
      `KH subindo ${fmt(khRate, 2)} dKH/dia (atual: ${fmt(khVal, 1)} dKH): reduza a dosagem do carbonato/parte B. Variações bruscas de KH causam mais estresse nos corais do que um valor levemente fora do ideal.`,
    )
  }

  // ─── CÁLCIO ───────────────────────────────────────────────────────────────
  const caVal = get('calcio')
  const caRate = rateFor('calcio')
  const caSafe = safeFor('calcio')

  const caAboveMax = caVal !== null && caSafe && caVal > caSafe.max
  const caBelowMin = caVal !== null && caSafe && caVal < caSafe.min - 10

  if (caBelowMin) {
    add(
      'ca_critical_low',
      'critical',
      `Cálcio crítico (${fmt(caVal!, 0)} ppm, mínimo ${fmt(caSafe!.min, 0)} ppm): aumente a dosagem de cálcio/parte A do sistema 2-partes. Meta: recuperar +5–10 ppm/dia sem ultrapassar ${fmt(caSafe!.max, 0)} ppm. Em sistemas SPS o consumo diário pode ser alto — cheque o fluxo de dosagem.`,
    )
  } else if (caVal !== null && caRate !== null && caRate < -2) {
    add(
      'ca_falling',
      'warning',
      `Cálcio caindo ${fmt(Math.abs(caRate), 1)} ppm/dia (atual: ${fmt(caVal, 0)} ppm): aumente a dosagem de cálcio/parte A do 2-partes. A relação de consumo saudável é ~2,8 ppm de Ca para cada 1 dKH consumido — verifique se a dosagem está proporcional ao KH.`,
    )
  }

  if (caAboveMax) {
    add(
      'ca_high',
      'warning',
      `Cálcio acima do ideal (${fmt(caVal!, 0)} ppm, máximo ${fmt(caSafe!.max, 0)} ppm): pause a dosagem de cálcio/parte A até normalizar.${vol > 0 ? ` TPAs de ~10% (${tpaLiters(vol, 10)}) com água bem calibrada é a forma mais segura de reduzir gradualmente.` : ' TPAs com água bem calibrada reduzem gradualmente.'}`,
    )
  }

  // ─── MAGNÉSIO ─────────────────────────────────────────────────────────────
  const mgVal = get('magnesio')
  const mgSafe = safeFor('magnesio')

  const mgAboveCritical = mgVal !== null && mgSafe && mgVal > mgSafe.max * 1.10
  const mgAboveMax = mgVal !== null && mgSafe && mgVal > mgSafe.max
  const mgBelowMin = mgVal !== null && mgSafe && mgVal < mgSafe.min
  const fosfatoVal = get('fosfato')
  const fosfatoSafe = safeFor('fosfato')
  const po4AboveMax = fosfatoVal !== null && fosfatoSafe && fosfatoVal > fosfatoSafe.max

  if (mgAboveCritical) {
    add(
      'mg_critical_high',
      'critical',
      `Magnésio criticamente elevado (${fmt(mgVal!, 0)} ppm, ideal ${fmt(mgSafe!.min, 0)}–${fmt(mgSafe!.max, 0)} ppm): pare todo suplemento de Mg imediatamente.${vol > 0 ? ` Faça TPAs de ~15% (${tpaLiters(vol, 15)}) semanalmente com água RODI + sal bem calibrado para baixar gradualmente.` : ''} Mg muito alto inibe a calcificação dos corais e pode mascarar problemas de Ca/KH.`,
    )
  } else if (mgAboveMax && caAboveMax) {
    // Ambos Mg e Ca altos — tip combinada mais relevante
    add(
      'mg_ca_high_combo',
      'warning',
      `Magnésio (${fmt(mgVal!, 0)} ppm) e Cálcio (${fmt(caVal!, 0)} ppm) ambos acima do ideal: pause toda dosagem de Mg e Ca.${vol > 0 ? ` TPAs de ~15% (${tpaLiters(vol, 15)}) com água RODI + sal de qualidade aferida vão corrigir ambos simultaneamente.` : ''} Verifique a qualidade do sal utilizado — alguns lotes chegam com Mg e Ca fora do padrão.`,
    )
  } else if (mgAboveMax && po4AboveMax) {
    // Mg alto + PO4 alto — tip combinada
    add(
      'mg_high_po4_high',
      'warning',
      `Magnésio (${fmt(mgVal!, 0)} ppm) e fosfato (${fmt(fosfatoVal!, 3)} ppm) ambos elevados: pause o suplemento de Mg e faça TPAs de ~10–15% (${vol > 0 ? tpaLiters(vol, 12) : '~10–15% do volume'}) semanalmente com água bem calibrada — isso reduz ambos simultaneamente. Além disso, revise a alimentação dos peixes (menos ração = menos fosfato) e verifique o skimmer (subdimensionado para ${vol > 0 ? fmt(tankInfo!.displayLiters, 0) + ' L' : 'o sistema'} com corais pode acumular orgânicos).`,
    )
  } else if (mgAboveMax) {
    add(
      'mg_high',
      'warning',
      `Magnésio elevado (${fmt(mgVal!, 0)} ppm, ideal até ${fmt(mgSafe!.max, 0)} ppm): suspenda ou reduza o suplemento de Mg.${vol > 0 ? ` TPAs semanais de ~10–15% (${tpaLiters(vol, 12)}) com água bem calibrada vão baixar gradualmente sem estressar o sistema.` : ''} Não force a redução de uma vez.`,
    )
  } else if (mgBelowMin) {
    add(
      'mg_low',
      'warning',
      `Magnésio baixo (${fmt(mgVal!, 0)} ppm, ideal acima de ${fmt(mgSafe!.min, 0)} ppm): dose suplemento de Mg diretamente. Mg baixo compromete a absorção de Ca e KH pelos corais — alvo mínimo: ${fmt(mgSafe!.min, 0)} ppm. Aumente em pequenos incrementos (máx ~50 ppm/dia) para evitar choque.`,
    )
  }

  // ─── FOSFATO ──────────────────────────────────────────────────────────────
  // Só gera tip standalone se MG não está gerando tip combinada de fosfato
  const mgPo4TipAdded = added.has('mg_high_po4_high')

  if (!mgPo4TipAdded && fosfatoVal !== null && fosfatoSafe && fosfatoVal > fosfatoSafe.max) {
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
        `Fosfato elevado (${fmt(fosfatoVal, 3)} ppm) com Euphyllia registrado: fosfato persistente acima de ${fmt(fosfatoSafe.max, 3)} ppm pode causar necrose tecidual (RTN) nos Euphyllia. Aumente o skimmer, considere GFO em baixa quantidade — mas reduza gradualmente para não fazer o PO4 crashar (queda brusca de fosfato também estresa corais).`,
      )
    } else {
      add(
        'phosphate_high',
        'warning',
        `Fosfato acima do ideal (${fmt(fosfatoVal, 3)} ppm): reduza a quantidade de ração, aumente a frequência de limpeza do skimmer e considere GFO em pequena quantidade. Evite reduzir abaixo de 0,03 ppm — fosfato muito baixo causa 'ULNS stress' em corais.`,
      )
    }
  }

  // PO4 muito baixo e caindo
  const fosfatoRate = rateFor('fosfato')
  if (fosfatoVal !== null && fosfatoVal < 0.03 && fosfatoRate !== null && fosfatoRate < 0) {
    add(
      'po4_low_trend',
      'info',
      `Fosfato muito baixo (${fmt(fosfatoVal, 3)} ppm) e ainda caindo: risco de estresse por ULNS (sistema ultra-low nutrient). Considere reduzir ou remover GFO, e aumentar levemente a alimentação. Corais precisam de fósforo para metabolismo celular.`,
    )
  }

  // ─── AMÔNIA ───────────────────────────────────────────────────────────────
  const amoniaVal = get('amonia')
  if (amoniaVal !== null && amoniaVal > 0.1) {
    const emergency = amoniaVal > 0.5
      ? ` EMERGÊNCIA: com amônia acima de 0,5 ppm, aplique Prime ou AmQuel imediatamente para detoxificar enquanto resolve a causa raiz.`
      : ''
    add(
      'ammonia_critical',
      'critical',
      `Amônia detectada (${fmt(amoniaVal, 2)} ppm) — tóxica para todos os organismos. Ação imediata: reduza ou cesse a alimentação, faça TPA urgente${vol > 0 ? ` (${tpaLiters(vol, 20)} ou mais)` : ''} e verifique se há animal morto no sistema.${emergency}`,
    )
  }

  // ─── NITRITO ──────────────────────────────────────────────────────────────
  const nitritoVal = get('nitrito')
  if (nitritoVal !== null && nitritoVal > 0.1) {
    add(
      'nitrite_critical',
      'critical',
      `Nitrito elevado (${fmt(nitritoVal, 2)} ppm): possível desequilíbrio no ciclo do nitrogênio. Reduza a alimentação, faça TPA imediata e verifique se o sistema de filtragem biológica está comprometido (mudança recente de rocha, limpeza excessiva do sump?).`,
    )
  }

  // ─── NITRATO ──────────────────────────────────────────────────────────────
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
    const litersText = vol > 0 ? ` (${tpaLiters(vol, pct)})` : ''
    if (!Number.isFinite(daysSince) || daysSince > 10) {
      add(
        'nitrate_tpa_due',
        'warning',
        `Nitrato elevado (${fmt(nitratoVal, 0)} ppm)${!Number.isFinite(daysSince) ? ' sem TPA registrado' : ` e sem TPA há ${fmt(daysSince, 0)} dias`}. Faça TPA de ~${pct}%${litersText} agora. Para manutenção, TPAs de 10–15% a cada 1–2 semanas evitam acúmulo.`,
      )
    } else {
      add(
        'nitrate_high',
        'warning',
        `Nitrato acima do ideal (${fmt(nitratoVal, 0)} ppm). Faça TPA de ~${pct}%${litersText} para reduzir. Revise também a quantidade de ração — excesso de alimentação é a principal causa de nitrato alto.`,
      )
    }
  }

  // ─── pH ───────────────────────────────────────────────────────────────────
  const phVal = get('ph')
  if (phVal !== null && phVal < 8.0 && nitratoVal !== null && nitratoVal > 20) {
    const coralCount = bioEntries.filter((e) => e.type === 'coral').length
    add(
      'ph_low_nitrate_high',
      'warning',
      `pH baixo (${fmt(phVal, 2)}) combinado com nitrato elevado (${fmt(nitratoVal, 0)} ppm): estresse crônico${coralCount > 0 ? ` para ${coralCount} coral(is)` : ''}. Priorize TPA urgente e melhore a aeração (sump aberto, janelas próximas ao aquário abertas à noite).`,
    )
  } else if (phVal !== null && phVal < 8.0) {
    add(
      'ph_low',
      'warning',
      `pH baixo (${fmt(phVal, 2)}): melhore a troca gasosa — aere o sump à noite e abra janelas próximas ao aquário. Em ambientes fechados, CO₂ do ar acumula e derruba o pH naturalmente. Dosagem de kalkwasser no top-off também ajuda a elevar o pH.`,
    )
  }

  // ─── TEMPERATURA ──────────────────────────────────────────────────────────
  const tempVal = get('temperatura')
  const tempSafe = safeFor('temperatura')

  if (tempVal !== null && tempSafe && tempVal < tempSafe.min) {
    add(
      'temperature_low',
      'warning',
      `Temperatura abaixo do ideal (${fmt(tempVal, 1)} °C, mínimo ${fmt(tempSafe.min, 1)} °C): verifique o aquecedor — pode estar com defeito ou subdimensionado. Aqueça gradualmente, no máximo 0,5 °C/hora para não estressar os animais.`,
    )
  } else if (tempVal !== null && tempSafe && tempVal > tempSafe.max - 0.5) {
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
        `Temperatura próxima do limite (${fmt(tempVal, 1)} °C) com Tangs registrados: Tangs são suscetíveis a ich em temperaturas altas. Verifique o resfriador e garanta boa circulação de água.`,
      )
    } else {
      add(
        'temp_high',
        'warning',
        `Temperatura próxima do limite (${fmt(tempVal, 1)} °C, máximo ${fmt(tempSafe.max, 1)} °C): verifique o resfriador. Aumento de temperatura reduz oxigênio dissolvido e acelera o metabolismo bacteriano.`,
      )
    }
  }

  // ─── SALINIDADE ───────────────────────────────────────────────────────────
  const salinidadeVal = get('salinidade')
  const salinidadeSafe = safeFor('salinidade')
  if (salinidadeVal !== null && salinidadeSafe &&
    (salinidadeVal < salinidadeSafe.min || salinidadeVal > salinidadeSafe.max)) {
    add(
      'salinity_critical',
      'critical',
      `Salinidade fora da faixa (${fmt(salinidadeVal, 3)} ppt, ideal ${fmt(salinidadeSafe.min, 3)}–${fmt(salinidadeSafe.max, 3)} ppt): não corrija bruscamente — choque osmótico pode matar invertebrados e estressar corais. Ajuste o top-off e a taxa de evaporação em pequenos passos ao longo de horas.`,
    )
  }

  // ─── SILICATO ─────────────────────────────────────────────────────────────
  const silicatoVal = get('silicato')
  const silicatoSafe = safeFor('silicato')
  if (silicatoVal !== null && silicatoSafe && silicatoVal > silicatoSafe.max) {
    add(
      'silicate_high',
      'info',
      `Silicato elevado (${fmt(silicatoVal, 2)} ppm): favorece algas diatomáceas (marrom). Verifique a qualidade da água RODI (TDS > 0 indica membrana saturada) ou adicione resina aniônica ao sistema de osmose.`,
    )
  }

  // ─── KH/Ca consumo proporcional ───────────────────────────────────────────
  if (
    khRate !== null && caRate !== null &&
    khRate < -0.05 && caRate !== null && caRate < -0.5
  ) {
    const ratio = Math.abs(caRate) / Math.abs(khRate)
    if (ratio >= 2.0 && ratio <= 3.5) {
      add(
        'kh_ca_consumption_ratio',
        'info',
        `Consumo de KH (${fmt(Math.abs(khRate), 2)} dKH/dia) e Ca (${fmt(Math.abs(caRate), 1)} ppm/dia) dentro da proporção ideal (~2,8:1) — sinal de boa mineralização dos corais.`,
      )
    } else if (ratio < 2.0 && Math.abs(khRate) > 0.1) {
      add(
        'kh_ca_imbalanced',
        'info',
        `KH caindo mais rápido que Cálcio (proporção atual: ${fmt(ratio, 1)}:1, ideal ~2,8:1) — verifique o equilíbrio entre parte A e parte B do sistema 2-partes.`,
      )
    }
  } else if (
    khRate !== null && caRate !== null &&
    khRate < -0.1 &&
    Math.abs(caRate ?? 0) < Math.abs(khRate) * 0.3
  ) {
    add(
      'kh_ca_imbalanced',
      'info',
      'KH caindo muito mais rápido que Cálcio — verifique o equilíbrio da dosagem de 2-partes. Considere aumentar a parte A (cálcio) proporcionalmente.',
    )
  }

  // ─── SPS ──────────────────────────────────────────────────────────────────
  if (tankInfo?.systemType.includes('SPS')) {
    const caVal2 = get('calcio')
    const khOk = khVal !== null && khSafe && khVal >= khSafe.min && khVal <= khSafe.max
    const caOk = caVal2 !== null && caSafe ? caVal2 >= caSafe.min && caVal2 <= caSafe.max : true
    if (!khOk || !caOk) {
      if (!added.has('kh_critical_falling') && !added.has('ca_critical_low') && !added.has('ca_high')) {
        add(
          'sps_param_alert',
          'warning',
          `Sistema SPS detectado com KH/Cálcio fora da faixa ideal: corais SPS são muito sensíveis a variações — ajuste a dosagem 2-partes gradualmente. Variação de KH > 0,5 dKH em 24h pode causar RTN em SPS.`,
        )
      }
    } else if (khRate !== null && Math.abs(khRate) < 0.05 && caRate !== null && Math.abs(caRate) < 1) {
      add(
        'sps_low_consumption',
        'info',
        `Sistema SPS com consumo de KH e Ca muito baixo: verifique se os corais estão crescendo adequadamente. Baixo consumo pode indicar iluminação insuficiente, parâmetros instáveis de longa data ou corais em estresse.`,
      )
    }
  }

  // ─── Aquário nano ─────────────────────────────────────────────────────────
  if (tankInfo && tankInfo.displayLiters < 100 && tankInfo.displayLiters > 0) {
    const unstableParams = ['kh', 'calcio', 'salinidade'].filter((k) => {
      const val = get(k)
      const safe = safeFor(k)
      return val !== null && safe && (val < safe.min || val > safe.max)
    })
    if (unstableParams.length > 0) {
      add(
        'nano_instability',
        'warning',
        `Aquário nano (${fmt(tankInfo.displayLiters, 0)} L): volume pequeno amplifica variações bruscas. Parâmetros instáveis: ${unstableParams.join(', ')}. Monitore diariamente e faça TPAs menores e mais frequentes (5% a cada 3–4 dias) em vez de grandes trocas semanais.`,
      )
    }
  }

  // ─── TPA atrasada (geral) ─────────────────────────────────────────────────
  const tpaLogs = protocolLogs
    .filter((log) => log.protocolKey.includes('tpa'))
    .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime())
  const lastTpa = tpaLogs[0]
  const daysSinceTpa = lastTpa
    ? (Date.now() - new Date(lastTpa.performedAt).getTime()) / 86400000
    : Infinity
  // Só avisa se não há já tip de nitrato com TPA, e se faz mais de 21 dias
  if ((!Number.isFinite(daysSinceTpa) || daysSinceTpa > 21) && !added.has('nitrate_tpa_due')) {
    const pct = 10
    const litersText = vol > 0 ? ` (${tpaLiters(vol, pct)})` : ''
    add(
      'tpa_overdue_general',
      'info',
      `${!Number.isFinite(daysSinceTpa) ? 'Nenhuma TPA registrada' : `Última TPA há ${fmt(daysSinceTpa, 0)} dias`}: TPAs regulares repõem oligoelementos, removem orgânicos acumulados e estabilizam a salinidade. Sugestão: ~10%${litersText} a cada 2 semanas, mesmo com parâmetros estáveis.`,
    )
  }

  // ─── Tudo ideal ───────────────────────────────────────────────────────────
  if (tips.length === 0) {
    const withData = Array.from(parameterInsights.values()).filter((i) => i.latest !== null)
    if (withData.length >= 3 && withData.every((i) => i.badge === 'Ideal')) {
      const volText = tankInfo ? ` Sistema: ~${fmt(tankInfo.totalLiters, 0)} L.` : ''
      add('all_ideal', 'info', `Todos os parâmetros monitorados dentro das faixas ideais.${volText} Excelente manejo!`)
    }
  }

  const severityOrder: Record<SmartTip['severity'], number> = { critical: 0, warning: 1, info: 2 }
  tips.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
  return tips
}
