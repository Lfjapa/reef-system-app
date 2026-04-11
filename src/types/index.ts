import type { BioType } from '../lib/catalogUtils'

export type { BioType }

// ── Parâmetros ────────────────────────────────────────────────────────────────

export type ParameterKey = string

export type ParameterEntry = {
  id: string
  parameter: ParameterKey
  value: number
  measuredAt: string
  note: string
}

export type ParameterDefinition = {
  key: ParameterKey
  label: string
  unit: string
  min?: number
  max?: number
}

export type TrendArrow = 'up' | 'down' | 'flat'
export type InsightBadge = 'Ideal' | 'Atenção' | 'Crítico' | 'Sem faixa'

export type ParameterInsight = {
  latest: ParameterEntry | null
  previous: ParameterEntry | null
  delta: number | null
  daysBetween: number | null
  dailyRate: number | null
  arrow: TrendArrow
  badge: InsightBadge
  projectedDaysToBound: number | null
  projectedBound: 'min' | 'max' | null
  projectedDaysToCriticalMin: number | null
  criticalMin: number | null
}

export type TankParameterSetting = {
  parameter: ParameterKey
  isCustomEnabled: boolean
  customMin: number | null
  customMax: number | null
  updatedAt: string
}

export type BottleSetting = {
  parameter: ParameterKey
  dailyDoseMl: number | null   // ml de reagente usado por dia
  bottleMlRemaining: number | null  // ml restantes no frasco
  updatedAt: string
}

// ── Fauna ─────────────────────────────────────────────────────────────────────

export type BioEntry = {
  id: string
  type: BioType
  name: string
  scientificName: string
  position: string
  note: string
  nickname: string
  createdAt: string
}

// ── Sync & Auth ───────────────────────────────────────────────────────────────

export type SyncState = 'local' | 'syncing' | 'online' | 'error'

export type UiSettings = {
  title: string
  subtitle: string
  subtitleEnabled: boolean
}

// ── Iluminação ────────────────────────────────────────────────────────────────

export type LightingPhase = {
  id: string
  name: string
  time: string
  uv: number
  white: number
  blue: number
}

// ── Protocolos ────────────────────────────────────────────────────────────────

export type ProtocolKey = string

export type ProtocolDefinition = {
  key: ProtocolKey
  label: string
  days: number[]
  quantity: number | null
  unit: string
}

export type ProtocolLog = {
  id: string
  protocolKey: ProtocolKey
  performedAt: string
  note: string
}

export type ProtocolCheck = {
  id: string
  protocolKey: ProtocolKey
  weekStart: string
  dayIndex: number
  checkedAt: string
  quantity: number | null
  unit: string
  note: string
}

// ── Diário de Eventos ─────────────────────────────────────────────────────────

export type EventType =
  | 'medicao'        // Medição de parâmetro
  | 'tpa'            // Troca parcial de água
  | 'dosagem'        // Dosagem de produto
  | 'animal'         // Adição/remoção de animal
  | 'manutencao'     // Manutenção geral
  | 'observacao'     // Observação livre
  | 'problema'       // Problema identificado
  | 'tratamento'     // Tratamento de doença

export type EventLog = {
  id: string
  type: EventType
  date: string        // ISO datetime
  title: string       // Título curto (auto ou manual)
  note: string        // Texto livre
  amount: number | null  // Quantidade opcional (ex: % TPA, ml, g)
  unit: string        // Unidade da quantidade
}
