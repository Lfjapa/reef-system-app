import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import './App.css'
import { isSupabaseEnabled } from './lib/supabase'
import {
  deleteCloudBio,
  deleteCloudLightingPhase,
  deleteCloudParameter,
  deleteCloudProtocolCheck,
  deleteCloudProtocolChecksByKey,
  deleteCloudProtocolDefinition,
  deleteCloudProtocolLog,
  deleteCloudProtocolLogsByKey,
  fetchCloudData,
  upsertCloudBio,
  upsertCloudCatalog,
  upsertCloudParameter,
  upsertCloudProtocolCheck,
  upsertCloudProtocolDefinition,
  upsertCloudProtocolLog,
  upsertCloudLightingPhase,
} from './lib/cloudStore'
import { getSession, onAuthStateChange, signInWithGoogle, signOut } from './lib/auth'

type ParameterKey =
  | 'kh'
  | 'calcio'
  | 'magnesio'
  | 'salinidade'
  | 'temperatura'
  | 'ph'
  | 'amonia'
  | 'nitrito'
  | 'nitrato'
  | 'fosfato'
  | 'silicato'
  | 'iodo'

type ParameterEntry = {
  id: string
  parameter: ParameterKey
  value: number
  measuredAt: string
  note: string
}

type ParameterDefinition = {
  key: ParameterKey
  label: string
  unit: string
  min?: number
  max?: number
}

type BioType = 'peixe' | 'coral' | 'invertebrado'

type BioEntry = {
  id: string
  type: BioType
  name: string
  scientificName: string
  position: string
  note: string
  createdAt: string
}

type BioCatalogEntry = {
  aliases: string[]
  type: BioType
  scientificName: string
  position: string
  note: string
}

type SyncState = 'local' | 'syncing' | 'online' | 'error'
type FaunaSubmenu = BioType | 'todos'
type ProtocolKey = string

type UiSettings = {
  title: string
  subtitle: string
  subtitleEnabled: boolean
}

type ProtocolDefinition = {
  key: ProtocolKey
  label: string
  days: number[]
  quantity: number | null
  unit: string
}

type ProtocolLog = {
  id: string
  protocolKey: ProtocolKey
  performedAt: string
  note: string
}

type ProtocolCheck = {
  id: string
  protocolKey: ProtocolKey
  weekStart: string
  dayIndex: number
  checkedAt: string
  quantity: number | null
  unit: string
  note: string
}

type LightingPhase = {
  id: string
  name: string
  time: string
  uv: number
  white: number
  blue: number
}

const parameterDefinitions: ParameterDefinition[] = [
  { key: 'kh', label: 'KH', unit: 'dKH', min: 7, max: 9 },
  { key: 'calcio', label: 'Cálcio', unit: 'ppm', min: 420, max: 470 },
  { key: 'magnesio', label: 'Magnésio', unit: 'ppm', min: 1250, max: 1400 },
  { key: 'salinidade', label: 'Salinidade', unit: 'sg', min: 1.024, max: 1.026 },
  { key: 'temperatura', label: 'Temperatura', unit: '°C', min: 24, max: 26 },
  { key: 'ph', label: 'pH', unit: '', min: 7.9, max: 8.4 },
  { key: 'amonia', label: 'Amônia', unit: 'ppm', min: 0, max: 0.1 },
  { key: 'nitrito', label: 'Nitrito', unit: 'ppm', min: 0, max: 0.1 },
  { key: 'nitrato', label: 'Nitrato', unit: 'ppm', min: 2, max: 20 },
  { key: 'fosfato', label: 'Fosfato', unit: 'ppm', min: 0.01, max: 0.1 },
  { key: 'silicato', label: 'Silicato', unit: 'ppm', min: 0, max: 0.5 },
  { key: 'iodo', label: 'Iodo/Estrôncio/Potássio', unit: 'ppm' },
]

const parameterColors: Record<ParameterKey, string> = {
  kh: '#38bdf8',
  calcio: '#22d3ee',
  magnesio: '#14b8a6',
  salinidade: '#10b981',
  temperatura: '#f59e0b',
  ph: '#ef4444',
  amonia: '#e879f9',
  nitrito: '#f97316',
  nitrato: '#84cc16',
  fosfato: '#a78bfa',
  silicato: '#fb7185',
  iodo: '#facc15',
}

const seedBioCatalog: BioCatalogEntry[] = [
  {
    aliases: ['camarão bailarino', 'camarao bailarino', 'sexy shrimp'],
    type: 'invertebrado',
    scientificName: 'Thor amboinensis',
    position: 'base e rochas com anêmonas/corais',
    note: 'Invertebrado limpador; observar muda e comportamento',
  },
  {
    aliases: ['palhaço ocellaris', 'palhaco ocellaris', 'ocellaris'],
    type: 'peixe',
    scientificName: 'Amphiprion ocellaris',
    position: 'médio',
    note: 'Peixe territorial leve, bom para recife',
  },
  {
    aliases: ['diamond goby', 'goby diamond', 'goby'],
    type: 'peixe',
    scientificName: 'Valenciennea puellaris',
    position: 'fundo',
    note: 'Revira substrato; precisa de areia estável',
  },
  {
    aliases: ['torch coral', 'euphyllia glabrescens', 'torch'],
    type: 'coral',
    scientificName: 'Euphyllia glabrescens',
    position: 'meio',
    note: 'Luz média e fluxo moderado',
  },
  {
    aliases: ['mushroom coral', 'discosoma', 'mushroom'],
    type: 'coral',
    scientificName: 'Discosoma spp.',
    position: 'fundo',
    note: 'Coral resistente; prefere luz baixa a média',
  },
  {
    aliases: ['peixe-palhaço', 'peixe palhaco', 'ocellaris', 'percula'],
    type: 'peixe',
    scientificName: 'Amphiprion ocellaris / Amphiprion percula',
    position: 'meio / fundo',
    note: 'Pacífico, onívoro, clássico de recife',
  },
  {
    aliases: ['firefish', 'nemateleotris magnifica', 'nemateleotris decora'],
    type: 'peixe',
    scientificName: 'Nemateleotris magnifica / Nemateleotris decora',
    position: 'meio',
    note: 'Tímido e saltador; usar tampa',
  },
  {
    aliases: ['royal gramma', 'gramma loreto', 'blackcap basslet'],
    type: 'peixe',
    scientificName: 'Gramma loreto / Gramma melacara',
    position: 'fundo / cavernas',
    note: 'Pacífico, territorial com a toca',
  },
  {
    aliases: ['pseudochromis', 'dottyback', 'pictichromis'],
    type: 'peixe',
    scientificName: 'Pictichromis spp.',
    position: 'meio / fundo',
    note: 'Semi-agressivo, pode atacar camarões pequenos',
  },
  {
    aliases: ['cardinal banggai', 'banggai', 'pterapogon kauderni'],
    type: 'peixe',
    scientificName: 'Pterapogon kauderni',
    position: 'meio',
    note: 'Pacífico, ideal em casal',
  },
  {
    aliases: ['grammistes', 'peixe-sabão', 'peixe sabao', 'grammistes sexlineatus'],
    type: 'peixe',
    scientificName: 'Grammistes sexlineatus',
    position: 'fundo / cavernas',
    note: 'Predador; atenção à toxina em estresse severo',
  },
  {
    aliases: ['blue tang', 'dory', 'paracanthurus hepatus'],
    type: 'peixe',
    scientificName: 'Paracanthurus hepatus',
    position: 'todas as áreas',
    note: 'Cresce muito; exige aquário grande',
  },
  {
    aliases: ['yellow tang', 'purple tang', 'sailfin tang', 'zebrasoma'],
    type: 'peixe',
    scientificName: 'Zebrasoma spp.',
    position: 'todas as áreas',
    note: 'Herbívoro; semi-agressivo com outros tangs',
  },
  {
    aliases: ['kole tang', 'tomini tang', 'ctenochaetus'],
    type: 'peixe',
    scientificName: 'Ctenochaetus spp.',
    position: 'meio / fundo',
    note: 'Excelente controle de algas finas',
  },
  {
    aliases: ['watchman goby', 'yellow watchman', 'cryptocentrus'],
    type: 'peixe',
    scientificName: 'Cryptocentrus spp.',
    position: 'fundo',
    note: 'Pode fazer simbiose com camarão pistola',
  },
  {
    aliases: ['blenny', 'lawn mower', 'tailspot', 'ecsenius', 'salarias'],
    type: 'peixe',
    scientificName: 'Ecsenius spp. / Salarias fasciatus',
    position: 'fundo / rochas',
    note: 'Personalidade forte; ótimo para controle de algas',
  },
  {
    aliases: ['wrasse', 'six line', 'melanurus', 'fairy wrasse', 'flasher wrasse'],
    type: 'peixe',
    scientificName: 'Pseudocheilinus / Halichoeres / Cirrhilabrus',
    position: 'meio / topo',
    note: 'Pode pular; recomendado aquário tampado',
  },
  {
    aliases: ['foxface', 'siganus vulpinus'],
    type: 'peixe',
    scientificName: 'Siganus vulpinus',
    position: 'meio',
    note: 'Herbívoro, espinhos venenosos',
  },
  {
    aliases: ['mandarim', 'synchiropus splendidus', 'mandarin'],
    type: 'peixe',
    scientificName: 'Synchiropus splendidus',
    position: 'fundo',
    note: 'Difícil, depende de microfauna abundante',
  },
  {
    aliases: ['anthias', 'lyretail', 'pseudanthias squamipinnis'],
    type: 'peixe',
    scientificName: 'Pseudanthias squamipinnis',
    position: 'topo / meio',
    note: 'Peixe de cardume com alimentação frequente',
  },
  {
    aliases: ['camarão cleaner', 'camarao cleaner', 'lysmata amboinensis'],
    type: 'invertebrado',
    scientificName: 'Lysmata amboinensis',
    position: 'rochas',
    note: 'Limpador de peixes; pacífico',
  },
  {
    aliases: ['blood red shrimp', 'lysmata debelius', 'camarão blood'],
    type: 'invertebrado',
    scientificName: 'Lysmata debelius',
    position: 'rochas / cavernas',
    note: 'Mais tímido, principalmente noturno',
  },
  {
    aliases: ['peppermint shrimp', 'camarão peppermint', 'lysmata wurdemanni'],
    type: 'invertebrado',
    scientificName: 'Lysmata wurdemanni',
    position: 'rochas',
    note: 'Ajuda no controle de aiptasia',
  },
  {
    aliases: ['camarão boxer', 'coral banded shrimp', 'stenopus hispidus'],
    type: 'invertebrado',
    scientificName: 'Stenopus hispidus',
    position: 'cavernas',
    note: 'Territorial; pode atacar camarões menores',
  },
  {
    aliases: ['camarão pistola', 'alpheus'],
    type: 'invertebrado',
    scientificName: 'Alpheus spp.',
    position: 'substrato / tocas',
    note: 'Simbiose clássica com gobies watchman',
  },
  {
    aliases: ['caranguejo esmeralda', 'mithraculus sculptus', 'emerald crab'],
    type: 'invertebrado',
    scientificName: 'Mithraculus sculptus',
    position: 'rochas',
    note: 'Controle de valônia; monitorar comportamento',
  },
  {
    aliases: ['ermitão azul', 'ermitão vermelho', 'calcinus', 'paguristes'],
    type: 'invertebrado',
    scientificName: 'Calcinus elegans / Paguristes cadenati',
    position: 'substrato / rochas',
    note: 'Equipe de limpeza, pode disputar conchas',
  },
  {
    aliases: ['turbo snail', 'trochus', 'astrea', 'astraea', 'snail turbo'],
    type: 'invertebrado',
    scientificName: 'Turbo spp. / Trochus spp. / Astraea spp.',
    position: 'vidros / rochas',
    note: 'Excelente equipe de limpeza de algas',
  },
]

