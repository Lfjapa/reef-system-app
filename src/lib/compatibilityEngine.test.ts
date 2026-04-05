import { describe, it, expect } from 'vitest'
import { checkCompatibility } from './compatibilityEngine'
import type { DbHints, TankContext } from './compatibilityEngine'

// ── Helpers ──────────────────────────────────────────────────────────────────

const fish = (name: string, scientificName = '') =>
  ({ name, scientificName, type: 'peixe' as const })

const coral = (name: string, scientificName = '') =>
  ({ name, scientificName, type: 'coral' as const })

const invert = (name: string, scientificName = '') =>
  ({ name, scientificName, type: 'invertebrado' as const })

const warnings = (...entries: ReturnType<typeof fish>[]) =>
  (newEntry: ReturnType<typeof fish>, dbHints?: DbHints, tank?: TankContext) =>
    checkCompatibility(newEntry, entries, dbHints, tank).warnings

// ── Tangs ─────────────────────────────────────────────────────────────────────

describe('Tangs', () => {
  it('emite aviso ao adicionar segundo Tang de gênero diferente', () => {
    const existing = [fish('Cirurgião azul', 'Paracanthurus hepatus')]
    const result = checkCompatibility(fish('Tang amarelo', 'Zebrasoma flavescens'), existing)
    expect(result.warnings.some((w) => w.severity === 'warning')).toBe(true)
  })

  it('emite crítico ao adicionar Tang do mesmo gênero', () => {
    const existing = [fish('Tang amarelo', 'Zebrasoma flavescens')]
    const result = checkCompatibility(fish('Tang escoteiro', 'Zebrasoma scopas'), existing)
    expect(result.safe).toBe(false)
    expect(result.warnings.some((w) => w.severity === 'critical')).toBe(true)
  })

  it('não emite aviso se for o primeiro Tang', () => {
    const result = checkCompatibility(fish('Tang amarelo', 'Zebrasoma flavescens'), [])
    expect(result.warnings.filter((w) => w.message.toLowerCase().includes('tang'))).toHaveLength(0)
  })
})

// ── Clownfish ─────────────────────────────────────────────────────────────────

describe('Clownfish', () => {
  it('emite crítico com mais de 2 palhaços', () => {
    const existing = [
      fish('Nemo', 'Amphiprion ocellaris'),
      fish('Palhaço', 'Amphiprion ocellaris'),
    ]
    const result = checkCompatibility(fish('Palhaço 3', 'Amphiprion ocellaris'), existing)
    expect(result.safe).toBe(false)
  })

  it('não emite aviso com apenas um palhaço existente', () => {
    const existing = [fish('Nemo', 'Amphiprion ocellaris')]
    const result = checkCompatibility(fish('Palhaço 2', 'Amphiprion percula'), existing)
    const clownWarnings = result.warnings.filter((w) => w.message.includes('Palhaço') || w.message.includes('palhaço') || w.message.includes('Peixe'))
    expect(result.safe).toBe(true)
    expect(clownWarnings).toHaveLength(0)
  })
})

// ── Predadores ────────────────────────────────────────────────────────────────

describe('Garoupas (predadores)', () => {
  it('emite crítico quando garoupa ameaça peixe pequeno', () => {
    const existing = [fish('Gobio', 'Amblyeleotris wheeleri')]
    const result = checkCompatibility(fish('Garoupa', 'Cephalopholis miniata'), existing)
    expect(result.safe).toBe(false)
  })
})

describe('Peixes-gatilho', () => {
  it('emite crítico com invertebrados no aquário', () => {
    const existing = [invert('Camarão limpador', 'Lysmata amboinensis')]
    const result = checkCompatibility(fish('Gatilho', 'Rhinecanthus aculeatus'), existing)
    expect(result.safe).toBe(false)
  })

  it('não emite aviso sem invertebrados', () => {
    const result = checkCompatibility(fish('Gatilho', 'Rhinecanthus aculeatus'), [])
    const critical = result.warnings.filter((w) => w.severity === 'critical')
    expect(critical).toHaveLength(0)
  })
})

describe('Baiacus', () => {
  it('emite crítico com invertebrados e aviso com corais', () => {
    const existing = [
      invert('Camarão', 'Lysmata amboinensis'),
      coral('Hammer coral', 'Euphyllia ancora'),
    ]
    const result = checkCompatibility(fish('Baiacu', 'Arothron meleagris'), existing)
    expect(result.safe).toBe(false)
    expect(result.warnings.some((w) => w.severity === 'critical')).toBe(true)
    expect(result.warnings.some((w) => w.severity === 'warning')).toBe(true)
  })
})

// ── Mandarim ──────────────────────────────────────────────────────────────────

