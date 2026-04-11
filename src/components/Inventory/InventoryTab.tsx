import { useState } from 'react'
import CompatibilityCheckPanel from './CompatibilityCheckPanel'
import type { CompatibilityWarning } from '../../lib/compatibilityEngine'
import type { AnimalRiskItem } from '../../hooks/useAnimalsAtRisk'
import type { BioEntry, BioType } from '../../types'

type FaunaSubmenu = BioType

type BioDeepDivePreview = {
  reefCompatible: string | null
  lighting: string | null
  flow: string | null
  aggressionLevel?: string | null
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
  bioNickname: string
  setBioNickname: (value: string) => void
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
  compatibilityWarnings?: CompatibilityWarning[]
  animalsAtRisk?: AnimalRiskItem[]
}

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

const aggressionStatus = (aggressionLevel: string | null | undefined) => {
  if (!aggressionLevel) return { label: '', tone: 'neutral' as const }
  const level = aggressionLevel.toLowerCase()
  if (level.includes('agressi') || level.includes('predador')) return { label: aggressionLevel, tone: 'critical' as const }
  if (level.includes('semi') || level.includes('territorial')) return { label: aggressionLevel, tone: 'attention' as const }
  if (level.includes('pac') || level.includes('docil') || level.includes('dócil')) return { label: aggressionLevel, tone: 'ideal' as const }
  return { label: aggressionLevel, tone: 'neutral' as const }
}

