import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { isSupabaseEnabled } from '../lib/supabase'
import { logError } from '../lib/log'
import {
  deleteCloudBio,
  fetchBioDeepDiveByEntryId,
  fetchBioDeepDivePreviews,
  fetchBioRequirementByScientificName,
  upsertCloudBio,
  upsertCloudCatalog,
} from '../lib/cloudStore'
import {
  normalize,
  scoreTextMatch,
  findBestCatalogMatch,
  mergeCatalog,
} from '../lib/catalogUtils'
import type { BioCatalogEntry, BioType } from '../lib/catalogUtils'
import { seedBioCatalogData } from '../data/defaults'

export type { BioType, BioCatalogEntry }

const seedBioCatalog: BioCatalogEntry[] = seedBioCatalogData

type BioEntry = {
  id: string
  type: BioType
  name: string
  scientificName: string
  position: string
  note: string
  createdAt: string
}

type BioRequirementPreview = {
  scientificName: string
  reefCompatible: string | null
  waterConditions: string | null
  lighting: string | null
  flow: string | null
  tempMinC: number | null
  tempMaxC: number | null
  sgMin: number | null
  sgMax: number | null
  phMin: number | null
  phMax: number | null
  dkhMin: number | null
  dkhMax: number | null
  source: string | null
  sourceUrl: string | null
  difficulty?: string | null
  minTankLiters?: number | null
  behaviorNotes?: string | null
  aggressionLevel?: string | null
  compatibleSpecies?: string[]
  territoryType?: string | null
  predatorRisk?: string[]
  preyRisk?: string[]
  caMin?: number | null
  caMax?: number | null
  mgMin?: number | null
  mgMax?: number | null
}

type BioDeepDivePreview = {
  reefCompatible: string | null
  lighting: string | null
  flow: string | null
  tempMinC?: number | null
  tempMaxC?: number | null
  sgMin?: number | null
  sgMax?: number | null
  phMin?: number | null
  phMax?: number | null
  dkhMin?: number | null
  dkhMax?: number | null
  aggressionLevel?: string | null
}

type RequirementState = 'idle' | 'loading' | 'found' | 'not_found' | 'error'
type FaunaSubmenu = BioType

const findInCatalog = (name: string) => findBestCatalogMatch(name, seedBioCatalog)

type Props = {
  authUser: User | null
  activeTab: string
  syncReloadNonce: number
  enqueueCloudWrite: (label: string, fn: () => Promise<void>) => void
}

export type UseBioEntriesReturn = ReturnType<typeof useBioEntries>