const defaultProtocolDefinitions: ProtocolDefinition[] = [
  { key: 'dose_ab_plus', label: 'Dosar AB+', days: [1, 3, 6], quantity: null, unit: 'ml' },
  {
    key: 'dose_caledonia',
    label: 'Dosar Caledonia Mineral Blend',
    days: [2, 5],
    quantity: null,
    unit: 'ml',
  },
  {
    key: 'dose_reef_energy_plus',
    label: 'Dosar Red Sea Reef Energy Plus',
    days: [1, 3, 6],
    quantity: null,
    unit: 'ml',
  },
  { key: 'test_kh', label: 'Testar KH', days: [6], quantity: null, unit: '' },
  { key: 'add_bacteria', label: 'Adicionar biologia/bactérias', days: [6], quantity: null, unit: '' },
  { key: 'tpa', label: 'TPA (troca parcial de água)', days: [6], quantity: null, unit: '%' },
]

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const findInCatalog = (name: string) => {
  const normalized = normalize(name)
  return seedBioCatalog.find((entry) =>
    entry.aliases.some((alias) => normalized.includes(normalize(alias))),
  )
}

const mergeCatalog = (base: BioCatalogEntry[], extras: BioCatalogEntry[]) => {
  const merged = [...base]
  for (const entry of extras) {
    const exists = merged.some((current) =>
      current.aliases.some((alias) =>
        entry.aliases.some((newAlias) => normalize(newAlias) === normalize(alias)),
      ),
    )
    if (!exists) merged.push(entry)
  }
  return merged
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))

const startOfWeekMonday = (date: Date) => {
  const result = new Date(date)
  const mondayBasedDay = (result.getDay() + 6) % 7
  result.setDate(result.getDate() - mondayBasedDay)
  result.setHours(0, 0, 0, 0)
  return result
}

const dayLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const toDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const fromDateKey = (key: string) => {
  const [year, month, day] = key.split('-').map((part) => Number(part))
  return new Date(year, month - 1, day)
}

const formatDays = (days: number[]) => {
  const labels = days
    .slice()
    .sort((a, b) => a - b)
    .map((day) => dayLabels[(day + 6) % 7])
  return labels.join(', ')
}

const buildProtocolKey = (label: string) => {
  const base = normalize(label).replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  const suffix = crypto.randomUUID().slice(0, 8)
  return `${base || 'rotina'}_${suffix}`
}

const timeToMinutes = (time: string) => {
  const [h, m] = time.split(':').map((part) => Number(part))
  return h * 60 + m
}

const normalizeTime = (value: string) => (value.length >= 5 ? value.slice(0, 5) : value)

const DEFAULT_LIGHTING_PHASES: LightingPhase[] = [
  {
    id: '7f0e2d9b-3b1e-4d8c-9f5b-0d2d2a1a0001',
    name: 'Amanhecer',
    time: '08:30',
    uv: 60,
    white: 0,
    blue: 120,
  },
  {
    id: '7f0e2d9b-3b1e-4d8c-9f5b-0d2d2a1a0002',
    name: 'Subida',
    time: '10:30',
    uv: 150,
    white: 40,
    blue: 160,
  },
  {
    id: '7f0e2d9b-3b1e-4d8c-9f5b-0d2d2a1a0003',
    name: 'Pico (Suave)',
    time: '12:30',
    uv: 200,
    white: 130,
    blue: 120,
  },
  {
    id: '7f0e2d9b-3b1e-4d8c-9f5b-0d2d2a1a0004',
    name: 'Manutenção',
    time: '15:30',
    uv: 180,
    white: 80,
    blue: 150,
  },
  {
    id: '7f0e2d9b-3b1e-4d8c-9f5b-0d2d2a1a0005',
    name: 'Sunset (Neon)',
    time: '17:30',
    uv: 220,
    white: 10,
    blue: 200,
  },
  {
    id: '7f0e2d9b-3b1e-4d8c-9f5b-0d2d2a1a0006',
    name: 'Moonlight',
    time: '19:00',
    uv: 100,
    white: 0,
    blue: 80,
  },
  {
    id: '7f0e2d9b-3b1e-4d8c-9f5b-0d2d2a1a0007',
    name: 'Desligar',
    time: '19:30',
    uv: 0,
    white: 0,
    blue: 0,
  },
]

const DEFAULT_LIGHTING_BY_TIME = new Map(DEFAULT_LIGHTING_PHASES.map((phase) => [phase.time, phase]))

const defaultLightingPhases = (): LightingPhase[] =>
  DEFAULT_LIGHTING_PHASES.map((phase) => ({ ...phase }))

const normalizeLightingFromCloud = (phases: LightingPhase[]) => {
  const initialIds = phases.map((phase) => phase.id)
  const seenTimes = new Set<string>()
  const normalized: LightingPhase[] = []

  for (const phase of [...phases].sort(
    (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time),
  )) {
    const time = normalizeTime(String(phase.time))
    if (seenTimes.has(time)) continue
    seenTimes.add(time)

    const canonical = DEFAULT_LIGHTING_BY_TIME.get(time)
    if (canonical) {
      normalized.push({
        ...phase,
        id: canonical.id,
        name: phase.name || canonical.name,
        time,
      })
    } else {
      normalized.push({ ...phase, time })
    }
  }

  const normalizedIdSet = new Set(normalized.map((phase) => phase.id))
  const idsToDelete = initialIds.filter((id) => !normalizedIdSet.has(id))
  const needsWriteBack = idsToDelete.length > 0 || normalized.some((p) => !initialIds.includes(p.id))

  return { normalized, idsToDelete, needsWriteBack }
}

const getStatus = (value: number, min?: number, max?: number) => {
  if (min === undefined || max === undefined) return 'Sem faixa'
  if (value < min) return 'Baixo'
  if (value > max) return 'Alto'
  return 'Ideal'
}

const getTrend = (entries: ParameterEntry[]) => {
  if (entries.length < 2) return 'Estável'
  const sorted = [...entries].sort(
    (a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime(),
  )
  const last = sorted[sorted.length - 1].value
  const previous = sorted[sorted.length - 2].value
  if (last > previous) return 'Subindo'
  if (last < previous) return 'Descendo'
  return 'Estável'
}

const buildMultiPath = (
  values: ParameterEntry[],
  minTimestamp: number,
  maxTimestamp: number,
  minValue: number,
  maxValue: number,
) => {
  if (values.length < 2) return ''
  const width = 320
  const height = 120
  const timestampRange = maxTimestamp - minTimestamp || 1
  const valueRange = maxValue - minValue || 1
  const points = values.map((entry) => {
    const x =
      ((new Date(entry.measuredAt).getTime() - minTimestamp) / timestampRange) * width
    const y = height - ((entry.value - minValue) / valueRange) * height
    return `${x},${y}`
  })
  return `M ${points.join(' L ')}`
}

const buildMultiPoints = (
  values: ParameterEntry[],
  minTimestamp: number,
  maxTimestamp: number,
  minValue: number,
  maxValue: number,
) => {
  const width = 320
  const height = 120
  const timestampRange = maxTimestamp - minTimestamp || 1
  const valueRange = maxValue - minValue || 1
  return values.map((entry) => {
    const x =
      ((new Date(entry.measuredAt).getTime() - minTimestamp) / timestampRange) * width
    const y = height - ((entry.value - minValue) / valueRange) * height
    return { x, y }
  })
}

const normalizeParameterValue = (parameter: ParameterKey, rawValue: number) => {
  if (parameter !== 'salinidade') return rawValue
  if (rawValue >= 1000 && rawValue <= 1100) return rawValue / 1000
  return rawValue
}

const sanitizeParameterEntries = (items: ParameterEntry[]) =>
  items.map((entry) => ({
    ...entry,
    value: normalizeParameterValue(entry.parameter, entry.value),
  }))

const parseOptionalNumber = (raw: string) => {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

const parseNumberWithFallback = (raw: string, fallback: number) => {
  const value = Number(raw)
  return Number.isFinite(value) ? value : fallback
}

const safeJsonParseArray = <T,>(raw: string | null, fallback: T[]) => {
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as T[]) : fallback
  } catch {
    return fallback
  }
}

const NOW_AT_BOOT = Date.now()
const DEFAULT_UI_SETTINGS: UiSettings = {
  title: 'Monitoramento do aquario',
  subtitle: 'Controle diário do aquário no PC e no celular',
  subtitleEnabled: true,
}

