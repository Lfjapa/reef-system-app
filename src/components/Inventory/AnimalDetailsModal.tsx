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

type BioRequirement = {
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

type RequirementState = 'idle' | 'loading' | 'found' | 'not_found' | 'error'

type Props = {
  entry: BioEntry
  catalogEntry: BioCatalogEntry | null
  requirementState: RequirementState
  requirement: BioRequirement | null
  latestValues?: Map<string, number>
  formatDate: (iso: string) => string
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}

export default function AnimalDetailsModal({
  entry,
  catalogEntry,
  requirementState,
  requirement,
  latestValues,
  formatDate,
  onClose,
  onEdit,
  onDelete,
}: Props) {
  const typeLabel = (value: BioType) => {
    if (value === 'peixe') return 'Peixe'
    if (value === 'coral') return 'Coral / anêmona'
    return 'Invertebrado'
  }

  const typeIcon = (value: BioType) => {
    if (value === 'peixe') return '🐠'
    if (value === 'coral') return '🪸'
    return '🦐'
  }

  const formatRange = (min: number | null, max: number | null, options?: Intl.NumberFormatOptions) => {
    if (min === null || max === null) return null
    const nf = new Intl.NumberFormat('pt-BR', options)
    return `${nf.format(min)}–${nf.format(max)}`
  }

  const lighting = requirement?.lighting || null
  const flow = requirement?.flow || null
  const reefCompatible = requirement?.reefCompatible || null

  const paramStatus = (
    paramKey: string,
    reqMin: number | null,
    reqMax: number | null,
  ): 'ok' | 'warn' | 'bad' | null => {
    if (!latestValues || reqMin === null || reqMax === null) return null
    const current = latestValues.get(paramKey)
    if (current === undefined) return null
    if (current >= reqMin && current <= reqMax) return 'ok'
    const deviation =
      current < reqMin ? (reqMin - current) / reqMin : (current - reqMax) / reqMax
    return deviation > 0.1 ? 'bad' : 'warn'
  }

  const statusDot = (status: 'ok' | 'warn' | 'bad' | null) => {
    if (!status) return null
    const color = status === 'ok' ? '#22c55e' : status === 'warn' ? '#f59e0b' : '#ef4444'
    const title = status === 'ok' ? 'Dentro da faixa' : status === 'warn' ? 'Próximo do limite' : 'Fora da faixa'
    return (
      <span
        className="param-status-dot"
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: color,
          marginLeft: 4,
          verticalAlign: 'middle',
        }}
        title={title}
      />
    )
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal bio-modal">
        <div className="modal-head">
          <h3>Detalhes do animal</h3>
          <button type="button" className="secondary-btn" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="bio-modal-header">
          <div className="bio-modal-avatar" aria-hidden="true">
            {typeIcon(entry.type)}
          </div>
          <div className="bio-modal-header-text">
            <div className="bio-modal-name">{entry.name}</div>
            <div className="bio-modal-scientific">{entry.scientificName || catalogEntry?.scientificName || 'Sem nome científico'}</div>
            <div className="bio-modal-tags">
              <span className="status-badge neutral">{typeLabel(entry.type)}</span>
              {reefCompatible ? <span className="status-badge ideal">{reefCompatible}</span> : null}
              {requirement?.difficulty ? (
                <span className={`status-badge ${requirement.difficulty === 'Iniciante' ? 'ideal' : requirement.difficulty === 'Avançado' ? 'critical' : 'attention'}`}>
                  {requirement.difficulty}
                </span>
              ) : null}
              {lighting ? <span className="status-badge neutral">Luz: {lighting}</span> : null}
              {flow ? <span className="status-badge neutral">Fluxo: {flow}</span> : null}
              {requirement?.minTankLiters ? (
                <span className="status-badge neutral">Min: {requirement.minTankLiters} L</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="bio-modal-sections">
          <section className="bio-modal-section">
            <h4>Ficha pessoal</h4>
            <div className="bio-modal-kv">
              <div className="bio-modal-kv-row">
                <span className="bio-modal-k">Entrada</span>
                <span className="bio-modal-v">{formatDate(entry.createdAt)}</span>
              </div>
              <div className="bio-modal-kv-row">
                <span className="bio-modal-k">Posição</span>
                <span className="bio-modal-v">{entry.position || 'Sem posição'}</span>
              </div>
              <div className="bio-modal-kv-row">
                <span className="bio-modal-k">Observação</span>
                <span className="bio-modal-v">{entry.note || 'Sem observação'}</span>
              </div>
            </div>
          </section>

          <section className="bio-modal-section">
            <h4>Perfil químico</h4>
            {requirementState === 'loading' && <div className="bio-modal-muted">Carregando tolerâncias...</div>}
            {requirementState === 'error' && <div className="bio-modal-muted">Não foi possível carregar as tolerâncias.</div>}
            {requirementState === 'not_found' && <div className="bio-modal-muted">Sem tolerâncias cadastradas para esta espécie.</div>}
            {requirementState === 'found' && requirement && (
              <div className="bio-modal-grid">
                <div className="bio-modal-metric">
                  <span className="bio-modal-metric-k">Temperatura</span>
                  <strong className="bio-modal-metric-v">
                    {formatRange(requirement.tempMinC, requirement.tempMaxC, { maximumFractionDigits: 1 }) ?? '—'} °C
                    {statusDot(paramStatus('temperatura', requirement.tempMinC, requirement.tempMaxC))}
                  </strong>
                </div>
                <div className="bio-modal-metric">
                  <span className="bio-modal-metric-k">Salinidade</span>
                  <strong className="bio-modal-metric-v">
                    {formatRange(requirement.sgMin, requirement.sgMax, { maximumFractionDigits: 3 }) ?? '—'} SG
                    {statusDot(paramStatus('salinidade', requirement.sgMin, requirement.sgMax))}
                  </strong>
                </div>
                <div className="bio-modal-metric">
                  <span className="bio-modal-metric-k">pH</span>
                  <strong className="bio-modal-metric-v">
                    {formatRange(requirement.phMin, requirement.phMax, { maximumFractionDigits: 2 }) ?? '—'}
                    {statusDot(paramStatus('ph', requirement.phMin, requirement.phMax))}
                  </strong>
                </div>
                <div className="bio-modal-metric">
                  <span className="bio-modal-metric-k">KH</span>
                  <strong className="bio-modal-metric-v">
                    {formatRange(requirement.dkhMin, requirement.dkhMax, { maximumFractionDigits: 1 }) ?? '—'} dKH
                    {statusDot(paramStatus('kh', requirement.dkhMin, requirement.dkhMax))}
                  </strong>
                </div>
                {requirement.caMin != null && requirement.caMax != null ? (
                  <div className="bio-modal-metric">
                    <span className="bio-modal-metric-k">Cálcio</span>
                    <strong className="bio-modal-metric-v">
                      {formatRange(requirement.caMin, requirement.caMax, { maximumFractionDigits: 0 }) ?? '—'} ppm
                      {statusDot(paramStatus('calcio', requirement.caMin, requirement.caMax))}
                    </strong>
                  </div>
                ) : null}
                {requirement.mgMin != null && requirement.mgMax != null ? (
                  <div className="bio-modal-metric">
                    <span className="bio-modal-metric-k">Magnésio</span>
                    <strong className="bio-modal-metric-v">
                      {formatRange(requirement.mgMin, requirement.mgMax, { maximumFractionDigits: 0 }) ?? '—'} ppm
                      {statusDot(paramStatus('magnesio', requirement.mgMin, requirement.mgMax))}
                    </strong>
                  </div>
                ) : null}
              </div>
            )}
            {requirement?.source ? (
              <div className="bio-modal-source">
                <span className="bio-modal-muted">Fonte: {requirement.source}</span>
                {requirement.sourceUrl ? (
                  <a className="bio-modal-link" href={requirement.sourceUrl} target="_blank" rel="noreferrer">
                    abrir
                  </a>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="bio-modal-section">
            <h4>Compatibilidade e manejo</h4>
            {requirement ? (
              <div className="bio-modal-kv">
                {requirement.aggressionLevel ? (
                  <div className="bio-modal-kv-row">
                    <span className="bio-modal-k">Agressividade</span>
                    <span className={`status-badge ${
                      requirement.aggressionLevel === 'Pacífico' ? 'ideal'
                      : requirement.aggressionLevel === 'Semi-agressivo' ? 'attention'
                      : 'critical'
                    }`}>{requirement.aggressionLevel}</span>
                  </div>
                ) : null}
                {requirement.territoryType ? (
                  <div className="bio-modal-kv-row">
                    <span className="bio-modal-k">Território</span>
                    <span className="bio-modal-v">{requirement.territoryType}</span>
                  </div>
                ) : null}
                {requirement.waterConditions ? (
                  <div className="bio-modal-kv-row">
                    <span className="bio-modal-k">Condições</span>
                    <span className="bio-modal-v">{requirement.waterConditions}</span>
                  </div>
                ) : null}
                {requirement.compatibleSpecies && requirement.compatibleSpecies.length > 0 ? (
                  <div className="bio-modal-kv-row bio-modal-kv-row--wrap">
                    <span className="bio-modal-k">Compatível com</span>
                    <span className="bio-modal-tags">
                      {requirement.compatibleSpecies.map((s) => (
                        <span key={s} className="status-badge ideal">{s}</span>
                      ))}
                    </span>
                  </div>
                ) : null}
                {requirement.predatorRisk && requirement.predatorRisk.length > 0 ? (
                  <div className="bio-modal-kv-row bio-modal-kv-row--wrap">
                    <span className="bio-modal-k">Predadores</span>
                    <span className="bio-modal-tags">
                      {requirement.predatorRisk.map((s) => (
                        <span key={s} className="status-badge critical">{s}</span>
                      ))}
                    </span>
                  </div>
                ) : null}
                {requirement.preyRisk && requirement.preyRisk.length > 0 ? (
                  <div className="bio-modal-kv-row bio-modal-kv-row--wrap">
                    <span className="bio-modal-k">Come / preda</span>
                    <span className="bio-modal-tags">
                      {requirement.preyRisk.map((s) => (
                        <span key={s} className="status-badge attention">{s}</span>
                      ))}
                    </span>
                  </div>
                ) : null}
                {!requirement.aggressionLevel
                  && !requirement.waterConditions
                  && !requirement.territoryType
                  && (!requirement.compatibleSpecies || requirement.compatibleSpecies.length === 0)
                  && (!requirement.predatorRisk || requirement.predatorRisk.length === 0)
                  && (!requirement.preyRisk || requirement.preyRisk.length === 0) ? (
                  <div className="bio-modal-muted">Sem dados de compatibilidade cadastrados.</div>
                ) : null}
              </div>
            ) : (
              <div className="bio-modal-muted">Sem dados de compatibilidade disponíveis.</div>
            )}
          </section>

          {requirement?.behaviorNotes ? (
            <section className="bio-modal-section">
              <h4>Curiosidades e comportamento</h4>
              <div className="bio-modal-muted">{requirement.behaviorNotes}</div>
            </section>
          ) : null}
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onEdit}>
            Editar registro
          </button>
          <button type="button" className="danger-btn" onClick={onDelete}>
            Remover / óbito
          </button>
        </div>
      </div>
    </div>
  )
}
