import { useState, useMemo } from 'react'
import type { EventLog, EventType } from '../../types'
import { EVENT_TYPE_TITLES } from '../../hooks/useEventLog'

const EVENT_ICONS: Record<EventType, string> = {
  medicao: '🧪',
  tpa: '💧',
  dosagem: '⚗️',
  animal: '🐠',
  manutencao: '🔧',
  observacao: '📝',
  problema: '⚠️',
  tratamento: '💊',
}

const EVENT_TYPES: EventType[] = [
  'medicao', 'tpa', 'dosagem', 'animal', 'manutencao', 'observacao', 'problema', 'tratamento',
]

const AMOUNT_UNITS: Record<EventType, string[]> = {
  medicao: ['dKH', 'ppm', '°C', 'sg', ''],
  tpa: ['%', 'L', ''],
  dosagem: ['ml', 'g', 'gotas', ''],
  animal: [''],
  manutencao: [''],
  observacao: [''],
  problema: [''],
  tratamento: ['ml', 'g', 'gotas', 'dias', ''],
}

const AMOUNT_LABEL: Partial<Record<EventType, string>> = {
  tpa: 'Volume trocado',
  dosagem: 'Quantidade dosada',
  tratamento: 'Quantidade',
}

function formatRelativeDate(isoDate: string): string {
  const now = Date.now()
  const then = new Date(isoDate).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 2) return 'agora'
  if (diffMin < 60) return `há ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `há ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  if (diffD === 1) return 'ontem'
  if (diffD < 7) return `há ${diffD} dias`
  return new Date(isoDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDayHeader(isoDate: string): string {
  const d = new Date(isoDate)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const isToday = d.toDateString() === today.toDateString()
  const isYesterday = d.toDateString() === yesterday.toDateString()
  if (isToday) return 'Hoje'
  if (isYesterday) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
}

function getDayKey(isoDate: string): string {
  return new Date(isoDate).toDateString()
}

type Props = {
  eventLogs: EventLog[]
  addEventLog: (event: Omit<EventLog, 'id'>) => void
  deleteEventLog: (id: string) => void
}

export default function DiaryTab({ eventLogs, addEventLog, deleteEventLog }: Props) {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [filterType, setFilterType] = useState<EventType | 'todos'>('todos')

  // Form state
  const [formType, setFormType] = useState<EventType>('observacao')
  const [formTitle, setFormTitle] = useState('')
  const [formNote, setFormNote] = useState('')
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 16))
  const [formAmount, setFormAmount] = useState('')
  const [formUnit, setFormUnit] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const hasAmountField = ['tpa', 'dosagem', 'tratamento'].includes(formType)

  const handleTypeChange = (type: EventType) => {
    setFormType(type)
    const defaultUnits = AMOUNT_UNITS[type]
    setFormUnit(defaultUnits[0] ?? '')
  }

  const handleOpenForm = () => {
    setFormType('observacao')
    setFormTitle('')
    setFormNote('')
    setFormDate(new Date().toISOString().slice(0, 16))
    setFormAmount('')
    setFormUnit(AMOUNT_UNITS['observacao'][0] ?? '')
    setIsFormOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const titleFinal = formTitle.trim() || EVENT_TYPE_TITLES[formType]
    const amountNum = formAmount ? parseFloat(formAmount.replace(',', '.')) : null
    addEventLog({
      type: formType,
      title: titleFinal,
      note: formNote.trim(),
      date: new Date(formDate).toISOString(),
      amount: Number.isFinite(amountNum) ? amountNum : null,
      unit: formUnit,
    })
    setIsFormOpen(false)
  }

  const filtered = useMemo(() =>
    filterType === 'todos' ? eventLogs : eventLogs.filter((e) => e.type === filterType),
    [eventLogs, filterType],
  )

  // Group by day
  const grouped = useMemo(() => {
    const map = new Map<string, EventLog[]>()
    for (const event of filtered) {
      const key = getDayKey(event.date)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(event)
    }
    return Array.from(map.entries())
  }, [filtered])

  return (
    <section className="diary-section">
      <div className="diary-header">
        <div className="diary-header-left">
          <h2 className="diary-title">Diário</h2>
          <span className="diary-count">{eventLogs.length} eventos</span>
        </div>
        <button
          type="button"
          className="primary-btn diary-add-btn"
          onClick={isFormOpen ? () => setIsFormOpen(false) : handleOpenForm}
        >
          {isFormOpen ? '× Cancelar' : '+ Registrar evento'}
        </button>
      </div>

      {isFormOpen && (
        <form className="diary-form" onSubmit={handleSubmit}>
          <div className="diary-form-types">
            {EVENT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className={`diary-type-btn${formType === type ? ' diary-type-btn--active' : ''}`}
                onClick={() => handleTypeChange(type)}
                title={EVENT_TYPE_TITLES[type]}
              >
                <span>{EVENT_ICONS[type]}</span>
                <span>{EVENT_TYPE_TITLES[type]}</span>
              </button>
            ))}
          </div>

          <div className="diary-form-fields">
            <label className="diary-field">
              <span>Título <span className="diary-field-hint">(opcional — usa o tipo por padrão)</span></span>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder={EVENT_TYPE_TITLES[formType]}
                className="inv-input"
              />
            </label>

            <label className="diary-field">
              <span>Data e hora</span>
              <input
                type="datetime-local"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="inv-input"
              />
            </label>

            {hasAmountField && (
              <div className="diary-field-row">
                <label className="diary-field">
                  <span>{AMOUNT_LABEL[formType] ?? 'Quantidade'}</span>
                  <input
                    type="number"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="ex: 15"
                    className="inv-input"
                    step="any"
                    min="0"
                  />
                </label>
                <label className="diary-field">
                  <span>Unidade</span>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="inv-input"
                  >
                    {AMOUNT_UNITS[formType].map((u) => (
                      <option key={u} value={u}>{u || '—'}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <label className="diary-field">
              <span>Observação</span>
              <textarea
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                placeholder="Detalhes, observações, produto usado..."
                className="inv-input diary-textarea"
                rows={3}
              />
            </label>
          </div>

          <div className="diary-form-actions">
            <button type="submit" className="primary-btn">Salvar evento</button>
          </div>
        </form>
      )}

      {/* Filter chips */}
      {eventLogs.length > 0 && (
        <div className="diary-filters">
          <button
            type="button"
            className={`diary-filter-btn${filterType === 'todos' ? ' diary-filter-btn--active' : ''}`}
            onClick={() => setFilterType('todos')}
          >
            Todos ({eventLogs.length})
          </button>
          {EVENT_TYPES.filter((t) => eventLogs.some((e) => e.type === t)).map((type) => (
            <button
              key={type}
              type="button"
              className={`diary-filter-btn${filterType === type ? ' diary-filter-btn--active' : ''}`}
              onClick={() => setFilterType(type)}
            >
              {EVENT_ICONS[type]} {EVENT_TYPE_TITLES[type]} ({eventLogs.filter((e) => e.type === type).length})
            </button>
          ))}
        </div>
      )}

      {/* Events feed */}
      {filtered.length === 0 ? (
        <div className="diary-empty">
          {eventLogs.length === 0
            ? 'Nenhum evento registrado. Comece registrando uma troca de água, dosagem ou observação.'
            : 'Nenhum evento neste filtro.'}
        </div>
      ) : (
        <div className="diary-feed">
          {grouped.map(([dayKey, dayEvents]) => (
            <div key={dayKey} className="diary-day-group">
              <div className="diary-day-label">{formatDayHeader(dayEvents[0].date)}</div>
              {dayEvents.map((event) => (
                <div key={event.id} className={`diary-card diary-card--${event.type}`}>
                  <div className="diary-card-icon">{EVENT_ICONS[event.type]}</div>
                  <div className="diary-card-body">
                    <div className="diary-card-top">
                      <span className="diary-card-title">{event.title}</span>
                      <span className="diary-card-time">{formatRelativeDate(event.date)}</span>
                    </div>
                    {event.amount !== null && (
                      <div className="diary-card-amount">
                        {event.amount} {event.unit}
                      </div>
                    )}
                    {event.note && (
                      <div className="diary-card-note">{event.note}</div>
                    )}
                  </div>
                  <div className="diary-card-actions">
                    {confirmDeleteId === event.id ? (
                      <>
                        <button
                          type="button"
                          className="diary-delete-confirm"
                          onClick={() => { deleteEventLog(event.id); setConfirmDeleteId(null) }}
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          className="diary-delete-cancel"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="diary-delete-btn"
                        onClick={() => setConfirmDeleteId(event.id)}
                        aria-label="Remover evento"
                        title="Remover"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
