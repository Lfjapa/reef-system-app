// Shared utilities for bio catalog matching and normalization

export type BioType = 'peixe' | 'coral' | 'invertebrado'

export type BioCatalogEntry = {
  aliases: string[]
  type: BioType
  scientificName: string
  position: string
  note: string
}

export const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')

export const scoreTextMatch = (query: string, text: string) => {
  if (!query) return 0
  if (!text) return 0
  if (text === query) return 100
  if (text.startsWith(query)) return 90
  if (text.includes(` ${query}`)) return 80
  if (text.includes(query)) return 70
  const tokens = query.split(' ').filter(Boolean)
  if (!tokens.length) return 0
  if (tokens.every((token) => text.includes(token))) return 60
  // Partial: best single long-token match, capped at 55 (below catalog threshold of 60)
  const longTokens = tokens.filter((t) => t.length >= 3)
  if (!longTokens.length) return 0
  let bestPartial = 0
  for (const token of longTokens) {
    let s = 0
    if (text === token) s = 55
    else if (text.startsWith(token)) s = 50
    else if (text.includes(` ${token}`)) s = 45
    else if (text.includes(token)) s = 40
    if (s > bestPartial) bestPartial = s
  }
  return bestPartial
}

export const findBestCatalogMatch = (name: string, entries: BioCatalogEntry[]) => {
  const normalized = normalize(name)
  if (normalized.length < 2) return null
  let bestEntry: BioCatalogEntry | null = null
  let bestScore = 0

  for (const entry of entries) {
    let entryScore = 0
    for (const alias of entry.aliases) {
      const aliasNormalized = normalize(alias)
      const score = scoreTextMatch(normalized, aliasNormalized)
      if (score > entryScore) entryScore = score
      if (entryScore === 100) break
    }
    if (entryScore > bestScore) {
      bestScore = entryScore
      bestEntry = entry
      if (bestScore === 100) break
    }
  }

  return bestScore >= 60 ? bestEntry : null
}

export const mergeCatalog = (base: BioCatalogEntry[], extras: BioCatalogEntry[]) => {
  const merged = [...base]
  const aliasSet = new Set<string>()

  for (const entry of merged) {
    for (const alias of entry.aliases) {
      aliasSet.add(normalize(alias))
    }
  }

  for (const entry of extras) {
    const isDup = entry.aliases.some((alias) => aliasSet.has(normalize(alias)))
    if (isDup) continue
    merged.push(entry)
    for (const alias of entry.aliases) {
      aliasSet.add(normalize(alias))
    }
  }

  return merged
}