describe('Mandarim', () => {
  it('emite info sobre copépodes', () => {
    const result = checkCompatibility(fish('Mandarim', 'Synchiropus splendidus'), [])
    expect(result.warnings.some((w) => w.severity === 'info')).toBe(true)
    expect(result.warnings[0].message).toMatch(/cop[eé]pode/i)
  })
})

// ── Invertebrado vs predadores ────────────────────────────────────────────────

describe('Invertebrado adicionado com predador já no aquário', () => {
  it('emite crítico ao adicionar invertebrado quando gatilho está presente', () => {
    const existing = [fish('Gatilho', 'Rhinecanthus aculeatus')]
    const result = checkCompatibility(invert('Camarão', 'Lysmata amboinensis'), existing)
    expect(result.safe).toBe(false)
  })
})

// ── Ordenação dos avisos ───────────────────────────────────────────────────────

describe('Ordenação das severidades', () => {
  it('críticos vêm antes de warnings e info', () => {
    const existing = [invert('Camarão', ''), fish('Gobio', 'Amblyeleotris wheeleri')]
    const result = checkCompatibility(fish('Garoupa', 'Cephalopholis miniata'), existing)
    const severities = result.warnings.map((w) => w.severity)
    const criticalIdx = severities.indexOf('critical')
    const warningIdx = severities.findIndex((s) => s === 'warning' || s === 'info')
    if (criticalIdx >= 0 && warningIdx >= 0) {
      expect(criticalIdx).toBeLessThan(warningIdx)
    }
  })
})

// ── DbHints ───────────────────────────────────────────────────────────────────

describe('DbHints — dados do banco', () => {
  it('emite aviso de volume mínimo quando aquário é pequeno', () => {
    const hints: DbHints = { minTankLiters: 500 }
    const tank: TankContext = { volumeLiters: 300 }
    const result = checkCompatibility(fish('Cirurgião', 'Naso lituratus'), [], hints, tank)
    expect(result.warnings.some((w) => w.message.includes('500'))).toBe(true)
  })

  it('emite crítico quando diferença de volume é > 100 L', () => {
    const hints: DbHints = { minTankLiters: 500 }
    const tank: TankContext = { volumeLiters: 200 }
    const result = checkCompatibility(fish('Cirurgião', 'Naso lituratus'), [], hints, tank)
    expect(result.warnings.some((w) => w.severity === 'critical')).toBe(true)
  })

  it('emite warning (não crítico) quando diferença de volume é <= 100 L', () => {
    const hints: DbHints = { minTankLiters: 350 }
    const tank: TankContext = { volumeLiters: 300 }
    const result = checkCompatibility(fish('Cirurgião', 'Naso lituratus'), [], hints, tank)
    const volumeWarn = result.warnings.find((w) => w.message.includes('350'))
    expect(volumeWarn?.severity).toBe('warning')
  })

  it('não emite aviso quando aquário tem volume suficiente', () => {
    const hints: DbHints = { minTankLiters: 300 }
    const tank: TankContext = { volumeLiters: 300 }
    const result = checkCompatibility(fish('Peixe', 'Foo bar'), [], hints, tank)
    expect(result.warnings.some((w) => w.message.includes('300'))).toBe(false)
  })

  it('emite aviso de agressividade quando espécie é agressiva (não coberta por regras hardcoded)', () => {
    const hints: DbHints = { aggressionLevel: 'Agressivo' }
    const existing = [fish('Outro peixe', 'Chromis viridis')]
    const result = checkCompatibility(fish('Peixe agressivo', 'Foo agressivus'), existing, hints)
    expect(result.warnings.some((w) => w.message.toLowerCase().includes('agressiv'))).toBe(true)
  })

  it('não emite aviso de agressividade se aquário está vazio', () => {
    const hints: DbHints = { aggressionLevel: 'Agressivo' }
    const result = checkCompatibility(fish('Peixe agressivo', 'Foo agressivus'), [], hints)
    const aggrWarn = result.warnings.filter((w) => w.message.toLowerCase().includes('agressiv'))
    expect(aggrWarn).toHaveLength(0)
  })

  it('emite crítico de predação de invertebrado via predatorRisk', () => {
    const hints: DbHints = { predatorRisk: ['invertebrado'] }
    const existing = [invert('Camarão', 'Lysmata amboinensis')]
    // Use espécie sem cobertura hardcoded
    const result = checkCompatibility(fish('Peixe exótico', 'Exoticus predatoris'), existing, hints)
    expect(result.warnings.some((w) => w.severity === 'critical' && w.message.includes('predação'))).toBe(true)
  })

  it('emite crítico de predação de coral via predatorRisk', () => {
    const hints: DbHints = { predatorRisk: ['coral'] }
    const existing = [coral('SPS', 'Acropora millepora')]
    const result = checkCompatibility(fish('Peixe exótico', 'Exoticus coralvorus'), existing, hints)
    expect(result.warnings.some((w) => w.severity === 'critical')).toBe(true)
  })
})
