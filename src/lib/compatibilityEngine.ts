// Regras de compatibilidade baseadas em conhecimento de aquarismo marinho.
// Não requer dados extras no banco — usa nome científico + tipo.

export type CompatibilityWarning = {
  severity: 'critical' | 'warning' | 'info'
  message: string
}

export type CompatibilityResult = {
  safe: boolean
  warnings: CompatibilityWarning[]
}

type BioEntryLike = {
  name: string
  scientificName: string
  type: 'peixe' | 'coral' | 'invertebrado'
}

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const containsAny = (text: string, terms: string[]) => {
  const n = normalize(text)
  return terms.some((t) => n.includes(normalize(t)))
}

// Grupos problemáticos conhecidos
const TANG_GENERA = ['Zebrasoma', 'Paracanthurus', 'Ctenochaetus', 'Acanthurus', 'Naso', 'Prionurus']
const DOTTYBACK_GENERA = ['Pseudochromis', 'Manonichthys']
const CLOWNFISH_GENERA = ['Amphiprion', 'Premnas']
const GROUPER_GENERA = ['Cephalopholis', 'Epinephelus', 'Variola', 'Plectropomus']
const TRIGGERFISH_GENERA = ['Balistoides', 'Rhinecanthus', 'Pseudobalistes', 'Xanthichthys']
const LIONFISH_GENERA = ['Pterois', 'Dendrochirus']
const PUFFERFISH_GENERA = ['Arothron', 'Canthigaster', 'Diodon']
const AGGRESSIVE_DAMSELS = ['Chrysiptera', 'Dascyllus', 'Microspathodon']

const getGenus = (scientificName: string) => scientificName.trim().split(/\s+/)[0] ?? ''

const isTang = (entry: BioEntryLike) =>
  TANG_GENERA.includes(getGenus(entry.scientificName)) ||
  containsAny(entry.name, ['tang', 'cirurgiao', 'cirurgião', 'espada', 'acanthurus'])

const isClownfish = (entry: BioEntryLike) =>
  CLOWNFISH_GENERA.includes(getGenus(entry.scientificName)) ||
  containsAny(entry.name, ['palha', 'clown', 'nemo', 'palhaço', 'palhaco'])

const isGrouper = (entry: BioEntryLike) =>
  GROUPER_GENERA.includes(getGenus(entry.scientificName)) ||
  containsAny(entry.name, ['garoupa', 'grouper', 'lyretail', 'anthias coral'])

const isTrigger = (entry: BioEntryLike) =>
  TRIGGERFISH_GENERA.includes(getGenus(entry.scientificName)) ||
  containsAny(entry.name, ['trigger', 'gatilho'])

const isLionfish = (entry: BioEntryLike) =>
  LIONFISH_GENERA.includes(getGenus(entry.scientificName)) ||
  containsAny(entry.name, ['leao', 'leão', 'lion', 'pterois', 'escorpiao', 'escorpião'])

const isPufferfish = (entry: BioEntryLike) =>
  PUFFERFISH_GENERA.includes(getGenus(entry.scientificName)) ||
  containsAny(entry.name, ['baiacu', 'puffer'])

const isAggressiveDamsel = (entry: BioEntryLike) =>
  AGGRESSIVE_DAMSELS.includes(getGenus(entry.scientificName)) ||
  containsAny(entry.name, ['donzela', 'demoiselle', 'dascyllus'])

const isDottyback = (entry: BioEntryLike) =>
  DOTTYBACK_GENERA.includes(getGenus(entry.scientificName)) ||
  containsAny(entry.name, ['pseudochromis', 'dottyback'])

const isMandarin = (entry: BioEntryLike) =>
  containsAny(entry.name + ' ' + entry.scientificName, ['mandarin', 'synchiropus'])

const isShrimpGoby = (entry: BioEntryLike) =>
  containsAny(entry.name + ' ' + entry.scientificName, [
    'gobio', 'goby', 'watchman', 'amblyeleotris', 'stonogobiops', 'cryptocentrus',
  ])

