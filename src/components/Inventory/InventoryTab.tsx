type BioType = 'peixe' | 'coral' | 'invertebrado'
type FaunaSubmenu = BioType

type BioEntry = {
  id: string
  type: BioType
  name: string
  scientificName: string
  position: string
  note: string
  createdAt: string
}

type BioDeepDivePreview = {
  reefCompatible: string | null
  lighting: string | null
  flow: string | null
}

type FaunaCounts = {
  todos: number
  peixe: number
  coral: number
  invertebrado: number
}

type Props = {
  onSubmitBio: (event: React.FormEvent<HTMLFormElement>) => void
  bioType: BioType
  setBioType: (value: BioType) => void
  bioName: string
  setBioName: (value: string) => void
  bioNameSuggestions: string[]
  bioScientificName: string
  setBioScientificName: (value: string) => void
  bioPosition: string
  setBioPosition: (value: string) => void
  bioNote: string
  setBioNote: (value: string) => void
  fillBioByName: () => void
  isSearchingBio: boolean
  bioEditingId: string | null
  onCancelEditBioEntry: () => void
  bioRequirementState: 'idle' | 'loading' | 'found' | 'not_found' | 'error'
  bioRequirementPreview: {
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
  } | null
  faunaCounts: FaunaCounts
  faunaSubmenu: FaunaSubmenu
  setFaunaSubmenu: (value: FaunaSubmenu) => void
  faunaSearch: string
  setFaunaSearch: (value: string) => void
  faunaItems: BioEntry[]
  formatDate: (iso: string) => string
  bioDeepDivePreviewById: Map<string, BioDeepDivePreview>
  onOpenBioDetails: (entry: BioEntry) => void
  onStartEditBioEntry: (entry: BioEntry) => void
  onDeleteBioEntry: (entryId: string) => void
}