function App() {
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'parametros' | 'protocolos' | 'iluminacao' | 'inventario'
  >('dashboard')
  const [parameter, setParameter] = useState<ParameterKey>('kh')
  const [value, setValue] = useState<string>('')
  const [note, setNote] = useState<string>('')
  const [filterParameter, setFilterParameter] = useState<'todos' | ParameterKey>('todos')
  const [periodDays, setPeriodDays] = useState<7 | 30 | 90 | 365>(30)
  const [dashboardPeriodDays, setDashboardPeriodDays] = useState<7 | 30 | 90 | 365>(30)
  const [entries, setEntries] = useState<ParameterEntry[]>([])
  const [bioType, setBioType] = useState<BioType>('peixe')
  const [bioName, setBioName] = useState<string>('')
  const [bioScientificName, setBioScientificName] = useState<string>('')
  const [bioPosition, setBioPosition] = useState<string>('')
  const [bioNote, setBioNote] = useState<string>('')
  const [bioEditingId, setBioEditingId] = useState<string | null>(null)
  const [bioEntries, setBioEntries] = useState<BioEntry[]>([])
  const [faunaSubmenu, setFaunaSubmenu] = useState<FaunaSubmenu>('todos')
  const [faunaSearch, setFaunaSearch] = useState<string>('')
  const [catalogEntries, setCatalogEntries] = useState<BioCatalogEntry[]>(seedBioCatalog)
  const [isSearchingBio, setIsSearchingBio] = useState<boolean>(false)
  const [protocolDefinitions, setProtocolDefinitions] = useState<ProtocolDefinition[]>(
    defaultProtocolDefinitions,
  )
  const [protocolChecks, setProtocolChecks] = useState<ProtocolCheck[]>([])
  const [protocolLogs, setProtocolLogs] = useState<ProtocolLog[]>([])
  const [protocolNote, setProtocolNote] = useState<string>('')
  const [protocolEditingKey, setProtocolEditingKey] = useState<ProtocolKey | null>(null)
  const [protocolEditLabel, setProtocolEditLabel] = useState<string>('')
  const [protocolEditDays, setProtocolEditDays] = useState<number[]>([])
  const [protocolEditQuantity, setProtocolEditQuantity] = useState<string>('')
  const [protocolEditUnit, setProtocolEditUnit] = useState<string>('')
  const [protocolAddLabel, setProtocolAddLabel] = useState<string>('')
  const [protocolAddDays, setProtocolAddDays] = useState<number[]>([])
  const [protocolAddQuantity, setProtocolAddQuantity] = useState<string>('')
  const [protocolAddUnit, setProtocolAddUnit] = useState<string>('ml')
  const [isProtocolModalOpen, setIsProtocolModalOpen] = useState<boolean>(false)
  const [protocolModalMode, setProtocolModalMode] = useState<'add' | 'edit'>('add')
  const [lightingPhases, setLightingPhases] = useState<LightingPhase[]>([])
  const [isLightingModalOpen, setIsLightingModalOpen] = useState<boolean>(false)
  const [lightingEditingId, setLightingEditingId] = useState<string | null>(null)
  const [lightingEditName, setLightingEditName] = useState<string>('')
  const [lightingEditTime, setLightingEditTime] = useState<string>('08:30')
  const [lightingEditUv, setLightingEditUv] = useState<string>('0')
  const [lightingEditWhite, setLightingEditWhite] = useState<string>('0')
  const [lightingEditBlue, setLightingEditBlue] = useState<string>('0')
  const [syncState, setSyncState] = useState<SyncState>(
    isSupabaseEnabled ? 'syncing' : 'local',
  )
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(isSupabaseEnabled)
  const [nowMs, setNowMs] = useState<number>(NOW_AT_BOOT)
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState<boolean>(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false)
  const [uiSettings, setUiSettings] = useState<UiSettings>(DEFAULT_UI_SETTINGS)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)

  const entriesStorageKey = isSupabaseEnabled
    ? authUser
      ? `reef-system-entries:${authUser.id}`
      : null
    : 'reef-system-entries'
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
  const protocolLogsStorageKey = isSupabaseEnabled
    ? authUser
      ? `reef-system-protocol-logs:${authUser.id}`
      : null
    : 'reef-system-protocol-logs'
  const protocolDefinitionsStorageKey = isSupabaseEnabled
    ? authUser
      ? `reef-system-protocol-definitions:${authUser.id}`
      : null
    : 'reef-system-protocol-definitions'
  const protocolChecksStorageKey = isSupabaseEnabled
    ? authUser
      ? `reef-system-protocol-checks:${authUser.id}`
      : null
    : 'reef-system-protocol-checks'
  const lightingPhasesStorageKey = isSupabaseEnabled
    ? authUser
      ? `reef-system-lighting-phases:${authUser.id}`
      : null
    : 'reef-system-lighting-phases'
  const uiSettingsStorageKey = isSupabaseEnabled
    ? authUser
      ? `reef-system-ui-settings:${authUser.id}`
      : null
    : 'reef-system-ui-settings'
  const profileAvatarStorageKey = isSupabaseEnabled
    ? authUser
      ? `reef-system-profile-avatar:${authUser.id}`
      : null
    : 'reef-system-profile-avatar'

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle()
    } catch {
      setSyncState('error')
    }
  }

  const handleLogout = async () => {
    try {
      await signOut()
      setSyncState('local')
    } catch {
      setSyncState('error')
    }
  }

  const handleOpenSettings = () => {
    setIsSettingsOpen(true)
    setIsProfileMenuOpen(false)
  }

  const handleCloseSettings = () => {
    setIsSettingsOpen(false)
  }

  const handleRequestAvatarChange = () => {
    avatarInputRef.current?.click()
  }

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const next = typeof reader.result === 'string' ? reader.result : null
      if (!next) return
      setProfileAvatarUrl(next)
      if (profileAvatarStorageKey) localStorage.setItem(profileAvatarStorageKey, next)
      setIsProfileMenuOpen(false)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveAvatar = () => {
    setProfileAvatarUrl(null)
    if (profileAvatarStorageKey) localStorage.removeItem(profileAvatarStorageKey)
    setIsProfileMenuOpen(false)
  }

  const handleSaveUiSettings = (next: UiSettings) => {
    setUiSettings(next)
    if (uiSettingsStorageKey) localStorage.setItem(uiSettingsStorageKey, JSON.stringify(next))
    setIsSettingsOpen(false)
  }

  useEffect(() => {
    if (!isSupabaseEnabled) return
    let alive = true
    setIsAuthLoading(true)
    void (async () => {
      try {
        const session = await getSession()
        if (!alive) return
        setAuthUser(session?.user ?? null)
      } catch {
        if (!alive) return
        setAuthUser(null)
      } finally {
        if (!alive) return
        setIsAuthLoading(false)
      }
    })()
    const unsubscribe = onAuthStateChange((session) => {
      setAuthUser(session?.user ?? null)
      setIsAuthLoading(false)
    })
    return () => {
      alive = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    setIsProfileMenuOpen(false)
  }, [authUser?.id])

  useEffect(() => {
    if (!profileAvatarStorageKey) {
      setProfileAvatarUrl(null)
      return
    }
    const cached = localStorage.getItem(profileAvatarStorageKey)
    setProfileAvatarUrl(cached || null)
  }, [profileAvatarStorageKey])

  useEffect(() => {
    if (!uiSettingsStorageKey) {
      setUiSettings(DEFAULT_UI_SETTINGS)
      return
    }
    const raw = localStorage.getItem(uiSettingsStorageKey)
    if (!raw) {
      setUiSettings(DEFAULT_UI_SETTINGS)
      return
    }
    try {
      const parsed = JSON.parse(raw) as Partial<UiSettings>
      const rawTitle = typeof parsed.title === 'string' ? parsed.title : null
      let title = rawTitle ?? DEFAULT_UI_SETTINGS.title
      const subtitle =
        typeof parsed.subtitle === 'string' ? parsed.subtitle : DEFAULT_UI_SETTINGS.subtitle
      const subtitleEnabled =
        typeof parsed.subtitleEnabled === 'boolean'
          ? parsed.subtitleEnabled
          : DEFAULT_UI_SETTINGS.subtitleEnabled
      if (rawTitle === 'Reef System 300L') {
        title = DEFAULT_UI_SETTINGS.title
        localStorage.setItem(
          uiSettingsStorageKey,
          JSON.stringify({ title, subtitle, subtitleEnabled }),
        )
      }
      setUiSettings({ title, subtitle, subtitleEnabled })
    } catch {
      setUiSettings(DEFAULT_UI_SETTINGS)
    }
  }, [uiSettingsStorageKey])

  const SettingsModal = () => {
    const [draftTitle, setDraftTitle] = useState<string>(uiSettings.title)
    const [draftSubtitle, setDraftSubtitle] = useState<string>(uiSettings.subtitle)
    const [draftSubtitleEnabled, setDraftSubtitleEnabled] = useState<boolean>(
      uiSettings.subtitleEnabled,
    )

    useEffect(() => {
      if (!isSettingsOpen) return
      setDraftTitle(uiSettings.title)
      setDraftSubtitle(uiSettings.subtitle)
      setDraftSubtitleEnabled(uiSettings.subtitleEnabled)
    }, [isSettingsOpen, uiSettings.title, uiSettings.subtitle, uiSettings.subtitleEnabled])

    if (!isSettingsOpen) return null

    return (
      <div className="modal-backdrop" role="dialog" aria-modal="true">
        <div className="modal">
          <div className="modal-head">
            <h3>Configurações</h3>
            <button type="button" className="secondary-btn" onClick={handleCloseSettings}>
              Fechar
            </button>
          </div>

          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault()
              const next: UiSettings = {
                title: draftTitle.trim() || DEFAULT_UI_SETTINGS.title,
                subtitle: draftSubtitle.trim(),
                subtitleEnabled: draftSubtitleEnabled && draftSubtitle.trim().length > 0,
              }
              handleSaveUiSettings(next)
            }}
          >
            <label>
              Título
              <input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} />
            </label>

            <label>
              <span>Mostrar subtítulo</span>
              <input
                type="checkbox"
                checked={draftSubtitleEnabled}
                onChange={(e) => setDraftSubtitleEnabled(e.target.checked)}
              />
            </label>

            <label>
              Subtítulo
              <input
                value={draftSubtitle}
                onChange={(e) => setDraftSubtitle(e.target.value)}
                disabled={!draftSubtitleEnabled}
              />
            </label>

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={handleCloseSettings}>
                Cancelar
              </button>
              <button type="submit">Salvar</button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  const Header = ({
    mode,
    message,
  }: {
    mode: 'loading' | 'login' | 'main'
    message?: string
  }) => {
    const initial = (authUser?.email?.trim()?.[0] ?? 'U').toUpperCase()
    const showSubtitle = mode === 'main' && uiSettings.subtitleEnabled
    return (
      <header className="header">
        <div className="header-top">
          <div className="brand">
            <h1>{uiSettings.title}</h1>
            {showSubtitle && <p className="header-subtitle">{uiSettings.subtitle}</p>}
            {message && <p className="header-message">{message}</p>}
          </div>

          {isSupabaseEnabled && authUser && mode === 'main' && (
            <div className="profile">
              <button
                type="button"
                className="profile-btn"
                onClick={() => setIsProfileMenuOpen((current) => !current)}
                aria-haspopup="menu"
                aria-expanded={isProfileMenuOpen}
              >
                {profileAvatarUrl ? (
                  <img className="profile-avatar" src={profileAvatarUrl} alt="Foto do perfil" />
                ) : (
                  <span className="profile-avatar-fallback">{initial}</span>
                )}
              </button>

              {isProfileMenuOpen && (
                <div className="profile-menu" role="menu">
                  <div className="profile-menu-meta">{authUser.email ?? ''}</div>
                  <button type="button" className="secondary-btn" onClick={handleRequestAvatarChange}>
                    Trocar foto
                  </button>
                  <button type="button" className="secondary-btn" onClick={handleOpenSettings}>
                    Configurações
                  </button>
                  <button type="button" className="secondary-btn" onClick={handleRemoveAvatar}>
                    Remover foto
                  </button>
                  <button type="button" className="danger-btn" onClick={handleLogout}>
                    Sair
                  </button>
                </div>
              )}

              <input
                ref={avatarInputRef}
                hidden
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
              />
            </div>
          )}
        </div>

        {syncState !== 'local' && (
          <span className={`sync-badge ${syncState}`}>
            {syncState === 'online' && 'Sincronização online'}
            {syncState === 'syncing' && 'Sincronizando...'}
            {syncState === 'error' && 'Falha na sincronização'}
          </span>
        )}
      </header>
    )
  }

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 60000)
    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    const loadData = async () => {
      const localSeed: ParameterEntry[] = [
        {
          id: crypto.randomUUID(),
          parameter: 'kh',
          value: 7,
          measuredAt: new Date(Date.now() - 86400000 * 4).toISOString(),
          note: 'Valor inicial do sistema',
        },
        {
          id: crypto.randomUUID(),
          parameter: 'calcio',
          value: 448,
          measuredAt: new Date(Date.now() - 86400000 * 4).toISOString(),
          note: 'Valor inicial do sistema',
        },
        {
          id: crypto.randomUUID(),
          parameter: 'salinidade',
          value: 1.025,
          measuredAt: new Date(Date.now() - 86400000).toISOString(),
          note: 'Medição de referência',
        },
      ]
      if (isSupabaseEnabled && isAuthLoading) {
        setSyncState('syncing')
        return
      }

      if (isSupabaseEnabled && !authUser) {
        setEntries([])
        setBioEntries([])
        setCatalogEntries(seedBioCatalog)
        setProtocolDefinitions(defaultProtocolDefinitions)
        setProtocolChecks([])
        setProtocolLogs([])
        setLightingPhases(defaultLightingPhases())
        setSyncState('local')
        return
      }

      const localEntriesCache = entriesStorageKey ? localStorage.getItem(entriesStorageKey) : null
      const localBioCache = bioEntriesStorageKey ? localStorage.getItem(bioEntriesStorageKey) : null
      const localCatalogCache = catalogStorageKey ? localStorage.getItem(catalogStorageKey) : null
      const localProtocolCache = protocolLogsStorageKey
        ? localStorage.getItem(protocolLogsStorageKey)
        : null
      const localProtocolDefCache = protocolDefinitionsStorageKey
        ? localStorage.getItem(protocolDefinitionsStorageKey)
        : null
      const localProtocolCheckCache = protocolChecksStorageKey
        ? localStorage.getItem(protocolChecksStorageKey)
        : null
      const localLightingCache = lightingPhasesStorageKey
        ? localStorage.getItem(lightingPhasesStorageKey)
        : null
      const localEntries = sanitizeParameterEntries(
        safeJsonParseArray<ParameterEntry>(localEntriesCache, localSeed),
      )
      const localBio = safeJsonParseArray<BioEntry>(localBioCache, [])
      const localCatalog = safeJsonParseArray<BioCatalogEntry>(localCatalogCache, [])
      const localProtocolLogs = safeJsonParseArray<ProtocolLog>(localProtocolCache, [])
      const localProtocolDefinitionsRaw = safeJsonParseArray<ProtocolDefinition>(
        localProtocolDefCache,
        [],
      )
      const localProtocolDefinitions =
        localProtocolDefinitionsRaw.length > 0
          ? localProtocolDefinitionsRaw
          : defaultProtocolDefinitions
      const localProtocolChecks = safeJsonParseArray<ProtocolCheck>(localProtocolCheckCache, [])
      const defaultLighting = defaultLightingPhases()
      const localLightingRaw = safeJsonParseArray<LightingPhase>(localLightingCache, [])
      const localLighting: LightingPhase[] =
        localLightingRaw.length > 0
          ? localLightingRaw.map((item) => ({
              ...item,
              time: normalizeTime(String(item.time)),
              uv: parseNumberWithFallback(String(item.uv ?? 0), 0),
              white: parseNumberWithFallback(String(item.white ?? 0), 0),
              blue: parseNumberWithFallback(String(item.blue ?? 0), 0),
            }))
          : defaultLighting

      if (!isSupabaseEnabled) {
        setEntries(localEntries)
        setBioEntries(localBio)
        setCatalogEntries(mergeCatalog(seedBioCatalog, localCatalog))
        setProtocolDefinitions(localProtocolDefinitions)
        setProtocolChecks(localProtocolChecks)
        setProtocolLogs(localProtocolLogs)
        setLightingPhases(localLighting)
        setSyncState('local')
        return
      }

      const userId = authUser?.id
      if (!userId) {
        setSyncState('error')
        return
      }

      try {
        setSyncState('syncing')
        const cloudData = await fetchCloudData()
        const cloudIsEmpty =
          cloudData.parameters.length === 0 &&
          cloudData.bio.length === 0 &&
          cloudData.catalog.length === 0 &&
          cloudData.protocolLogs.length === 0 &&
          cloudData.protocolDefinitions.length === 0 &&
          cloudData.protocolChecks.length === 0 &&
          cloudData.lightingPhases.length === 0

        const hasLocalCache = Boolean(
          localEntriesCache ||
            localBioCache ||
            localCatalogCache ||
            localProtocolCache ||
            localProtocolDefCache ||
            localProtocolCheckCache ||
            localLightingCache,
        )

        if (cloudIsEmpty && hasLocalCache) {
          await Promise.all([
            ...localEntries.map((item) =>
              upsertCloudParameter({
                id: item.id,
                parameter: item.parameter,
                value: item.value,
                measuredAt: item.measuredAt,
                note: item.note,
              }, userId),
            ),
            ...localBio.map((item) =>
              upsertCloudBio({
                id: item.id,
                type: item.type,
                name: item.name,
                scientificName: item.scientificName,
                position: item.position,
                note: item.note,
                createdAt: item.createdAt,
              }, userId),
            ),
            ...localCatalog.map((item) =>
              upsertCloudCatalog({
                aliases: item.aliases,
                type: item.type,
                scientificName: item.scientificName,
                position: item.position,
                note: item.note,
              }, userId),
            ),
            ...localProtocolLogs.map((item) =>
              upsertCloudProtocolLog({
                id: item.id,
                protocolKey: item.protocolKey,
                performedAt: item.performedAt,
                note: item.note,
              }, userId),
            ),
            ...localProtocolDefinitions.map((item) =>
              upsertCloudProtocolDefinition({
                protocolKey: item.key,
                label: item.label,
                days: item.days,
                quantity: item.quantity,
                unit: item.unit,
              }, userId),
            ),
            ...localProtocolChecks.map((item) =>
              upsertCloudProtocolCheck({
                id: item.id,
                protocolKey: item.protocolKey,
                weekStart: item.weekStart,
                dayIndex: item.dayIndex,
                checkedAt: item.checkedAt,
                quantity: item.quantity,
                unit: item.unit,
                note: item.note,
              }, userId),
            ),
            ...localLighting.map((item) =>
              upsertCloudLightingPhase({
                id: item.id,
                name: item.name,
                time: item.time,
                uv: item.uv,
                white: item.white,
                blue: item.blue,
              }, userId),
            ),
          ])

          setEntries(localEntries)
          setBioEntries(localBio)
          setCatalogEntries(mergeCatalog(seedBioCatalog, localCatalog))
          setProtocolDefinitions(localProtocolDefinitions)
          setProtocolChecks(localProtocolChecks)
          setProtocolLogs(localProtocolLogs)
          setLightingPhases(localLighting)
          setSyncState('online')
          return
        }
        setEntries(
          sanitizeParameterEntries(
            cloudData.parameters.map((item) => ({
              id: item.id,
              parameter: item.parameter as ParameterKey,
              value: item.value,
              measuredAt: item.measuredAt,
              note: item.note,
            })),
          ),
        )
        setBioEntries(
          cloudData.bio.map((item) => ({
            id: item.id,
            type: item.type as BioType,
            name: item.name,
            scientificName: item.scientificName,
            position: item.position,
            note: item.note,
            createdAt: item.createdAt,
          })),
        )
        setCatalogEntries(
          mergeCatalog(
            seedBioCatalog,
            cloudData.catalog.map((item) => ({
              aliases: item.aliases,
              type: item.type as BioType,
              scientificName: item.scientificName,
              position: item.position,
              note: item.note,
            })),
          ),
        )
        setProtocolDefinitions(
          cloudData.protocolDefinitions.length
            ? cloudData.protocolDefinitions.map((item) => ({
                key: item.protocolKey as ProtocolKey,
                label: item.label,
                days: item.days,
                quantity: item.quantity,
                unit: item.unit,
              }))
            : localProtocolDefinitions,
        )
        setProtocolChecks(
          cloudData.protocolChecks.map((item) => ({
            id: item.id,
            protocolKey: item.protocolKey as ProtocolKey,
            weekStart: item.weekStart,
            dayIndex: item.dayIndex,
            checkedAt: item.checkedAt,
            quantity: item.quantity,
            unit: item.unit,
            note: item.note,
          })),
        )
        setProtocolLogs(
          cloudData.protocolLogs.map((item) => ({
            id: item.id,
            protocolKey: item.protocolKey as ProtocolKey,
            performedAt: item.performedAt,
            note: item.note,
          })),
        )
        if (cloudData.lightingPhases.length) {
          const mappedLighting = cloudData.lightingPhases.map((item) => ({
            id: item.id,
            name: item.name,
            time: normalizeTime(String(item.time)),
            uv: item.uv,
            white: item.white,
            blue: item.blue,
          }))
          const { normalized, idsToDelete, needsWriteBack } =
            normalizeLightingFromCloud(mappedLighting)
          if (needsWriteBack) {
            await Promise.all([
              ...normalized.map((item) =>
                upsertCloudLightingPhase({
                  id: item.id,
                  name: item.name,
                  time: item.time,
                  uv: item.uv,
                  white: item.white,
                  blue: item.blue,
                }, userId),
              ),
              ...idsToDelete.map((id) => deleteCloudLightingPhase(id)),
            ])
          }
          setLightingPhases(normalized)
        } else {
          setLightingPhases(localLighting)
        }
        setSyncState('online')
      } catch {
        setEntries(localEntries)
        setBioEntries(localBio)
        setCatalogEntries(mergeCatalog(seedBioCatalog, localCatalog))
        setProtocolDefinitions(localProtocolDefinitions)
        setProtocolChecks(localProtocolChecks)
        setProtocolLogs(localProtocolLogs)
        setLightingPhases(localLighting)
        setSyncState('error')
      }
    }

    void loadData()
  }, [
    authUser,
    bioEntriesStorageKey,
    catalogStorageKey,
    entriesStorageKey,
    isAuthLoading,
    lightingPhasesStorageKey,
    protocolChecksStorageKey,
    protocolDefinitionsStorageKey,
    protocolLogsStorageKey,
  ])

  useEffect(() => {
    if (!entriesStorageKey) return
    localStorage.setItem(entriesStorageKey, JSON.stringify(entries))
  }, [entries, entriesStorageKey])

  useEffect(() => {
    if (!bioEntriesStorageKey) return
    localStorage.setItem(bioEntriesStorageKey, JSON.stringify(bioEntries))
  }, [bioEntries, bioEntriesStorageKey])

  useEffect(() => {
    if (!protocolLogsStorageKey) return
    localStorage.setItem(protocolLogsStorageKey, JSON.stringify(protocolLogs))
  }, [protocolLogs, protocolLogsStorageKey])

  useEffect(() => {
    if (!protocolDefinitionsStorageKey) return
    localStorage.setItem(protocolDefinitionsStorageKey, JSON.stringify(protocolDefinitions))
  }, [protocolDefinitions, protocolDefinitionsStorageKey])

  useEffect(() => {
    if (!protocolChecksStorageKey) return
    localStorage.setItem(protocolChecksStorageKey, JSON.stringify(protocolChecks))
  }, [protocolChecks, protocolChecksStorageKey])

  useEffect(() => {
    if (!lightingPhasesStorageKey) return
    localStorage.setItem(lightingPhasesStorageKey, JSON.stringify(lightingPhases))
  }, [lightingPhases, lightingPhasesStorageKey])

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
    localStorage.setItem(catalogStorageKey, JSON.stringify(extras))
  }, [catalogEntries, catalogStorageKey])

  const latestByParameter = useMemo(() => {
    const map = new Map<ParameterKey, ParameterEntry>()
    for (const entry of entries) {
      const current = map.get(entry.parameter)
      if (
        !current ||
        new Date(entry.measuredAt).getTime() > new Date(current.measuredAt).getTime()
      ) {
        map.set(entry.parameter, entry)
      }
    }
    return parameterDefinitions.map((definition) => ({
      definition,
      latest: map.get(definition.key),
    }))
  }, [entries])

  const filteredEntries = useMemo(() => {
    const threshold = nowMs - periodDays * 86400000
    return entries
      .filter((entry) => new Date(entry.measuredAt).getTime() >= threshold)
      .filter((entry) =>
        filterParameter === 'todos' ? true : entry.parameter === filterParameter,
      )
      .sort(
        (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime(),
      )
  }, [entries, filterParameter, nowMs, periodDays])

  const dashboardEntries = useMemo(() => {
    const threshold = nowMs - dashboardPeriodDays * 86400000
    return entries
      .filter((entry) => new Date(entry.measuredAt).getTime() >= threshold)
      .sort(
        (a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime(),
      )
  }, [dashboardPeriodDays, entries, nowMs])

  const chartSeries = useMemo(() => {
    return parameterDefinitions
      .map((definition) => ({
        definition,
        entries: dashboardEntries.filter((entry) => entry.parameter === definition.key),
      }))
      .filter((item) => item.entries.length > 0)
  }, [dashboardEntries])

  const chartLimits = useMemo(() => {
    if (dashboardEntries.length === 0) return null
    const timestamps = dashboardEntries.map((entry) =>
      new Date(entry.measuredAt).getTime(),
    )
    const values = dashboardEntries.map((entry) => entry.value)
    return {
      minTimestamp: Math.min(...timestamps),
      maxTimestamp: Math.max(...timestamps),
      minValue: Math.min(...values),
      maxValue: Math.max(...values),
    }
  }, [dashboardEntries])

  const chartPaths = useMemo(() => {
    if (!chartLimits) return []
    return chartSeries.map((series) => ({
      key: series.definition.key,
      label: series.definition.label,
      color: parameterColors[series.definition.key],
      path: buildMultiPath(
        series.entries,
        chartLimits.minTimestamp,
        chartLimits.maxTimestamp,
        chartLimits.minValue,
        chartLimits.maxValue,
      ),
      points: buildMultiPoints(
        series.entries,
        chartLimits.minTimestamp,
        chartLimits.maxTimestamp,
        chartLimits.minValue,
        chartLimits.maxValue,
      ),
    }))
  }, [chartLimits, chartSeries])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!value) return
    const parsedValue = Number(value)
    if (!Number.isFinite(parsedValue)) return
    const newEntry: ParameterEntry = {
      id: crypto.randomUUID(),
      parameter,
      value: normalizeParameterValue(parameter, parsedValue),
      measuredAt: new Date().toISOString(),
      note,
    }
    setEntries((current) => [...current, newEntry])
    if (isSupabaseEnabled && authUser) {
      try {
        await upsertCloudParameter(
          {
          id: newEntry.id,
          parameter: newEntry.parameter,
          value: newEntry.value,
          measuredAt: newEntry.measuredAt,
          note: newEntry.note,
          },
          authUser.id,
        )
        setSyncState('online')
      } catch {
        setSyncState('error')
      }
    }
    setValue('')
    setNote('')
  }

  const handleDeleteParameterEntry = async (entryId: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== entryId))
    if (isSupabaseEnabled && authUser) {
      try {
        await deleteCloudParameter(entryId)
        setSyncState('online')
      } catch {
        setSyncState('error')
      }
    }
  }

  const handleAddBio = async (event: FormEvent) => {
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
      try {
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
        setSyncState('online')
      } catch {
        setSyncState('error')
      }
    }
    setBioName('')
    setBioScientificName('')
    setBioPosition('')
    setBioNote('')
    setBioEditingId(null)
  }

  const handleDeleteBioEntry = async (entryId: string) => {
    setBioEntries((current) => current.filter((entry) => entry.id !== entryId))
    if (bioEditingId === entryId) {
      setBioEditingId(null)
      setBioName('')
      setBioScientificName('')
      setBioPosition('')
      setBioNote('')
    }
    if (isSupabaseEnabled && authUser) {
      try {
        await deleteCloudBio(entryId)
        setSyncState('online')
      } catch {
        setSyncState('error')
      }
    }
  }

  const handleStartEditBioEntry = (entry: BioEntry) => {
    setBioEditingId(entry.id)
    setBioType(entry.type)
    setBioName(entry.name)
    setBioScientificName(entry.scientificName)
    setBioPosition(entry.position)
    setBioNote(entry.note)
  }

  const handleCancelEditBioEntry = () => {
    setBioEditingId(null)
    setBioName('')
    setBioScientificName('')
    setBioPosition('')
    setBioNote('')
  }

  const findCatalogMatch = (name: string) => {
    const normalized = normalize(name)
    return catalogEntries.find((entry) =>
      entry.aliases.some((alias) => normalized.includes(normalize(alias))),
    )
  }

  const bioSearchRequestIdRef = useRef(0)
  const bioSearchAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      bioSearchAbortRef.current?.abort()
    }
  }, [])

  const searchExternalBio = async (
    name: string,
    signal?: AbortSignal,
  ): Promise<BioCatalogEntry | null> => {
    const trimmed = name.trim()
    if (!trimmed) return null
    try {
      const gbifResponse = await fetch(
        `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(trimmed)}`,
        { signal },
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
    } catch {
      return null
    }
    return null
  }

  const fillBioByName = async () => {
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
      try {
        await upsertCloudCatalog(externalMatch, authUser.id)
        setSyncState('online')
      } catch {
        setSyncState('error')
      }
    }
    setBioType(externalMatch.type)
    if (!bioScientificName.trim()) setBioScientificName(externalMatch.scientificName)
    if (!bioPosition.trim()) setBioPosition(externalMatch.position)
    if (!bioNote.trim()) setBioNote(externalMatch.note)
  }

  const faunaItems = useMemo(() => {
    const normalizedSearch = normalize(faunaSearch)
    return bioEntries
      .filter((item) => (faunaSubmenu === 'todos' ? true : item.type === faunaSubmenu))
      .filter((item) =>
        normalizedSearch
          ? `${normalize(item.name)} ${normalize(item.scientificName)}`.includes(
              normalizedSearch,
            )
          : true,
      )
      .slice()
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
  }, [bioEntries, faunaSubmenu, faunaSearch])

  const faunaCounts = useMemo(() => {
    return {
      todos: bioEntries.length,
      coral: bioEntries.filter((item) => item.type === 'coral').length,
      invertebrado: bioEntries.filter((item) => item.type === 'invertebrado').length,
      peixe: bioEntries.filter((item) => item.type === 'peixe').length,
    }
  }, [bioEntries])

  const [todayKey, setTodayKey] = useState(() => toDateKey(new Date()))

  useEffect(() => {
    const scheduleNextTick = () => {
      const now = new Date()
      const nextMidnight = new Date(now)
      nextMidnight.setHours(24, 0, 0, 0)
      const delay = nextMidnight.getTime() - now.getTime()
      return window.setTimeout(() => {
        setTodayKey(toDateKey(new Date()))
      }, Math.max(1000, delay))
    }

    const timeoutId = scheduleNextTick()
    return () => window.clearTimeout(timeoutId)
  }, [todayKey])

  const protocolWeekStart = useMemo(
    () => startOfWeekMonday(fromDateKey(todayKey)),
    [todayKey],
  )
  const protocolWeekStartKey = useMemo(() => toDateKey(protocolWeekStart), [protocolWeekStart])

  const protocolChecksSorted = useMemo(() => {
    return protocolChecks
      .slice()
      .sort(
        (a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime(),
      )
  }, [protocolChecks])

  const latestProtocolByKey = useMemo(() => {
    const map = new Map<ProtocolKey, ProtocolCheck>()
    for (const log of protocolChecksSorted) {
      if (!map.has(log.protocolKey)) map.set(log.protocolKey, log)
    }
    return map
  }, [protocolChecksSorted])

  const protocolDoneSet = useMemo(() => {
    const set = new Set<string>()
    for (const log of protocolChecks) {
      if (log.weekStart === protocolWeekStartKey) {
        set.add(`${log.protocolKey}:${log.dayIndex}`)
      }
    }
    return set
  }, [protocolChecks, protocolWeekStartKey])

  const isDoneThisWeek = (key: ProtocolKey, dayIndex: number) => {
    return protocolDoneSet.has(`${key}:${dayIndex}`)
  }

  const findCheck = (key: ProtocolKey, dayIndex: number) => {
    return protocolChecks.find(
      (log) =>
        log.protocolKey === key &&
        log.weekStart === protocolWeekStartKey &&
        log.dayIndex === dayIndex,
    )
  }

  const handleToggleProtocolCheck = async (key: ProtocolKey, dayIndex: number) => {
    const existing = findCheck(key, dayIndex)
    if (existing) {
      setProtocolChecks((current) => current.filter((log) => log.id !== existing.id))
      setProtocolLogs((current) => current.filter((log) => log.id !== existing.id))
      if (isSupabaseEnabled && authUser) {
        try {
          await deleteCloudProtocolCheck(existing.id)
          await deleteCloudProtocolLog(existing.id)
          setSyncState('online')
        } catch {
          setSyncState('error')
        }
      }
      return
    }

    const definition = protocolDefinitions.find((d) => d.key === key)
    const newCheck: ProtocolCheck = {
      id: crypto.randomUUID(),
      protocolKey: key,
      weekStart: protocolWeekStartKey,
      dayIndex,
      checkedAt: new Date().toISOString(),
      quantity: definition?.quantity ?? null,
      unit: definition?.unit ?? '',
      note: protocolNote,
    }
    setProtocolChecks((current) => [newCheck, ...current])
    setProtocolLogs((current) => [
      {
        id: newCheck.id,
        protocolKey: newCheck.protocolKey,
        performedAt: newCheck.checkedAt,
        note: newCheck.note,
      },
      ...current,
    ])
    setProtocolNote('')
    if (isSupabaseEnabled && authUser) {
      try {
        await upsertCloudProtocolCheck(
          {
          id: newCheck.id,
          protocolKey: newCheck.protocolKey,
          weekStart: newCheck.weekStart,
          dayIndex: newCheck.dayIndex,
          checkedAt: newCheck.checkedAt,
          quantity: newCheck.quantity,
          unit: newCheck.unit,
          note: newCheck.note,
          },
          authUser.id,
        )
        await upsertCloudProtocolLog(
          {
          id: newCheck.id,
          protocolKey: newCheck.protocolKey,
          performedAt: newCheck.checkedAt,
          note: newCheck.note,
          },
          authUser.id,
        )
        setSyncState('online')
      } catch {
        setSyncState('error')
      }
    }
  }

  const handleDeleteProtocolHistoryEntry = async (entryId: string) => {
    setProtocolChecks((current) => current.filter((item) => item.id !== entryId))
    setProtocolLogs((current) => current.filter((item) => item.id !== entryId))
    if (isSupabaseEnabled && authUser) {
      try {
        await deleteCloudProtocolCheck(entryId)
        await deleteCloudProtocolLog(entryId)
        setSyncState('online')
      } catch {
        setSyncState('error')
      }
    }
  }

  const handleStartEditProtocol = (definition: ProtocolDefinition) => {
    setProtocolEditingKey(definition.key)
    setProtocolEditLabel(definition.label)
    setProtocolEditDays(definition.days)
    setProtocolEditQuantity(definition.quantity === null ? '' : String(definition.quantity))
    setProtocolEditUnit(definition.unit)
  }

  const handleSaveProtocol = async (key: ProtocolKey) => {
    const parsedQuantity = parseOptionalNumber(protocolEditQuantity)
    const next = protocolDefinitions.map((item) =>
      item.key === key
        ? {
            ...item,
            label: protocolEditLabel.trim() || item.label,
            days: protocolEditDays.slice().sort((a, b) => a - b),
            quantity: parsedQuantity,
            unit: protocolEditUnit.trim(),
          }
        : item,
    )
    setProtocolDefinitions(next)
    setProtocolEditingKey(null)
    setIsProtocolModalOpen(false)
    if (isSupabaseEnabled && authUser) {
      const saved = next.find((d) => d.key === key)
      if (!saved) return
      try {
        await upsertCloudProtocolDefinition(
          {
          protocolKey: saved.key,
          label: saved.label,
          days: saved.days,
          quantity: saved.quantity,
          unit: saved.unit,
          },
          authUser.id,
        )
        setSyncState('online')
      } catch {
        setSyncState('error')
      }
    }
  }

  const handleDeleteRoutine = async (key: ProtocolKey) => {
    setProtocolDefinitions((current) => current.filter((item) => item.key !== key))
    setProtocolChecks((current) => current.filter((item) => item.protocolKey !== key))
    setProtocolLogs((current) => current.filter((item) => item.protocolKey !== key))
    if (isSupabaseEnabled && authUser) {
      try {
        await deleteCloudProtocolChecksByKey(key)
        await deleteCloudProtocolLogsByKey(key)
        await deleteCloudProtocolDefinition(key)
        setSyncState('online')
      } catch {
        setSyncState('error')
      }
    }
  }

  const openAddRoutineModal = () => {
    setProtocolModalMode('add')
    setProtocolAddLabel('')
    setProtocolAddDays([])
    setProtocolAddQuantity('')
    setProtocolAddUnit('ml')
    setIsProtocolModalOpen(true)
  }

  const openEditRoutineModal = (definition: ProtocolDefinition) => {
    setProtocolModalMode('edit')
    handleStartEditProtocol(definition)
    setIsProtocolModalOpen(true)
  }

  const closeProtocolModal = () => {
    setIsProtocolModalOpen(false)
    setProtocolEditingKey(null)
  }

  const openEditLightingModal = (phase: LightingPhase) => {
    setLightingEditingId(phase.id)
    setLightingEditName(phase.name)
    setLightingEditTime(phase.time)
    setLightingEditUv(String(phase.uv))
    setLightingEditWhite(String(phase.white))
    setLightingEditBlue(String(phase.blue))
    setIsLightingModalOpen(true)
  }

  const closeLightingModal = () => {
    setIsLightingModalOpen(false)
    setLightingEditingId(null)
  }

  const handleSaveLightingPhase = async () => {
    if (!lightingEditingId) return
    const next: LightingPhase[] = lightingPhases
      .map((item) =>
        item.id === lightingEditingId
          ? {
              ...item,
              name: lightingEditName.trim() || item.name,
              time: lightingEditTime,
              uv: parseNumberWithFallback(lightingEditUv, item.uv),
              white: parseNumberWithFallback(lightingEditWhite, item.white),
              blue: parseNumberWithFallback(lightingEditBlue, item.blue),
            }
          : item,
      )
      .slice()
      .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))

    setLightingPhases(next)
    setIsLightingModalOpen(false)
    if (isSupabaseEnabled && authUser) {
      const saved = next.find((item) => item.id === lightingEditingId)
      if (!saved) return
      try {
        await upsertCloudLightingPhase(saved, authUser.id)
        setSyncState('online')
      } catch {
        setSyncState('error')
      }
    }
  }

  const handleAddRoutine = async () => {
    const label = protocolAddLabel.trim()
    if (!label) return
    const days = protocolAddDays.slice().sort((a, b) => a - b)
    if (days.length === 0) return
    const parsedQuantity = parseOptionalNumber(protocolAddQuantity)
    const unit = protocolAddUnit.trim()
    const key = buildProtocolKey(label)
    const newDefinition: ProtocolDefinition = { key, label, days, quantity: parsedQuantity, unit }
    setProtocolDefinitions((current) => [...current, newDefinition])
    setProtocolAddLabel('')
    setProtocolAddDays([])
    setProtocolAddQuantity('')
    setProtocolAddUnit('ml')
    setIsProtocolModalOpen(false)
    if (isSupabaseEnabled && authUser) {
      try {
        await upsertCloudProtocolDefinition(
          {
            protocolKey: newDefinition.key,
            label: newDefinition.label,
            days: newDefinition.days,
            quantity: newDefinition.quantity,
            unit: newDefinition.unit,
          },
          authUser.id,
        )
        setSyncState('online')
      } catch {
        setSyncState('error')
      }
    }
  }

  if (isSupabaseEnabled && isAuthLoading) {
    return (
      <main className="app">
        <Header mode="loading" message="Carregando login..." />
      </main>
    )
  }

  if (isSupabaseEnabled && !authUser) {
    return (
      <main className="app auth-screen">
        <section className="auth-card">
          <h1>{DEFAULT_UI_SETTINGS.title}</h1>
          <p className="auth-subtitle">Entre com Google para ver apenas seus registros</p>
          <button type="button" className="google-btn" onClick={handleGoogleLogin}>
            <span className="google-icon" aria-hidden="true">
              <svg viewBox="0 0 48 48">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.1 0 5.9 1.1 8.1 3.2l6-6C34.5 3.2 29.6 1 24 1 14.9 1 7.1 6.2 3.3 13.8l7.4 5.7C12.6 13.6 17.9 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.5 24.5c0-1.6-.1-2.7-.4-4H24v7.6h12.8c-.3 2-1.7 5.1-4.9 7.2l7.5 5.8c4.4-4.1 7.1-10.2 7.1-17.6z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.7 28.4c-.5-1.4-.8-2.9-.8-4.4s.3-3 .8-4.4l-7.4-5.7C1.9 16.7 1 20.2 1 24s.9 7.3 2.3 10.1l7.4-5.7z"
                />
                <path
                  fill="#34A853"
                  d="M24 47c5.6 0 10.3-1.8 13.7-5l-7.5-5.8c-2 1.4-4.7 2.4-6.2 2.4-6.1 0-11.4-4.1-13.3-9.9l-7.4 5.7C7.1 41.8 14.9 47 24 47z"
                />
              </svg>
            </span>
            Entrar com Google
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="app">
      <Header mode="main" />
      <SettingsModal />

      <nav className="tabs">
        <button
          className={activeTab === 'dashboard' ? 'active' : ''}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button
          className={activeTab === 'parametros' ? 'active' : ''}
          onClick={() => setActiveTab('parametros')}
        >
          Parâmetros
        </button>
        <button
          className={activeTab === 'protocolos' ? 'active' : ''}
          onClick={() => setActiveTab('protocolos')}
        >
          Protocolos
        </button>
        <button
          className={activeTab === 'iluminacao' ? 'active' : ''}
          onClick={() => setActiveTab('iluminacao')}
        >
          Iluminação
        </button>
        <button
          className={activeTab === 'inventario' ? 'active' : ''}
          onClick={() => setActiveTab('inventario')}
        >
          Inventário
        </button>
      </nav>

      {activeTab === 'dashboard' && (
        <section className="panel">
          <h2>Status rápido</h2>
          <div className="cards">
            {latestByParameter
              .filter(({ latest }) => Boolean(latest))
              .sort((a, b) => {
                const aTime = a.latest ? new Date(a.latest.measuredAt).getTime() : 0
                const bTime = b.latest ? new Date(b.latest.measuredAt).getTime() : 0
                return bTime - aTime
              })
              .map(({ definition, latest }) => (
                <article key={definition.key} className="card">
                  <span>{definition.label}</span>
                  <strong>
                    {latest
                      ? `${latest.value} ${definition.unit}`.trim()
                      : 'Sem medição'}
                  </strong>
                  <small>
                    {latest
                      ? `${getStatus(latest.value, definition.min, definition.max)} · ${getTrend(entries.filter((entry) => entry.parameter === definition.key))}`
                      : 'Sem histórico'}
                  </small>
                </article>
              ))}
          </div>

          <div className="chart-box">
            <div className="chart-head">
              <h3>Dashboard Geral do Aquário</h3>
              <select
                value={dashboardPeriodDays}
                onChange={(event) =>
                  setDashboardPeriodDays(Number(event.target.value) as 7 | 30 | 90 | 365)
                }
              >
                <option value={7}>Últimos 7 dias</option>
                <option value={30}>Últimos 30 dias</option>
                <option value={90}>Últimos 90 dias</option>
                <option value={365}>Último ano</option>
              </select>
            </div>
            <svg viewBox="0 0 320 120" className="chart">
              {chartPaths.map((item) => (
                <g key={item.key}>
                  {item.path && <path d={item.path} stroke={item.color} />}
                  {item.points.map((point, index) => (
                    <circle
                      key={`${item.key}-${index}`}
                      cx={point.x}
                      cy={point.y}
                      r={2.7}
                      fill={item.color}
                    />
                  ))}
                </g>
              ))}
            </svg>
            <div className="legend">
              {chartPaths.map((item) => (
                <span key={item.key} className="legend-item">
                  <i style={{ backgroundColor: item.color }}></i>
                  {item.label}
                </span>
              ))}
              {chartPaths.length === 0 && <span>Sem registros no período.</span>}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'parametros' && (
        <section className="panel">
          <h2>Registrar parâmetro</h2>
          <form className="form" onSubmit={handleSubmit}>
            <label>
              Parâmetro
              <select
                value={parameter}
                onChange={(event) => setParameter(event.target.value as ParameterKey)}
              >
                {parameterDefinitions.map((definition) => (
                  <option key={definition.key} value={definition.key}>
                    {definition.label} ({definition.unit || 'sem unidade'})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Valor
              <input
                required
                type="number"
                step="0.01"
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </label>
            <label className="full">
              Observação
              <input
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Opcional"
              />
            </label>
            <button type="submit">Salvar medição</button>
          </form>

          <div className="filters">
            <select
              value={filterParameter}
              onChange={(event) =>
                setFilterParameter(event.target.value as 'todos' | ParameterKey)
              }
            >
              <option value="todos">Todos os parâmetros</option>
              {parameterDefinitions.map((definition) => (
                <option key={definition.key} value={definition.key}>
                  {definition.label}
                </option>
              ))}
            </select>
            <select
              value={periodDays}
              onChange={(event) =>
                setPeriodDays(Number(event.target.value) as 7 | 30 | 90 | 365)
              }
            >
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>Últimos 90 dias</option>
              <option value={365}>Último ano</option>
            </select>
          </div>

          <div className="history">
            {filteredEntries.map((entry) => {
              const definition = parameterDefinitions.find(
                (item) => item.key === entry.parameter,
              )
              return (
                <article key={entry.id} className="history-item">
                  <div>
                    <strong>{definition?.label}</strong>
                    <p>{formatDate(entry.measuredAt)}</p>
                  </div>
                  <div className="history-actions">
                    <div className="history-value">
                      {entry.value} {definition?.unit}
                    </div>
                    <button
                      className="danger-btn"
                      onClick={() => handleDeleteParameterEntry(entry.id)}
                    >
                      Apagar
                    </button>
                  </div>
                </article>
              )
            })}
            {filteredEntries.length === 0 && <p>Nenhuma medição no período.</p>}
          </div>
        </section>
      )}

      {activeTab === 'protocolos' && (
        <section className="panel">
          <h2>Protocolos e dosagens</h2>
          <label className="fauna-search">
            Observação rápida
            <input
              type="text"
              value={protocolNote}
              onChange={(event) => setProtocolNote(event.target.value)}
              placeholder="Opcional (ex.: dose ajustada, produto, etc.)"
            />
          </label>

          <div className="protocol-toolbar">
            <button className="secondary-btn" onClick={openAddRoutineModal}>
              Adicionar rotina
            </button>
          </div>

          <div className="history">
            {protocolDefinitions.map((definition) => {
              const latest = latestProtocolByKey.get(definition.key)
              const scheduledDays = definition.days.slice().sort((a, b) => a - b)
              const doseLabel =
                definition.quantity === null
                  ? 'Sem quantidade'
                  : `${definition.quantity} ${definition.unit}`.trim()
              return (
                <article key={definition.key} className="history-item">
                  <div>
                    <strong>{definition.label}</strong>
                    <p>
                      {formatDays(scheduledDays)} · {doseLabel}
                      {latest ? ` · Último: ${formatDate(latest.checkedAt)}` : ''}
                    </p>
                    <div className="week-checks">
                      {scheduledDays.map((dayIndex) => (
                        <button
                          key={`${definition.key}-${dayIndex}`}
                          className={
                            isDoneThisWeek(definition.key, dayIndex)
                              ? 'week-check active'
                              : 'week-check'
                          }
                          onClick={() => {
                            void handleToggleProtocolCheck(definition.key, dayIndex)
                          }}
                        >
                          {dayLabels[(dayIndex + 6) % 7]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="history-actions">
                    <button
                      className="secondary-btn"
                      onClick={() => openEditRoutineModal(definition)}
                    >
                      Editar
                    </button>
                    <button
                      className="danger-btn"
                      onClick={() => {
                        void handleDeleteRoutine(definition.key)
                      }}
                    >
                      Excluir
                    </button>
                  </div>
                </article>
              )
            })}
          </div>

          {isProtocolModalOpen && (
            <div className="modal-backdrop" onClick={closeProtocolModal}>
              <div className="modal" onClick={(event) => event.stopPropagation()}>
                <div className="modal-head">
                  <h3>
                    {protocolModalMode === 'add' ? 'Adicionar rotina' : 'Editar rotina'}
                  </h3>
                  <button className="secondary-btn" onClick={closeProtocolModal}>
                    Fechar
                  </button>
                </div>

                {protocolModalMode === 'add' && (
                  <>
                    <label className="fauna-search">
                      Nome da rotina
                      <input
                        type="text"
                        value={protocolAddLabel}
                        onChange={(event) => setProtocolAddLabel(event.target.value)}
                        placeholder="Ex.: Alimentar, Dosar iodo, Limpar skimmer"
                      />
                    </label>
                    <div className="week-checks">
                      {Array.from({ length: 7 }).map((_, index) => (
                        <button
                          key={`add-routine-${index}`}
                          className={
                            protocolAddDays.includes(index)
                              ? 'week-check active'
                              : 'week-check'
                          }
                          onClick={() => {
                            setProtocolAddDays((current) =>
                              current.includes(index)
                                ? current.filter((d) => d !== index)
                                : [...current, index],
                            )
                          }}
                        >
                          {dayLabels[(index + 6) % 7]}
                        </button>
                      ))}
                    </div>
                    <div className="protocol-dose">
                      <label>
                        Quantidade
                        <input
                          type="number"
                          step="0.01"
                          value={protocolAddQuantity}
                          onChange={(event) => setProtocolAddQuantity(event.target.value)}
                          placeholder="Opcional"
                        />
                      </label>
                      <label>
                        Unidade
                        <input
                          type="text"
                          value={protocolAddUnit}
                          onChange={(event) => setProtocolAddUnit(event.target.value)}
                        />
                      </label>
                    </div>
                    <div className="modal-actions">
                      <button className="secondary-btn" onClick={() => void handleAddRoutine()}>
                        Adicionar
                      </button>
                      <button className="danger-btn" onClick={closeProtocolModal}>
                        Cancelar
                      </button>
                    </div>
                  </>
                )}

                {protocolModalMode === 'edit' && protocolEditingKey && (
                  <>
                    <label className="fauna-search">
                      Nome da rotina
                      <input
                        type="text"
                        value={protocolEditLabel}
                        onChange={(event) => setProtocolEditLabel(event.target.value)}
                      />
                    </label>
                    <div className="week-checks">
                      {Array.from({ length: 7 }).map((_, index) => (
                        <button
                          key={`edit-routine-${index}`}
                          className={
                            protocolEditDays.includes(index)
                              ? 'week-check active'
                              : 'week-check'
                          }
                          onClick={() => {
                            setProtocolEditDays((current) =>
                              current.includes(index)
                                ? current.filter((d) => d !== index)
                                : [...current, index],
                            )
                          }}
                        >
                          {dayLabels[(index + 6) % 7]}
                        </button>
                      ))}
                    </div>
                    <div className="protocol-dose">
                      <label>
                        Quantidade
                        <input
                          type="number"
                          step="0.01"
                          value={protocolEditQuantity}
                          onChange={(event) => setProtocolEditQuantity(event.target.value)}
                        />
                      </label>
                      <label>
                        Unidade
                        <input
                          type="text"
                          value={protocolEditUnit}
                          onChange={(event) => setProtocolEditUnit(event.target.value)}
                        />
                      </label>
                    </div>
                    <div className="modal-actions">
                      <button
                        className="secondary-btn"
                        onClick={() => void handleSaveProtocol(protocolEditingKey)}
                      >
                        Salvar
                      </button>
                      <button className="danger-btn" onClick={closeProtocolModal}>
                        Cancelar
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <h3 className="subsection-title">Histórico</h3>
          <div className="history">
            {protocolChecksSorted.slice(0, 30).map((log) => {
              const def = protocolDefinitions.find((d) => d.key === log.protocolKey)
              return (
                <article key={log.id} className="history-item">
                  <div>
                    <strong>{def?.label ?? log.protocolKey}</strong>
                    <p>
                      {formatDate(log.checkedAt)}
                      {log.quantity !== null ? ` · ${log.quantity} ${log.unit}`.trim() : ''}
                      {log.note ? ` · ${log.note}` : ''}
                    </p>
                  </div>
                  <div className="history-actions">
                    <button
                      className="danger-btn"
                      onClick={() => {
                        void handleDeleteProtocolHistoryEntry(log.id)
                      }}
                    >
                      Apagar
                    </button>
                  </div>
                </article>
              )
            })}
            {protocolChecksSorted.length === 0 && <p>Nenhum registro de protocolo.</p>}
          </div>
        </section>
      )}

      {activeTab === 'iluminacao' && (
        <section className="panel">
          <h2>Iluminação (Rampa de LED)</h2>
          <p className="helper">
            Edite horários e potências reais por canal. 19:30 é o desligamento.
          </p>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Fase</th>
                  <th>Horário</th>
                  <th>R (UV)</th>
                  <th>G (Branco)</th>
                  <th>B (Azul)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lightingPhases
                  .slice()
                  .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))
                  .map((phase) => (
                    <tr key={phase.id}>
                      <td>{phase.name}</td>
                      <td>{phase.time}</td>
                      <td>{phase.uv}</td>
                      <td>{phase.white}</td>
                      <td>{phase.blue}</td>
                      <td className="table-actions">
                        <button
                          className="secondary-btn"
                          onClick={() => openEditLightingModal(phase)}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {isLightingModalOpen && (
            <div className="modal-backdrop" onClick={closeLightingModal}>
              <div className="modal" onClick={(event) => event.stopPropagation()}>
                <div className="modal-head">
                  <h3>Editar fase</h3>
                  <button className="secondary-btn" onClick={closeLightingModal}>
                    Fechar
                  </button>
                </div>

                <label className="fauna-search">
                  Nome da fase
                  <input
                    type="text"
                    value={lightingEditName}
                    onChange={(event) => setLightingEditName(event.target.value)}
                  />
                </label>

                <div className="protocol-dose">
                  <label>
                    Horário
                    <input
                      type="time"
                      value={lightingEditTime}
                      onChange={(event) => setLightingEditTime(event.target.value)}
                    />
                  </label>
                  <label>
                    UV
                    <input
                      type="number"
                      value={lightingEditUv}
                      onChange={(event) => setLightingEditUv(event.target.value)}
                    />
                  </label>
                  <label>
                    Branco
                    <input
                      type="number"
                      value={lightingEditWhite}
                      onChange={(event) => setLightingEditWhite(event.target.value)}
                    />
                  </label>
                  <label>
                    Azul
                    <input
                      type="number"
                      value={lightingEditBlue}
                      onChange={(event) => setLightingEditBlue(event.target.value)}
                    />
                  </label>
                </div>

                <div className="modal-actions">
                  <button className="secondary-btn" onClick={() => void handleSaveLightingPhase()}>
                    Salvar
                  </button>
                  <button className="danger-btn" onClick={closeLightingModal}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === 'inventario' && (
        <section className="panel">
          <h2>Inventário biológico</h2>
          <form className="form" onSubmit={handleAddBio}>
            <label>
              Tipo
              <select
                value={bioType}
                onChange={(event) => setBioType(event.target.value as BioType)}
              >
                <option value="peixe">Peixe</option>
                <option value="coral">Coral</option>
                <option value="invertebrado">Invertebrado</option>
              </select>
            </label>
            <label>
              Nome
              <input
                required
                type="text"
                value={bioName}
                onChange={(event) => setBioName(event.target.value)}
                onBlur={() => {
                  void fillBioByName()
                }}
              />
            </label>
            <p className="helper full">
              Ao digitar o nome, o sistema tenta completar nome científico, tipo,
              posição e observação automaticamente.
            </p>
            <button
              type="button"
              className="secondary-btn full"
              onClick={() => {
                void fillBioByName()
              }}
              disabled={isSearchingBio}
            >
              {isSearchingBio ? 'Buscando dados...' : 'Buscar dados do nome'}
            </button>
            <label>
              Nome científico
              <input
                type="text"
                value={bioScientificName}
                onChange={(event) => setBioScientificName(event.target.value)}
              />
            </label>
            <label>
              Posição no aquário
              <input
                type="text"
                value={bioPosition}
                onChange={(event) => setBioPosition(event.target.value)}
              />
            </label>
            <label className="full">
              Observação
              <input
                type="text"
                value={bioNote}
                onChange={(event) => setBioNote(event.target.value)}
              />
            </label>
            <button type="submit">
              {bioEditingId ? 'Atualizar organismo' : 'Salvar organismo'}
            </button>
            {bioEditingId && (
              <button
                type="button"
                className="secondary-btn full"
                onClick={handleCancelEditBioEntry}
              >
                Cancelar edição
              </button>
            )}
          </form>

          <h3 className="subsection-title">Fauna</h3>
          <div className="cards fauna-cards">
            <article className="card">
              <span>Total</span>
              <strong>{faunaCounts.todos}</strong>
            </article>
            <article className="card">
              <span>Corais</span>
              <strong>{faunaCounts.coral}</strong>
            </article>
            <article className="card">
              <span>Invertebrados</span>
              <strong>{faunaCounts.invertebrado}</strong>
            </article>
            <article className="card">
              <span>Peixes</span>
              <strong>{faunaCounts.peixe}</strong>
            </article>
          </div>

          <div className="subtabs">
            <button
              className={faunaSubmenu === 'todos' ? 'active' : ''}
              onClick={() => setFaunaSubmenu('todos')}
            >
              Todos ({faunaCounts.todos})
            </button>
            <button
              className={faunaSubmenu === 'coral' ? 'active' : ''}
              onClick={() => setFaunaSubmenu('coral')}
            >
              Corais ({faunaCounts.coral})
            </button>
            <button
              className={faunaSubmenu === 'invertebrado' ? 'active' : ''}
              onClick={() => setFaunaSubmenu('invertebrado')}
            >
              Invertebrados ({faunaCounts.invertebrado})
            </button>
            <button
              className={faunaSubmenu === 'peixe' ? 'active' : ''}
              onClick={() => setFaunaSubmenu('peixe')}
            >
              Peixes ({faunaCounts.peixe})
            </button>
          </div>

          <label className="fauna-search">
            Buscar animal
            <input
              type="text"
              value={faunaSearch}
              onChange={(event) => setFaunaSearch(event.target.value)}
              placeholder="Nome comum ou científico"
            />
          </label>

          <div className="history">
            {faunaItems.map((item) => (
                <article key={item.id} className="history-item">
                  <div>
                    <strong>
                      {item.name} · {item.type}
                    </strong>
                    <p>
                      {item.scientificName || 'Sem nome científico'} ·{' '}
                      {item.position || 'Sem posição'} · {formatDate(item.createdAt)}
                    </p>
                  </div>
                  <div className="history-actions">
                    <button
                      className="secondary-btn"
                      onClick={() => handleStartEditBioEntry(item)}
                    >
                      Editar
                    </button>
                    <button
                      className="danger-btn"
                      onClick={() => handleDeleteBioEntry(item.id)}
                    >
                      Apagar
                    </button>
                  </div>
                </article>
              ))}
            {faunaItems.length === 0 && <p>Nenhum organismo cadastrado neste grupo.</p>}
          </div>
        </section>
      )}
    </main>
  )
}

export default App
