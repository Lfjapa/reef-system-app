type ParameterKey = string

type ParameterDefinition = {
  key: ParameterKey
  label: string
  unit: string
}

type ParameterEntry = {
  id: string
  parameter: ParameterKey
  value: number
  measuredAt: string
}

type LastMeasurementFeedback = {
  parameter: ParameterKey
  measuredAt: string
  value: number
  previousValue: number | null
  delta: number | null
  daysBetween: number | null
  dailyRate: number | null
  protocolLabel: string | null
  protocolPerformedAt: string | null
  deltaSinceProtocol: number | null
}

type Props = {
  parameterDefinitions: ParameterDefinition[]
  parameter: ParameterKey
  setParameter: (key: ParameterKey) => void
  value: string
  setValue: (value: string) => void
  note: string
  setNote: (note: string) => void
  onSubmit: (event: import('react').FormEvent<HTMLFormElement>) => void
  lastMeasurementFeedback: LastMeasurementFeedback | null
  formatDate: (iso: string) => string
  formatSigned: (value: number, maximumFractionDigits: number) => string
  filterParameter: 'todos' | ParameterKey
  setFilterParameter: (value: 'todos' | ParameterKey) => void
  periodDays: 7 | 30 | 90 | 365
  setPeriodDays: (days: 7 | 30 | 90 | 365) => void
  filteredEntries: ParameterEntry[]
  onDeleteEntry: (entryId: string) => void
  safeZones?: Map<string, { min: number; max: number }>
}

export default function ParametersTab({
  parameterDefinitions,
  parameter,
  setParameter,
  value,
  setValue,
  note,
  setNote,
  onSubmit,
  lastMeasurementFeedback,
  formatDate,
  formatSigned,
  filterParameter,
  setFilterParameter,
  periodDays,
  setPeriodDays,
  filteredEntries,
  onDeleteEntry,
  safeZones,
}: Props) {
  // Inline feedback for the current value being typed
  const numericValue = parseFloat(value)
  const safe = safeZones?.get(parameter) ?? null
  let inputFeedback: { text: string; cls: string } | null = null
  if (value.trim() !== '' && Number.isFinite(numericValue) && safe) {
    const { min, max } = safe
    if (numericValue < min || numericValue > max) {
      const diff = numericValue < min ? min - numericValue : numericValue - max
      const pct = (diff / (max - min)) * 100
      const severity = pct > 20 ? 'critical' : 'attention'
      inputFeedback = {
        text: numericValue < min
          ? `Abaixo do mínimo (${min}) · diferença: ${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(min - numericValue)}`
          : `Acima do máximo (${max}) · diferença: ${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(numericValue - max)}`,
        cls: `param-input-feedback param-input-feedback--${severity}`,
      }
    } else {
      // How far inside the safe zone (0 = edge, 1 = center)
      const span = max - min
      const distFromEdge = Math.min(numericValue - min, max - numericValue) / (span / 2)
      if (distFromEdge >= 0.5) {
        inputFeedback = { text: `Ideal · zona: ${min}–${max}`, cls: 'param-input-feedback param-input-feedback--ideal' }
      } else {
        inputFeedback = { text: `Atenção · zona: ${min}–${max}`, cls: 'param-input-feedback param-input-feedback--attention' }
      }
    }
  } else if (value.trim() !== '' && Number.isFinite(numericValue) && !safe) {
    inputFeedback = { text: 'Sem zona segura configurada', cls: 'param-input-feedback param-input-feedback--neutral' }
  }

  return (
    <section className="panel">
      <h2>Registrar parâmetro</h2>
      <form className="form" onSubmit={onSubmit}>
        <label>
          Parâmetro
          <select value={parameter} onChange={(event) => setParameter(event.target.value as ParameterKey)}>
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
          {inputFeedback && <span className={inputFeedback.cls}>{inputFeedback.text}</span>}
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

      {lastMeasurementFeedback && (
        <div className="insight-box">
          <strong>Resumo do último registro</strong>
          <div className="insight-lines">
            <span>
              {parameterDefinitions.find((d) => d.key === lastMeasurementFeedback.parameter)?.label} em{' '}
              {formatDate(lastMeasurementFeedback.measuredAt)}:{' '}
              {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(lastMeasurementFeedback.value)}
            </span>
            {lastMeasurementFeedback.daysBetween !== null && Number.isFinite(lastMeasurementFeedback.daysBetween) && (
              <span>
                Intervalo:{' '}
                {lastMeasurementFeedback.daysBetween < 1
                  ? `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(lastMeasurementFeedback.daysBetween * 24)} h`
                  : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(lastMeasurementFeedback.daysBetween)} dias`}
              </span>
            )}
            {lastMeasurementFeedback.previousValue !== null && lastMeasurementFeedback.delta !== null && (
              <span>
                Δ vs anterior: {formatSigned(lastMeasurementFeedback.delta, 3)}
                {lastMeasurementFeedback.dailyRate !== null && Number.isFinite(lastMeasurementFeedback.dailyRate) && (
                  <>
                    {' '}
                    · Taxa diária: {formatSigned(lastMeasurementFeedback.dailyRate, 3)}
                    {parameterDefinitions.find((d) => d.key === lastMeasurementFeedback.parameter)?.unit
                      ? ` ${parameterDefinitions.find((d) => d.key === lastMeasurementFeedback.parameter)?.unit}/dia`
                      : ' /dia'}
                  </>
                )}
              </span>
            )}
            {lastMeasurementFeedback.protocolLabel &&
              lastMeasurementFeedback.protocolPerformedAt &&
              lastMeasurementFeedback.deltaSinceProtocol !== null && (
                <span>
                  Desde a última dosagem ({lastMeasurementFeedback.protocolLabel} em{' '}
                  {formatDate(lastMeasurementFeedback.protocolPerformedAt)}): Δ{' '}
                  {formatSigned(lastMeasurementFeedback.deltaSinceProtocol, 3)}
                </span>
              )}
          </div>
        </div>
      )}

      <div className="filters">
        <select value={filterParameter} onChange={(event) => setFilterParameter(event.target.value as 'todos' | ParameterKey)}>
          <option value="todos">Todos os parâmetros</option>
          {parameterDefinitions.map((definition) => (
            <option key={definition.key} value={definition.key}>
              {definition.label}
            </option>
          ))}
        </select>
        <select value={periodDays} onChange={(event) => setPeriodDays(Number(event.target.value) as 7 | 30 | 90 | 365)}>
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
          <option value={365}>Último ano</option>
        </select>
      </div>

      <div className="history">
        {filteredEntries.map((entry) => {
          const definition = parameterDefinitions.find((item) => item.key === entry.parameter)
          const entrySafe = safeZones?.get(entry.parameter) ?? null
          const isOut = entrySafe && (entry.value < entrySafe.min || entry.value > entrySafe.max)
          return (
            <article key={entry.id} className="history-item">
              <div>
                <strong>{definition?.label}</strong>
                <p>{formatDate(entry.measuredAt)}</p>
              </div>
              <div className="history-actions">
                <div className="history-value" style={isOut ? { color: 'var(--danger)' } : {}}>
                  {entry.value} {definition?.unit}
                  {isOut ? ' ⚠' : ''}
                </div>
                <button className="danger-btn" onClick={() => onDeleteEntry(entry.id)}>
                  Apagar
                </button>
              </div>
            </article>
          )
        })}
        {filteredEntries.length === 0 && <p>Nenhuma medição no período.</p>}
      </div>
    </section>
  )
}