export default function InventoryTab({
  onSubmitBio,
  bioType,
  setBioType,
  bioName,
  setBioName,
  bioNameSuggestions,
  bioScientificName,
  setBioScientificName,
  bioPosition,
  setBioPosition,
  bioNote,
  setBioNote,
  fillBioByName,
  isSearchingBio,
  bioEditingId,
  onCancelEditBioEntry,
  bioRequirementState,
  bioRequirementPreview,
  faunaCounts,
  faunaSubmenu,
  setFaunaSubmenu,
  faunaSearch,
  setFaunaSearch,
  faunaItems,
  formatDate,
  bioDeepDivePreviewById,
  onOpenBioDetails,
  onStartEditBioEntry,
  onDeleteBioEntry,
}: Props) {
  const typeLabel = (value: BioType) => {
    if (value === 'peixe') return 'Peixes'
    if (value === 'coral') return 'Corais e anêmonas'
    return 'Equipe de limpeza / inverts'
  }

  const typeIcon = (value: BioType) => {
    if (value === 'peixe') return '🐠'
    if (value === 'coral') return '🪸'
    return '🦐'
  }

  const statusFromNote = (note: string) => {
    const normalized = note.toLowerCase()
    if (normalized.includes('agressivo') || normalized.includes('predador')) {
      return { label: 'Atenção', tone: 'attention' as const }
    }
    if (normalized.includes('semi-agressivo') || normalized.includes('territorial')) {
      return { label: 'Semi-agressivo', tone: 'attention' as const }
    }
    if (normalized.includes('pacífico') || normalized.includes('pacifico')) {
      return { label: 'Pacífico', tone: 'ideal' as const }
    }
    if (normalized.includes('difícil') || normalized.includes('dificil')) {
      return { label: 'Difícil', tone: 'attention' as const }
    }
    return { label: 'Sem status', tone: 'neutral' as const }
  }

  const renderKeyBadges = (entry: BioEntry, preview: BioDeepDivePreview | null) => {
    if (!preview) return null
    if (entry.type === 'coral') {
      if (!preview.lighting && !preview.flow) {
        return (
          <div className="bio-card-badges">
            <span className="status-badge neutral">Sem requisitos</span>
          </div>
        )
      }
      return (
        <div className="bio-card-badges">
          {preview.lighting ? <span className="status-badge neutral">Luz: {preview.lighting}</span> : null}
          {preview.flow ? <span className="status-badge neutral">Fluxo: {preview.flow}</span> : null}
        </div>
      )
    }
    return (
      <div className="bio-card-badges">
        <span className={`status-badge ${preview.reefCompatible ? 'ideal' : 'neutral'}`}>
          Reef: {preview.reefCompatible || 'sem dado'}
        </span>
      </div>
    )
  }

  return (
    <section className="panel">
      <h2>Inventário biológico</h2>
      <form className="form" onSubmit={onSubmitBio}>
        <label>
          Tipo
          <select value={bioType} onChange={(event) => setBioType(event.target.value as BioType)}>
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
            onBlur={fillBioByName}
            placeholder="Nome comum ou científico (pode digitar parcial)"
            list="bio-name-suggestions"
          />
          <datalist id="bio-name-suggestions">
            {bioNameSuggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        </label>
        <p className="helper full">
          Ao digitar o nome, o sistema tenta completar nome científico, tipo, posição e observação automaticamente.
        </p>
        <button
          type="button"
          className="secondary-btn full"
          onClick={fillBioByName}
          disabled={isSearchingBio}
        >
          {isSearchingBio ? 'Buscando dados...' : 'Buscar dados do nome'}
        </button>
        <label>
          Nome científico
          <input type="text" value={bioScientificName} onChange={(event) => setBioScientificName(event.target.value)} />
        </label>
        {bioScientificName.trim() && (
          <div className="helper full">
            {bioRequirementState === 'loading' && <span>Carregando requisitos da espécie...</span>}
            {bioRequirementState === 'error' && <span>Não foi possível carregar os requisitos da espécie.</span>}
            {bioRequirementState === 'not_found' && <span>Sem requisitos cadastrados para esta espécie.</span>}
            {bioRequirementState === 'found' && bioRequirementPreview && (
              <span>
                {bioRequirementPreview.reefCompatible ? `Reef: ${bioRequirementPreview.reefCompatible}` : 'Reef: sem dado'}
                {bioRequirementPreview.tempMinC !== null && bioRequirementPreview.tempMaxC !== null
                  ? ` · Temp: ${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(bioRequirementPreview.tempMinC)}–${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(bioRequirementPreview.tempMaxC)} °C`
                  : ''}
                {bioRequirementPreview.sgMin !== null && bioRequirementPreview.sgMax !== null
                  ? ` · SG: ${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(bioRequirementPreview.sgMin)}–${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(bioRequirementPreview.sgMax)}`
                  : ''}
                {bioRequirementPreview.dkhMin !== null && bioRequirementPreview.dkhMax !== null
                  ? ` · KH: ${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(bioRequirementPreview.dkhMin)}–${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(bioRequirementPreview.dkhMax)} dKH`
                  : ''}
                {bioRequirementPreview.phMin !== null && bioRequirementPreview.phMax !== null
                  ? ` · pH: ${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(bioRequirementPreview.phMin)}–${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(bioRequirementPreview.phMax)}`
                  : ''}
                {bioRequirementPreview.lighting ? ` · Luz: ${bioRequirementPreview.lighting}` : ''}
                {bioRequirementPreview.flow ? ` · Fluxo: ${bioRequirementPreview.flow}` : ''}
              </span>
            )}
          </div>
        )}
        <label>
          Posição no aquário
          <input type="text" value={bioPosition} onChange={(event) => setBioPosition(event.target.value)} />
        </label>
        <label className="full">
          Observação
          <input type="text" value={bioNote} onChange={(event) => setBioNote(event.target.value)} />
        </label>
        <button type="submit">{bioEditingId ? 'Atualizar organismo' : 'Salvar organismo'}</button>
        {bioEditingId && (
          <button type="button" className="secondary-btn full" onClick={onCancelEditBioEntry}>
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
        <button className={faunaSubmenu === 'peixe' ? 'active' : ''} onClick={() => setFaunaSubmenu('peixe')}>
          Peixes ({faunaCounts.peixe})
        </button>
        <button className={faunaSubmenu === 'coral' ? 'active' : ''} onClick={() => setFaunaSubmenu('coral')}>
          Corais e anêmonas ({faunaCounts.coral})
        </button>
        <button
          className={faunaSubmenu === 'invertebrado' ? 'active' : ''}
          onClick={() => setFaunaSubmenu('invertebrado')}
        >
          Equipe de limpeza / inverts ({faunaCounts.invertebrado})
        </button>
      </div>

      <label className="fauna-search">
        Buscar {typeLabel(faunaSubmenu).toLowerCase()}
        <input
          type="text"
          value={faunaSearch}
          onChange={(event) => setFaunaSearch(event.target.value)}
          placeholder="Nome comum ou científico"
        />
      </label>

      <div className="cards bio-inventory-grid">
        {faunaItems.map((item) => {
          const status = statusFromNote(item.note || '')
          const preview = bioDeepDivePreviewById.get(item.id) ?? null
          return (
            <article
              key={item.id}
              className="bio-card bio-card-clickable"
              role="button"
              tabIndex={0}
              onClick={() => onOpenBioDetails(item)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onOpenBioDetails(item)
                }
              }}
            >
              <div className="bio-card-head">
                <div className="bio-card-icon" aria-hidden="true">
                  {typeIcon(item.type)}
                </div>
                <div className="bio-card-title">
                  <strong>{item.name}</strong>
                  <div className={`status-badge ${status.tone}`}>{status.label}</div>
                </div>
              </div>
              <div className="bio-card-meta">
                <div className="bio-card-line">
                  <span className="bio-card-muted">{item.scientificName || 'Sem nome científico'}</span>
                </div>
                {renderKeyBadges(item, preview)}
                <div className="bio-card-line">
                  <span className="bio-card-muted">
                    {item.position || 'Sem posição'} · {formatDate(item.createdAt)}
                  </span>
                </div>
              </div>
              <div className="bio-card-actions">
                <button
                  className="secondary-btn"
                  onClick={(event) => {
                    event.stopPropagation()
                    onStartEditBioEntry(item)
                  }}
                >
                  Editar
                </button>
                <button
                  className="danger-btn"
                  onClick={(event) => {
                    event.stopPropagation()
                    onDeleteBioEntry(item.id)
                  }}
                >
                  Apagar
                </button>
              </div>
            </article>
          )
        })}
        {faunaItems.length === 0 && <p>Nenhum organismo cadastrado neste grupo.</p>}
      </div>
    </section>
  )
}