export const checkCompatibility = (
  newEntry: BioEntryLike,
  existingEntries: BioEntryLike[],
): CompatibilityResult => {
  const warnings: CompatibilityWarning[] = []

  // ── Tangs ──
  if (isTang(newEntry)) {
    const sameTangs = existingEntries.filter(isTang)
    if (sameTangs.length >= 1) {
      const sameGenus = sameTangs.filter(
        (e) => getGenus(e.scientificName) === getGenus(newEntry.scientificName),
      )
      if (sameGenus.length >= 1) {
        warnings.push({
          severity: 'critical',
          message: `Conflito de território: já existe um Tang do mesmo gênero (${getGenus(newEntry.scientificName)}). Dois do mesmo gênero raramente coexistem em aquários domésticos.`,
        })
      } else {
        warnings.push({
          severity: 'warning',
          message: `Já existem ${sameTangs.length} Tang(s) no aquário. A adição de mais Tangs aumenta o risco de brigas por território. Aquários maiores (>400 L) reduzem o conflito.`,
        })
      }
    }
  }

  // ── Clownfish — apenas um casal por anêmona ──
  if (isClownfish(newEntry)) {
    const existingClowns = existingEntries.filter(isClownfish)
    if (existingClowns.length >= 2) {
      warnings.push({
        severity: 'critical',
        message: `Já existem ${existingClowns.length} Peixes-palhaço registrados. Mais de um casal em aquários pequenos gera agressividade elevada.`,
      })
    }
  }

  // ── Predadores grandes ──
  if (isGrouper(newEntry)) {
    const smallFish = existingEntries.filter(
      (e) =>
        e.type === 'peixe' &&
        (containsAny(e.name + ' ' + e.scientificName, [
          'goby', 'gobio', 'firefish', 'nemateleotris', 'blenny', 'pseudocheilinus',
          'basslet', 'gramma', 'dottyback', 'cardeal', 'banggai',
        ]) ||
          isMandarin(e)),
    )
    if (smallFish.length > 0) {
      warnings.push({
        severity: 'critical',
        message: `Garoupas são predadores — podem consumir peixes menores como ${smallFish.map((e) => e.name).slice(0, 3).join(', ')}.`,
      })
    }
  }

  // ── Peixes-gatilho ──
  if (isTrigger(newEntry)) {
    const inverts = existingEntries.filter((e) => e.type === 'invertebrado')
    if (inverts.length > 0) {
      warnings.push({
        severity: 'critical',
        message: `Peixes-gatilho são conhecidos por destruir invertebrados (camarões, caranguejos, ouriços). ${inverts.length} invertebrado(s) registrado(s) em risco.`,
      })
    }
  }

  // ── Peixes-leão ──
  if (isLionfish(newEntry)) {
    const smallFish = existingEntries.filter(
      (e) =>
        e.type === 'peixe' &&
        containsAny(e.name + ' ' + e.scientificName, [
          'chromis', 'dartfish', 'firefish', 'cardeal', 'banggai', 'goby', 'blenny',
        ]),
    )
    if (smallFish.length > 0) {
      warnings.push({
        severity: 'warning',
        message: `Peixes-leão podem predar peixes pequenos — monitore ${smallFish.map((e) => e.name).slice(0, 2).join(', ')}.`,
      })
    }
  }

  // ── Baiacus ──
  if (isPufferfish(newEntry)) {
    const inverts = existingEntries.filter((e) => e.type === 'invertebrado')
    const corals = existingEntries.filter((e) => e.type === 'coral')
    if (inverts.length > 0) {
      warnings.push({
        severity: 'critical',
        message: `Baiacus comem invertebrados de concha dura. ${inverts.length} invertebrado(s) em risco.`,
      })
    }
    if (corals.length > 0) {
      warnings.push({
        severity: 'warning',
        message: 'Baiacus podem morder corais. Monitore os Euphyllia e LPS.',
      })
    }
  }

  // ── Dottybacks agressivos ──
  if (isDottyback(newEntry)) {
    const peaceful = existingEntries.filter(
      (e) =>
        e.type === 'peixe' &&
        containsAny(e.name + ' ' + e.scientificName, [
          'firefish', 'nemateleotris', 'assessor', 'gramma', 'blenny',
        ]),
    )
    if (peaceful.length > 0) {
      warnings.push({
        severity: 'warning',
        message: `Dottybacks podem intimidar peixes pacíficos de porte similar — atenção com ${peaceful.map((e) => e.name).slice(0, 2).join(', ')}.`,
      })
    }
  }

  // ── Damsels agressivos ──
  if (isAggressiveDamsel(newEntry)) {
    warnings.push({
      severity: 'info',
      message: 'Donzelas agressivas podem monopolizar territórios. Adicione por último ao aquário.',
    })
  }

  // ── Invertebrados × predadores já no aquário ──
  if (newEntry.type === 'invertebrado') {
    const predatoryExisting = existingEntries.filter(
      (e) => isTrigger(e) || isPufferfish(e) || isGrouper(e),
    )
    if (predatoryExisting.length > 0) {
      warnings.push({
        severity: 'critical',
        message: `Invertebrados são presas de ${predatoryExisting.map((e) => e.name).join(', ')} já registrados no aquário.`,
      })
    }
  }

  // ── Mandarim: requer copépodes ──
  if (isMandarin(newEntry)) {
    warnings.push({
      severity: 'info',
      message: 'Peixe-mandarim exige alimentação com copépodes vivos. Certifique-se de ter um refugium populado ou introduza copépodes regularmente.',
    })
  }

  // ── Gobio com camarão-pistola ──
  if (isShrimpGoby(newEntry)) {
    const pistolShrimp = existingEntries.filter((e) =>
      containsAny(e.name + ' ' + e.scientificName, ['pistol', 'alpheus', 'pistola']),
    )
    if (pistolShrimp.length === 0) {
      warnings.push({
        severity: 'info',
        message: 'Gobios-sentinela formam parceria simbiótica com camarões-pistola — considere adicionar um Alpheus spp. para comportamento natural.',
      })
    }
  }

  const hasCritical = warnings.some((w) => w.severity === 'critical')
  const safe = !hasCritical
  warnings.sort((a, b) => {
    const o: Record<CompatibilityWarning['severity'], number> = { critical: 0, warning: 1, info: 2 }
    return o[a.severity] - o[b.severity]
  })

  return { safe, warnings }
}
