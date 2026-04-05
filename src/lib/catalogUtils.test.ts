import { describe, it, expect } from 'vitest'
import { normalize, scoreTextMatch, findBestCatalogMatch, mergeCatalog } from './catalogUtils'
import type { BioCatalogEntry } from './catalogUtils'

// ── normalize ─────────────────────────────────────────────────────────────────

describe('normalize', () => {
  it('converte para minúsculas', () => {
    expect(normalize('Tanque')).toBe('tanque')
  })

  it('remove acentos', () => {
    expect(normalize('Peixe-palhaço')).toBe('peixe-palhaco')
    expect(normalize('Cirurgião')).toBe('cirurgiao')
  })

  it('colapsa espa��os múltiplos', () => {
    expect(normalize('peixe   boi')).toBe('peixe boi')
  })

  it('remove espaços das extremidades', () => {
    expect(normalize('  coral  ')).toBe('coral')
  })
})

// ── scoreTextMatch ─────────────────────────────────────────────────────────────

describe('scoreTextMatch', () => {
  it('retorna 100 para texto exato', () => {
    expect(scoreTextMatch('coral', 'coral')).toBe(100)
  })

  it('retorna 90 para texto que começa com query', () => {
    expect(scoreTextMatch('cor', 'coral')).toBe(90)
  })

  it('retorna 80 para query com espaço antes', () => {
    expect(scoreTextMatch('coral', 'lps coral')).toBe(80)
  })

  it('retorna 70 para substring no meio', () => {
    expect(scoreTextMatch('oral', 'coral')).toBe(70)
  })

  it('retorna 60 para todos os tokens presentes', () => {
    expect(scoreTextMatch('peixe palha', 'peixe-palhaco')).toBe(0) // não é substring
    expect(scoreTextMatch('coral lps', 'acropora coral lps')).toBe(60)
  })

  it('retorna 0 para query vazia', () => {
    expect(scoreTextMatch('', 'coral')).toBe(0)
  })

  it('retorna 0 para texto vazio', () => {
    expect(scoreTextMatch('coral', '')).toBe(0)
  })

  it('retorna 0 para correspondência ausente', () => {
    expect(scoreTextMatch('xyz', 'coral')).toBe(0)
  })
})

// ── findBestCatalogMatch ───────────────────────────────────────────────────────

const sampleCatalog: BioCatalogEntry[] = [
  {
    aliases: ['peixe-palhaço', 'palhaço', 'nemo', 'clownfish'],
    type: 'peixe',
    scientificName: 'Amphiprion ocellaris',
    position: '',
    note: '',
  },
  {
    aliases: ['cirurgião azul', 'dory', 'tang azul'],
    type: 'peixe',
    scientificName: 'Paracanthurus hepatus',
    position: '',
    note: '',
  },
  {
    aliases: ['camarão limpador', 'camarao limpador'],
    type: 'invertebrado',
    scientificName: 'Lysmata amboinensis',
    position: '',
    note: '',
  },
]

describe('findBestCatalogMatch', () => {
  it('encontra entrada por alias exato', () => {
    const match = findBestCatalogMatch('nemo', sampleCatalog)
    expect(match?.scientificName).toBe('Amphiprion ocellaris')
  })

  it('encontra entrada por alias normalizado (sem acento)', () => {
    const match = findBestCatalogMatch('palhaco', sampleCatalog)
    expect(match?.scientificName).toBe('Amphiprion ocellaris')
  })

  it('encontra entrada por prefixo', () => {
    const match = findBestCatalogMatch('dor', sampleCatalog)
    expect(match?.scientificName).toBe('Paracanthurus hepatus')
  })

  it('retorna null para query curta (< 2 chars)', () => {
    expect(findBestCatalogMatch('a', sampleCatalog)).toBeNull()
    expect(findBestCatalogMatch('', sampleCatalog)).toBeNull()
  })

  it('retorna null quando não há correspondência suficiente', () => {
    expect(findBestCatalogMatch('zzzzz', sampleCatalog)).toBeNull()
  })

  it('encontra invertebrado sem acento', () => {
    const match = findBestCatalogMatch('camarao limpador', sampleCatalog)
    expect(match?.type).toBe('invertebrado')
  })
})

// ── mergeCatalog ──────────────────────────────────────────────────────────────

describe('mergeCatalog', () => {
  const base: BioCatalogEntry[] = [
    { aliases: ['nemo', 'palhaco'], type: 'peixe', scientificName: 'Amphiprion ocellaris', position: '', note: '' },
  ]
  const extras: BioCatalogEntry[] = [
    { aliases: ['tang amarelo'], type: 'peixe', scientificName: 'Zebrasoma flavescens', position: '', note: '' },
  ]

  it('combina base com extras sem duplicar', () => {
    const merged = mergeCatalog(base, extras)
    expect(merged).toHaveLength(2)
  })

  it('não adiciona extra com alias duplicado do base', () => {
    const dup: BioCatalogEntry[] = [
      { aliases: ['nemo'], type: 'peixe', scientificName: 'Amphiprion ocellaris', position: '', note: '' },
    ]
    const merged = mergeCatalog(base, dup)
    expect(merged).toHaveLength(1)
  })

  it('preserva a ordem: base primeiro, extras depois', () => {
    const merged = mergeCatalog(base, extras)
    expect(merged[0].scientificName).toBe('Amphiprion ocellaris')
    expect(merged[1].scientificName).toBe('Zebrasoma flavescens')
  })

  it('múltiplos extras distintos são todos adicionados', () => {
    const multi: BioCatalogEntry[] = [
      { aliases: ['dory'], type: 'peixe', scientificName: 'Paracanthurus hepatus', position: '', note: '' },
      { aliases: ['mandarin'], type: 'peixe', scientificName: 'Synchiropus splendidus', position: '', note: '' },
    ]
    const merged = mergeCatalog(base, multi)
    expect(merged).toHaveLength(3)
  })

  it('não muta o array base original', () => {
    const originalLength = base.length
    mergeCatalog(base, extras)
    expect(base).toHaveLength(originalLength)
  })
})
