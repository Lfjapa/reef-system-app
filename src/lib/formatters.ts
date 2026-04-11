// Pure formatting utilities — no React dependencies

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))

export const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export const formatDays = (days: number[]) => {
  const labels = days
    .slice()
    .sort((a, b) => a - b)
    .map((day) => DAY_LABELS[(day + 6) % 7])
  return labels.join(', ')
}

export const timeToMinutes = (time: string) => {
  const [h, m] = time.split(':').map((part) => Number(part))
  return h * 60 + m
}

export const getStatus = (value: number, min?: number, max?: number) => {
  if (min === undefined || max === undefined) return 'Sem faixa'
  if (value < min) return 'Baixo'
  if (value > max) return 'Alto'
  return 'Ideal'
}

export const formatSigned = (value: number, maximumFractionDigits: number) => {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  const abs = Math.abs(value)
  const formatted = new Intl.NumberFormat('pt-BR', { maximumFractionDigits }).format(abs)
  return `${sign}${formatted}`
}

export const hashToHue = (value: string) => {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % 360
}

const PARAMETER_COLORS: Record<string, string> = {
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

export const getSeriesColor = (key: string) => {
  const known = PARAMETER_COLORS[key]
  if (known) return known
  const hue = hashToHue(key)
  return `hsl(${hue} 70% 60%)`
}

export const formatSyncError = (error: unknown) => {
  if (error instanceof Error) return error.message || 'Erro desconhecido'
  if (!error || typeof error !== 'object') return 'Erro desconhecido'
  const candidate = error as Record<string, unknown>
  const message = typeof candidate.message === 'string' ? candidate.message : ''
  const code = typeof candidate.code === 'string' ? candidate.code : ''
  const details = typeof candidate.details === 'string' ? candidate.details : ''
  const hint = typeof candidate.hint === 'string' ? candidate.hint : ''
  const status = typeof candidate.status === 'number' ? String(candidate.status) : ''
  const pieces = [message, code && `code=${code}`, status && `status=${status}`, details, hint].filter(Boolean)
  return pieces.join(' • ') || 'Erro desconhecido'
}
