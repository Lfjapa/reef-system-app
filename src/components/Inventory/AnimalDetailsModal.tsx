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
}

type RequirementState = 'idle' | 'loading' | 'found' | 'not_found' | 'error'

type Props = {
  entry: BioEntry
  catalogEntry: BioCatalogEntry | null
  requirementState: RequirementState
  requirement: BioRequirement | null
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
              {lighting ? <span className="status-badge neutral">Luz: {lighting}</span> : null}
              {flow ? <span className="status-badge neutral">Fluxo: {flow}</span> : null}
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
                  </strong>
                </div>
                <div className="bio-modal-metric">
                  <span className="bio-modal-metric-k">Salinidade</span>
                  <strong className="bio-modal-metric-v">
                    {formatRange(requirement.sgMin, requirement.sgMax, { maximumFractionDigits: 3 }) ?? '—'} SG
                  </strong>
                </div>
                <div className="bio-modal-metric">
                  <span className="bio-modal-metric-k">pH</span>
                  <strong className="bio-modal-metric-v">
                    {formatRange(requirement.phMin, requirement.phMax, { maximumFractionDigits: 2 }) ?? '—'}
                  </strong>
                </div>
                <div className="bio-modal-metric">
                  <span className="bio-modal-metric-k">KH</span>
                  <strong className="bio-modal-metric-v">
                    {formatRange(requirement.dkhMin, requirement.dkhMax, { maximumFractionDigits: 1 }) ?? '—'} dKH
                  </strong>
                </div>
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
            <div className="bio-modal-muted">
              {catalogEntry?.note || 'Sem dados extras de manejo no catálogo.'}
            </div>
            {requirement?.waterConditions ? (
              <div className="bio-modal-muted">Condições: {requirement.waterConditions}</div>
            ) : null}
          </section>
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