export function useBioEntries({ authUser, activeTab, syncReloadNonce, enqueueCloudWrite }: Props) {
  const bioEntriesStorageKey = isSupabaseEnabled
    ? authUser
      ? `reef-system-bio-entries:${authUser.id}`
      : null
    : 'reef-system-bio-entries'

  const catalogStorageKey = isSupabaseEnabled
    ? authUser
      ? `reef-system-bio-catalog:${authUser.id}`
      : null
    : 'reef-system-bio-catalog'

  // ── Form state ──
  const [bioType, setBioType] = useState<BioType>('peixe')
  const [bioName, setBioName] = useState<string>('')
  const [bioScientificName, setBioScientificName] = useState<string>('')
  const [bioPosition, setBioPosition] = useState<string>('')
  const [bioNote, setBioNote] = useState<string>('')
  const [bioEditingId, setBioEditingId] = useState<string | null>(null)

  // ── Data state ──
  const [bioEntries, setBioEntries] = useState<BioEntry[]>([])
  const [catalogEntries, setCatalogEntries] = useState<BioCatalogEntry[]>(seedBioCatalog)
  const [bioDeepDivePreviewById, setBioDeepDivePreviewById] = useState<Map<string, BioDeepDivePreview>>(() => new Map())
  const [isSearchingBio, setIsSearchingBio] = useState<boolean>(false)

  // ── List UI state ──
  const [faunaSubmenu, setFaunaSubmenu] = useState<FaunaSubmenu>('peixe')
  const [faunaSearch, setFaunaSearch] = useState<string>('')

  // ── Requirement preview (form) ──
  const [bioRequirementState, setBioRequirementState] = useState<RequirementState>('idle')
  const [bioRequirementPreview, setBioRequirementPreview] = useState<BioRequirementPreview | null>(null)

  // ── Animal details modal ──
  const [animalDetailsEntry, setAnimalDetailsEntry] = useState<BioEntry | null>(null)
  const [animalDetailsCatalogEntry, setAnimalDetailsCatalogEntry] = useState<BioCatalogEntry | null>(null)
  const [animalRequirementState, setAnimalRequirementState] = useState<RequirementState>('idle')
  const [animalRequirement, setAnimalRequirement] = useState<BioRequirementPreview | null>(null)

  // ── Refs ──
  const animalRequirementRequestIdRef = useRef(0)
  const bioSearchRequestIdRef = useRef(0)
  const bioSearchAbortRef = useRef<AbortController | null>(null)

  // ── Persist bio entries ──
  useEffect(() => {
    if (!bioEntriesStorageKey) return
    try {
      localStorage.setItem(bioEntriesStorageKey, JSON.stringify(bioEntries))
    } catch {
      // storage full — ignore
    }
  }, [bioEntries, bioEntriesStorageKey])

  // ── Persist catalog extras (only non-seed entries) ──
  useEffect(() => {
    const extras = catalogEntries.filter(
      (entry) =>
        !seedBioCatalog.some((seed) =>
          seed.aliases.some((seedAlias) =>
            entry.aliases.some((alias) => normalize(alias) === normalize(seedAlias)),
          ),
        ),
    )
    if (!catalogStorageKey) return
    try {
      localStorage.setItem(catalogStorageKey, JSON.stringify(extras))
    } catch {
      // storage full — ignore
    }
  }, [catalogEntries, catalogStorageKey])

  // ── Requirement preview effect (form) ──
  useEffect(() => {
    if (!isSupabaseEnabled || !authUser) {
      setBioRequirementState('idle')
      setBioRequirementPreview(null)
      return
    }
    const scientific = bioScientificName.trim()
    if (!scientific) {
      setBioRequirementState('idle')
      setBioRequirementPreview(null)
      return
    }
    let alive = true
    setBioRequirementState('loading')
    void (async () => {
      try {
        const requirement = await fetchBioRequirementByScientificName(scientific)
        if (!alive) return
        if (!requirement) {
          setBioRequirementState('not_found')
          setBioRequirementPreview(null)
          return
        }
        setBioRequirementState('found')
        setBioRequirementPreview(requirement)
      } catch (error) {
        logError('bio-requirements', error)
        if (!alive) return
        setBioRequirementState('error')
        setBioRequirementPreview(null)
      }
    })()
    return () => {
      alive = false
    }
  }, [authUser, bioScientificName])

  // ── Deep dive previews effect ──
  useEffect(() => {
    if (activeTab !== 'inventario' || !isSupabaseEnabled || !authUser) {
      setBioDeepDivePreviewById(new Map())
      return
    }

    let cancelled = false
    void fetchBioDeepDivePreviews()
      .then((rows) => {
        if (cancelled) return
        const next = new Map<string, BioDeepDivePreview>()
        for (const row of rows) {
          next.set(row.entryId, {
            reefCompatible: row.reefCompatible,
            lighting: row.lighting,
            flow: row.flow,
            tempMinC: row.tempMinC,
            tempMaxC: row.tempMaxC,
            sgMin: row.sgMin,
            sgMax: row.sgMax,
            phMin: row.phMin,
            phMax: row.phMax,
            dkhMin: row.dkhMin,
            dkhMax: row.dkhMax,
            aggressionLevel: row.aggressionLevel,
          })
        }
        setBioDeepDivePreviewById(next)
      })
      .catch((error) => {
        if (cancelled) return
        logError('bio-deep-dive-previews', error)
        setBioDeepDivePreviewById(new Map())
      })

    return () => {
      cancelled = true
    }
  }, [activeTab, authUser, bioEntries, syncReloadNonce])

  // ── Cleanup abort controller on unmount ──
  useEffect(() => {
    return () => {
      bioSearchAbortRef.current?.abort()
    }
  }, [])

  // ── Catalog helpers ──
  const findCatalogMatch = useCallback(
    (name: string) => findBestCatalogMatch(name, catalogEntries),
    [catalogEntries],
  )

  // ── Handlers ──
  const handleAddBio = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      if (!bioName.trim()) return
      const catalogMatch = findCatalogMatch(bioName) ?? findInCatalog(bioName)
      const entryId = bioEditingId ?? crypto.randomUUID()
      const existing = bioEntries.find((item) => item.id === entryId)
      const newBioEntry: BioEntry = {
        id: entryId,
        type: catalogMatch?.type ?? bioType,
        name: bioName.trim(),
        scientificName: bioScientificName.trim() || catalogMatch?.scientificName || '',
        position: bioPosition.trim() || catalogMatch?.position || '',
        note: bioNote.trim() || catalogMatch?.note || '',
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      }
      setBioEntries((current) => {
        if (!bioEditingId) return [...current, newBioEntry]
        return current.map((item) => (item.id === bioEditingId ? newBioEntry : item))
      })
      if (isSupabaseEnabled && authUser) {
        enqueueCloudWrite('Organismo do inventário', async () => {
          await upsertCloudBio(
            {
              id: newBioEntry.id,
              type: newBioEntry.type,
              name: newBioEntry.name,
              scientificName: newBioEntry.scientificName,
              position: newBioEntry.position,
              note: newBioEntry.note,
              createdAt: newBioEntry.createdAt,
            },
            authUser.id,
          )
        })
      }
      setBioName('')
      setBioScientificName('')
      setBioPosition('')
      setBioNote('')
      setBioEditingId(null)
    },
    [
      bioName, bioEditingId, bioEntries, bioType, bioScientificName,
      bioPosition, bioNote, authUser, findCatalogMatch, enqueueCloudWrite,
    ],
  )

  const handleDeleteBioEntry = useCallback(
    async (entryId: string) => {
      setBioEntries((current) => current.filter((entry) => entry.id !== entryId))
      if (bioEditingId === entryId) {
        setBioEditingId(null)
        setBioName('')
        setBioScientificName('')
        setBioPosition('')
        setBioNote('')
      }
      if (isSupabaseEnabled && authUser) {
        enqueueCloudWrite('Excluir organismo do inventário', async () => {
          await deleteCloudBio(entryId)
        })
      }
    },
    [bioEditingId, authUser, enqueueCloudWrite],
  )

  const handleStartEditBioEntry = useCallback((entry: BioEntry) => {
    setBioEditingId(entry.id)
    setBioType(entry.type)
    setBioName(entry.name)
    setBioScientificName(entry.scientificName)
    setBioPosition(entry.position)
    setBioNote(entry.note)
  }, [])

  const handleCancelEditBioEntry = useCallback(() => {
    setBioEditingId(null)
    setBioName('')
    setBioScientificName('')
    setBioPosition('')
    setBioNote('')
  }, [])

  const openAnimalDetails = useCallback(
    (entry: BioEntry) => {
      setAnimalDetailsEntry(entry)
      setAnimalDetailsCatalogEntry(null)
      setAnimalRequirement(null)
      const trimmedScientific = entry.scientificName.trim()
      if (!isSupabaseEnabled) {
        setAnimalRequirementState(trimmedScientific ? 'not_found' : 'idle')
        return
      }

      animalRequirementRequestIdRef.current += 1
      const requestId = animalRequirementRequestIdRef.current
      setAnimalRequirementState('loading')

      void fetchBioDeepDiveByEntryId(entry.id)
        .then((data) => {
          if (animalRequirementRequestIdRef.current !== requestId) return
          if (data?.catalog) setAnimalDetailsCatalogEntry(data.catalog)
          if (data?.requirement) {
            setAnimalRequirement(data.requirement)
            setAnimalRequirementState('found')
            return
          }
          if (!trimmedScientific) {
            setAnimalRequirement(null)
            setAnimalRequirementState('idle')
            return
          }
          void fetchBioRequirementByScientificName(trimmedScientific)
            .then((fallback) => {
              if (animalRequirementRequestIdRef.current !== requestId) return
              if (!fallback) {
                setAnimalRequirement(null)
                setAnimalRequirementState('not_found')
                return
              }
              setAnimalRequirement(fallback)
              setAnimalRequirementState('found')
            })
            .catch((error) => {
              if (animalRequirementRequestIdRef.current !== requestId) return
              logError('bio-details-requirements', error)
              setAnimalRequirement(null)
              setAnimalRequirementState('error')
            })
        })
        .catch((error) => {
          if (animalRequirementRequestIdRef.current !== requestId) return
          logError('bio-details-deep-dive', error)
          if (!trimmedScientific) {
            setAnimalRequirement(null)
            setAnimalRequirementState('idle')
            return
          }
          void fetchBioRequirementByScientificName(trimmedScientific)
            .then((fallback) => {
              if (animalRequirementRequestIdRef.current !== requestId) return
              if (!fallback) {
                setAnimalRequirement(null)
                setAnimalRequirementState('not_found')
                return
              }
              setAnimalRequirement(fallback)
              setAnimalRequirementState('found')
            })
            .catch((fallbackError) => {
              if (animalRequirementRequestIdRef.current !== requestId) return
              logError('bio-details-requirements', fallbackError)
              setAnimalRequirement(null)
              setAnimalRequirementState('error')
            })
        })
    },
    [],
  )

  const closeAnimalDetails = useCallback(() => {
    setAnimalDetailsEntry(null)
    setAnimalDetailsCatalogEntry(null)
    setAnimalRequirement(null)
    setAnimalRequirementState('idle')
  }, [])

  const searchExternalBio = async (
    name: string,
    signal?: AbortSignal,
  ): Promise<BioCatalogEntry | null> => {
    const trimmed = name.trim()
    if (!trimmed) return null
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 8000)
    const handleAbort = () => controller.abort()
    if (signal) {
      if (signal.aborted) return null
      signal.addEventListener('abort', handleAbort, { once: true })
    }
    try {
      const gbifResponse = await fetch(
        `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(trimmed)}`,
        { signal: controller.signal },
      )
      if (gbifResponse.ok) {
        const gbifData = await gbifResponse.json()
        if (gbifData?.scientificName) {
          const newEntry: BioCatalogEntry = {
            aliases: [trimmed, gbifData.canonicalName || trimmed],
            type: bioType,
            scientificName: gbifData.scientificName,
            position: '',
            note: 'Adicionado automaticamente por busca externa (GBIF)',
          }
          return newEntry
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return null
      logError('gbif-search', error)
      return null
    } finally {
      window.clearTimeout(timeoutId)
      if (signal) signal.removeEventListener('abort', handleAbort)
    }
    return null
  }

  const fillBioByName = useCallback(async () => {
    const nameSnapshot = bioName.trim()
    if (!nameSnapshot) return
    const localMatch = findCatalogMatch(nameSnapshot)
    if (localMatch) {
      bioSearchAbortRef.current?.abort()
      setIsSearchingBio(false)
      setBioType(localMatch.type)
      if (!bioScientificName.trim()) setBioScientificName(localMatch.scientificName)
      if (!bioPosition.trim()) setBioPosition(localMatch.position)
      if (!bioNote.trim()) setBioNote(localMatch.note)
      return
    }

    bioSearchRequestIdRef.current += 1
    const requestId = bioSearchRequestIdRef.current
    bioSearchAbortRef.current?.abort()
    const controller = new AbortController()
    bioSearchAbortRef.current = controller

    setIsSearchingBio(true)
    const externalMatch = await searchExternalBio(nameSnapshot, controller.signal)
    if (bioSearchRequestIdRef.current !== requestId) return
    setIsSearchingBio(false)
    if (!externalMatch) return
    setCatalogEntries((current) => mergeCatalog(current, [externalMatch]))
    if (isSupabaseEnabled && authUser) {
      enqueueCloudWrite('Catálogo de organismos', async () => {
        await upsertCloudCatalog(externalMatch, authUser.id)
      })
    }
    setBioType(externalMatch.type)
    if (!bioScientificName.trim()) setBioScientificName(externalMatch.scientificName)
    if (!bioPosition.trim()) setBioPosition(externalMatch.position)
    if (!bioNote.trim()) setBioNote(externalMatch.note)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bioName, bioScientificName, bioPosition, bioNote, authUser, findCatalogMatch, enqueueCloudWrite, bioType])

  // ── Derived ──
  const bioNameSuggestions = useMemo(() => {
    const query = normalize(bioName)
    if (query.length < 2) return []
    const seen = new Set<string>()
    const matches: Array<{ label: string; score: number }> = []

    for (const entry of catalogEntries) {
      for (const alias of entry.aliases) {
        const aliasNormalized = normalize(alias)
        const score = scoreTextMatch(query, aliasNormalized)
        if (!score) continue
        if (seen.has(aliasNormalized)) continue
        seen.add(aliasNormalized)
        matches.push({ label: alias, score })
      }
    }

    return matches
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' })
      })
      .slice(0, 12)
      .map((match) => match.label)
  }, [bioName, catalogEntries])

  const faunaItems = useMemo(() => {
    const normalizedSearch = normalize(faunaSearch)
    const filtered = bioEntries
      .filter((item) => item.type === faunaSubmenu)
      .filter((item) =>
        normalizedSearch
          ? `${normalize(item.name)} ${normalize(item.scientificName)}`.includes(normalizedSearch)
          : true,
      )
      .slice()

    if (!normalizedSearch) {
      return filtered.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
    }

    return filtered
      .map((item) => {
        const nameScore = scoreTextMatch(normalizedSearch, normalize(item.name))
        const scientificScore = scoreTextMatch(normalizedSearch, normalize(item.scientificName))
        return { item, score: Math.max(nameScore, scientificScore) }
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return new Date(b.item.createdAt).getTime() - new Date(a.item.createdAt).getTime()
      })
      .map(({ item }) => item)
  }, [bioEntries, faunaSubmenu, faunaSearch])

  const faunaCounts = useMemo(
    () => ({
      todos: bioEntries.length,
      coral: bioEntries.filter((item) => item.type === 'coral').length,
      invertebrado: bioEntries.filter((item) => item.type === 'invertebrado').length,
      peixe: bioEntries.filter((item) => item.type === 'peixe').length,
    }),
    [bioEntries],
  )

  return {
    // Form state
    bioType, setBioType,
    bioName, setBioName,
    bioScientificName, setBioScientificName,
    bioPosition, setBioPosition,
    bioNote, setBioNote,
    bioEditingId,
    // Data
    bioEntries, setBioEntries,
    catalogEntries, setCatalogEntries,
    bioDeepDivePreviewById,
    isSearchingBio,
    // List UI
    faunaSubmenu, setFaunaSubmenu,
    faunaSearch, setFaunaSearch,
    // Requirement preview
    bioRequirementState,
    bioRequirementPreview,
    // Animal details
    animalDetailsEntry,
    animalDetailsCatalogEntry,
    animalRequirementState,
    animalRequirement,
    // Derived
    bioNameSuggestions,
    faunaItems,
    faunaCounts,
    // Handlers
    handleAddBio,
    handleDeleteBioEntry,
    handleStartEditBioEntry,
    handleCancelEditBioEntry,
    openAnimalDetails,
    closeAnimalDetails,
    fillBioByName,
  }
}