export default function InventoryTab({
  onSubmitBio,
  bioType, setBioType,
  bioName, setBioName,
  bioNameSuggestions,
  bioScientificName, setBioScientificName,
  bioPosition, setBioPosition,
  bioNote, setBioNote,
  bioNickname, setBioNickname,
  fillBioByName,
  isSearchingBio,
  bioEditingId,
  onCancelEditBioEntry,
  bioRequirementState,
  bioRequirementPreview,
  faunaCounts,
  faunaSubmenu, setFaunaSubmenu,
  faunaSearch, setFaunaSearch,
  faunaItems,
  formatDate,
  bioDeepDivePreviewById,
  onOpenBioDetails,
  onStartEditBioEntry,
  onDeleteBioEntry,
  compatibilityWarnings = [],
  animalsAtRisk = [],
}: Props) {
  const [formOpen, setFormOpen] = useState(Boolean(bioEditingId))
  const atRiskIds = new Set(animalsAtRisk.map((a) => a.entryId))

  // Open form automatically when editing
  const isEditing = Boolean(bioEditingId)
  const effectiveFormOpen = isEditing || formOpen

  const fmt = (n: number, d: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: d }).format(n)

  return (
    <section className="inv-root">

      {/* ── Header ── */}
      <div className="inv-header">
        <div>
          <h2 className="inv-title">Inventário</h2>
          <p className="inv-subtitle">{faunaCounts.todos} organismos</p>
        </div>
        <button
          type="button"
          className={`inv-add-btn${effectiveFormOpen && !isEditing ? ' inv-add-btn--open' : ''}`}
          onClick={() => setFormOpen((v) => !v)}
          aria-expanded={effectiveFormOpen}
        >
          {effectiveFormOpen && !isEditing ? '✕' : '＋'} {effectiveFormOpen && !isEditing ? 'Fechar' : 'Adicionar'}
        </button>
      </div>

      {/* ── Stats row ── */}
      <div className="inv-stats">
        {([
          { label: 'Total', value: faunaCounts.todos },
          { label: 'Corais', value: faunaCounts.coral },
          { label: 'Peixes', value: faunaCounts.peixe },
          { label: 'Inverts', value: faunaCounts.invertebrado },
        ] as const).map(({ label, value }) => (
          <div key={label} className="inv-stat-card">
            <span className="inv-stat-label">{label}</span>
            <strong className="inv-stat-value">{value}</strong>
          </div>
        ))}
      </div>

      {/* ── Add / Edit Form ── */}
      {effectiveFormOpen && (
        <div className="inv-form-card">
          <h3 className="inv-form-title">{isEditing ? 'Editar organismo' : 'Novo organismo'}</h3>
          <form className="inv-form" onSubmit={onSubmitBio}>

            {/* Type selector */}
            <div className="inv-type-selector">
              {(['peixe', 'coral', 'invertebrado'] as BioType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`inv-type-btn${bioType === t ? ' inv-type-btn--active' : ''}`}
                  onClick={() => setBioType(t)}
                >
                  {typeIcon(t)} {t === 'peixe' ? 'Peixe' : t === 'coral' ? 'Coral' : 'Invertebrado'}
                </button>
              ))}
            </div>

            {/* Nome + Apelido */}
            <div className="inv-field-row">
              <label className="inv-field">
                <span className="inv-field-label">Nome</span>
                <input
                  type="text"
                  value={bioName}
                  onChange={(e) => setBioName(e.target.value)}
                  onBlur={fillBioByName}
                  placeholder="Nome comum (opcional se tiver apelido)"
                  list="bio-name-suggestions"
                  className="inv-input"
                />
                <datalist id="bio-name-suggestions">
                  {bioNameSuggestions.map((s) => <option key={s} value={s} />)}
                </datalist>
              </label>
              <label className="inv-field">
                <span className="inv-field-label">Apelido</span>
                <input
                  type="text"
                  value={bioNickname}
                  onChange={(e) => setBioNickname(e.target.value)}
                  placeholder="Ex: Nemo, Coral 1..."
                  className="inv-input"
                />
              </label>
            </div>

            <button
              type="button"
              className="inv-lookup-btn"
              onClick={fillBioByName}
              disabled={isSearchingBio}
            >
              {isSearchingBio ? '⏳ Buscando...' : '🔍 Buscar dados da espécie'}
            </button>

            {/* Nome científico + requisitos */}
            <label className="inv-field inv-field--full">
              <span className="inv-field-label">Nome científico</span>
              <input
                type="text"
                value={bioScientificName}
                onChange={(e) => setBioScientificName(e.target.value)}
                className="inv-input"
              />
            </label>

            {bioScientificName.trim() && (
              <div className="inv-requirements">
                {bioRequirementState === 'loading' && <span className="inv-req-loading">Carregando requisitos...</span>}
                {bioRequirementState === 'not_found' && <span className="inv-req-empty">Sem requisitos cadastrados.</span>}
                {bioRequirementState === 'error' && <span className="inv-req-empty">Erro ao carregar requisitos.</span>}
                {bioRequirementState === 'found' && bioRequirementPreview && (
                  <div className="inv-req-badges">
                    {bioRequirementPreview.reefCompatible && (
                      <span className="inv-req-badge">Reef: {bioRequirementPreview.reefCompatible}</span>
                    )}
                    {bioRequirementPreview.tempMinC !== null && bioRequirementPreview.tempMaxC !== null && (
                      <span className="inv-req-badge">🌡 {fmt(bioRequirementPreview.tempMinC, 1)}–{fmt(bioRequirementPreview.tempMaxC, 1)} °C</span>
                    )}
                    {bioRequirementPreview.sgMin !== null && bioRequirementPreview.sgMax !== null && (
                      <span className="inv-req-badge">SG {fmt(bioRequirementPreview.sgMin, 3)}–{fmt(bioRequirementPreview.sgMax, 3)}</span>
                    )}
                    {bioRequirementPreview.dkhMin !== null && bioRequirementPreview.dkhMax !== null && (
                      <span className="inv-req-badge">KH {fmt(bioRequirementPreview.dkhMin, 1)}–{fmt(bioRequirementPreview.dkhMax, 1)}</span>
                    )}
                    {bioRequirementPreview.phMin !== null && bioRequirementPreview.phMax !== null && (
                      <span className="inv-req-badge">pH {fmt(bioRequirementPreview.phMin, 2)}–{fmt(bioRequirementPreview.phMax, 2)}</span>
                    )}
                    {bioRequirementPreview.lighting && (
                      <span className="inv-req-badge">💡 {bioRequirementPreview.lighting}</span>
                    )}
                    {bioRequirementPreview.flow && (
                      <span className="inv-req-badge">🌊 {bioRequirementPreview.flow}</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Posição + Observação */}
            <div className="inv-field-row">
              <label className="inv-field">
                <span className="inv-field-label">Posição no aquário</span>
                <input
                  type="text"
                  value={bioPosition}
                  onChange={(e) => setBioPosition(e.target.value)}
                  placeholder="Ex: fundo, meio, topo"
                  className="inv-input"
                />
              </label>
              <label className="inv-field">
                <span className="inv-field-label">Observação</span>
                <input
                  type="text"
                  value={bioNote}
                  onChange={(e) => setBioNote(e.target.value)}
                  placeholder="Notas livres..."
                  className="inv-input"
                />
              </label>
            </div>

            {!isEditing && <CompatibilityCheckPanel warnings={compatibilityWarnings} />}

            <div className="inv-form-actions">
              <button type="submit" className="inv-save-btn">
                {isEditing ? '✓ Atualizar' : '＋ Salvar organismo'}
              </button>
              {isEditing && (
                <button
                  type="button"
                  className="inv-cancel-btn"
                  onClick={() => { onCancelEditBioEntry(); setFormOpen(false) }}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* ── Filter tabs ── */}
      <div className="inv-filter-tabs">
        {(['peixe', 'coral', 'invertebrado'] as FaunaSubmenu[]).map((t) => {
          const count = t === 'peixe' ? faunaCounts.peixe : t === 'coral' ? faunaCounts.coral : faunaCounts.invertebrado
          return (
            <button
              key={t}
              className={`inv-filter-tab${faunaSubmenu === t ? ' inv-filter-tab--active' : ''}`}
              onClick={() => setFaunaSubmenu(t)}
            >
              {typeIcon(t)} {typeLabel(t)} <span className="inv-filter-count">{count}</span>
            </button>
          )
        })}
      </div>

      {/* ── Search ── */}
      <div className="inv-search-wrap">
        <span className="inv-search-icon">🔍</span>
        <input
          type="text"
          value={faunaSearch}
          onChange={(e) => setFaunaSearch(e.target.value)}
          placeholder={`Buscar ${typeLabel(faunaSubmenu).toLowerCase()}...`}
          className="inv-search-input"
        />
      </div>

      {/* ── Animal grid ── */}
      <div className="inv-grid">
        {faunaItems.map((item) => {
          const preview = bioDeepDivePreviewById.get(item.id) ?? null
          const status = aggressionStatus(preview?.aggressionLevel)
          const isAtRisk = atRiskIds.has(item.id)
          const riskItem = animalsAtRisk.find((a) => a.entryId === item.id)

          return (
            <article
              key={item.id}
              className={`inv-card${isAtRisk ? ' inv-card--risk' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => onOpenBioDetails(item)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenBioDetails(item) }
              }}
            >
              <div className="inv-card-head">
                <span className="inv-card-icon" aria-hidden="true">{typeIcon(item.type)}</span>
                <div className="inv-card-title-block">
                  {item.nickname ? (
                    <>
                      <strong className="inv-card-nickname">{item.nickname}</strong>
                      <span className="inv-card-name">{item.name}</span>
                    </>
                  ) : (
                    <strong className="inv-card-name inv-card-name--main">{item.name}</strong>
                  )}
                </div>
                {isAtRisk && <span className="inv-card-risk-badge">⚠ Em risco</span>}
              </div>

              <div className="inv-card-sci">{item.scientificName || <span style={{ opacity: 0.4 }}>Sem nome científico</span>}</div>

              <div className="inv-card-badges">
                {status.tone !== 'neutral' && status.label && (
                  <span className={`status-badge ${status.tone}`}>{status.label}</span>
                )}
                {item.type === 'coral' ? (
                  <>
                    {preview?.lighting && <span className="status-badge neutral">💡 {preview.lighting}</span>}
                    {preview?.flow && <span className="status-badge neutral">🌊 {preview.flow}</span>}
                  </>
                ) : (
                  preview?.reefCompatible && (
                    <span className="status-badge ideal">Reef: {preview.reefCompatible}</span>
                  )
                )}
              </div>

              {isAtRisk && riskItem && (
                <div className="inv-card-risk-details">
                  {riskItem.violations.map((v) => {
                    const isBelow = v.requiredMin !== null && v.currentValue < v.requiredMin
                    const isAbove = v.requiredMax !== null && v.currentValue > v.requiredMax
                    const diff = isBelow
                      ? fmt(v.requiredMin! - v.currentValue, 2)
                      : isAbove ? fmt(v.currentValue - v.requiredMax!, 2) : null
                    return (
                      <span key={v.parameter} className="status-badge critical">
                        {v.label}: {fmt(v.currentValue, 2)}
                        {diff ? (isBelow ? ` ↓${diff}` : ` ↑${diff}`) : ''}
                      </span>
                    )
                  })}
                </div>
              )}

              <div className="inv-card-footer">
                <span className="inv-card-meta">
                  {item.position || 'Sem posição'} · {formatDate(item.createdAt)}
                </span>
                <div className="inv-card-actions">
                  <button
                    className="inv-btn-edit"
                    onClick={(e) => { e.stopPropagation(); setFormOpen(true); onStartEditBioEntry(item) }}
                  >
                    Editar
                  </button>
                  <button
                    className="inv-btn-delete"
                    onClick={(e) => { e.stopPropagation(); onDeleteBioEntry(item.id) }}
                  >
                    Apagar
                  </button>
                </div>
              </div>
            </article>
          )
        })}
        {faunaItems.length === 0 && (
          <p className="inv-empty">Nenhum organismo cadastrado neste grupo.</p>
        )}
      </div>
    </section>
  )
}
