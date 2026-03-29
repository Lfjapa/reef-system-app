type ParameterKey = string

type ParameterDefinition = {
  key: ParameterKey
  label: string
  unit: string
  min?: number
  max?: number
}

type TankParameterSetting = {
  isCustomEnabled: boolean
  customMin: number | null
  customMax: number | null
}

type AquarioInfo = {
  displayTankLiters: number
  sumpLiters: number
  rockKg: number
}

type Props = {
  parameterDefinitions: ParameterDefinition[]
  safeZones: Map<ParameterKey, { min: number; max: number }>
  safeZonesBase: Map<ParameterKey, { min: number; max: number }>
  settings: Map<ParameterKey, TankParameterSetting>
  onChangeSetting: (parameter: ParameterKey, next: TankParameterSetting) => void
  onCancel: () => void
  canCancel: boolean
  onSave: () => void
  isSaving: boolean
  // Informações físicas do aquário
  displayTankLiters: number
  sumpLiters: number
  rockKg: number
  totalSystemLiters: number
  systemType: string
  onChangeAquarioInfo: (next: AquarioInfo) => void
}

const stepForParameter = (parameter: ParameterKey) => {
  if (parameter === 'salinidade') return 0.001
  if (parameter === 'ph') return 0.01
  if (parameter === 'temperatura') return 0.1
  if (parameter === 'kh') return 0.1
  if (parameter === 'fosfato') return 0.001
  return 1
}

const formatValue = (value: number | null, maximumFractionDigits = 3) => {
  if (value === null || !Number.isFinite(value)) return ''
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits }).format(value)
}

export default function TankSettingsTab({
  parameterDefinitions,
  safeZones,
  safeZonesBase,
  settings,
  onChangeSetting,
  onCancel,
  canCancel,
  onSave,
  isSaving,
  displayTankLiters,
  sumpLiters,
  rockKg,
  totalSystemLiters,
  systemType,
  onChangeAquarioInfo,
}: Props) {
  const rockDisplacementLiters = Math.round(rockKg * 0.5)

  const handleAquarioField = (field: keyof AquarioInfo, raw: string) => {
    const n = parseFloat(raw)
    const value = Number.isFinite(n) && n >= 0 ? n : 0
    onChangeAquarioInfo({
      displayTankLiters: field === 'displayTankLiters' ? value : displayTankLiters,
      sumpLiters: field === 'sumpLiters' ? value : sumpLiters,
      rockKg: field === 'rockKg' ? value : rockKg,
    })
  }

  return (
    <section className="panel">
      <h2>Configurações do meu tanque</h2>

      {/* ── Informações físicas do aquário ── */}
      <div className="aquario-info-section">
        <h3 className="aquario-info-title">Informações do aquário</h3>
        <p className="helper">
          Usadas nos cálculos de dosagem, smart tips e recomendações de troca d'água.
          O tipo do sistema é detectado automaticamente pelo inventário.
        </p>
        <div className="aquario-info-grid">
          <label className="aquario-info-field">
            <span className="bio-modal-k">Display / principal</span>
            <div className="aquario-info-input-row">
              <input
                type="number"
                min={0}
                step={10}
                value={displayTankLiters}
                onChange={(e) => handleAquarioField('displayTankLiters', e.target.value)}
                className="aquario-info-input"
              />
              <span className="aquario-info-unit">L</span>
            </div>
          </label>

          <label className="aquario-info-field">
            <span className="bio-modal-k">Sump</span>
            <div className="aquario-info-input-row">
              <input
                type="number"
                min={0}
                step={5}
                value={sumpLiters}
                onChange={(e) => handleAquarioField('sumpLiters', e.target.value)}
                className="aquario-info-input"
              />
              <span className="aquario-info-unit">L</span>
            </div>
          </label>

          <label className="aquario-info-field">
            <span className="bio-modal-k">Rocha viva</span>
            <div className="aquario-info-input-row">
              <input
                type="number"
                min={0}
                step={1}
                value={rockKg}
                onChange={(e) => handleAquarioField('rockKg', e.target.value)}
                className="aquario-info-input"
              />
              <span className="aquario-info-unit">kg</span>
            </div>
            <small className="aquario-info-hint">≈ {rockDisplacementLiters} L deslocado</small>
          </label>

          <div className="aquario-info-result">
            <span className="bio-modal-k">Volume real estimado</span>
            <strong className="aquario-info-total">≈ {totalSystemLiters} L</strong>
            <small className="aquario-info-hint">
              {displayTankLiters} L display + {sumpLiters} L sump − {rockDisplacementLiters} L rocha
            </small>
          </div>

          <div className="aquario-info-system">
            <span className="bio-modal-k">Perfil do sistema</span>
            <span className="status-badge neutral">{systemType}</span>
            <small className="aquario-info-hint">Detectado pelo inventário</small>
          </div>
        </div>
      </div>

      <p className="helper" style={{ marginTop: '1.5rem' }}>
        Ative o modo personalizado para definir seus próprios limites e evitar alertas incorretos quando você roda um
        sistema fora do padrão.
      </p>

      <div className="cards tank-settings-grid">
        {parameterDefinitions.map((definition) => {
          const base = safeZonesBase.get(definition.key) ?? null
          const current = safeZones.get(definition.key) ?? null
          const setting = settings.get(definition.key) ?? {
            isCustomEnabled: false,
            customMin: null,
            customMax: null,
          }

          const step = stepForParameter(definition.key)
          const baseMin = base?.min ?? definition.min ?? null
          const baseMax = base?.max ?? definition.max ?? null
          const canEditRange = baseMin !== null && baseMax !== null && Number.isFinite(baseMin) && Number.isFinite(baseMax)
          const spread = canEditRange ? Math.max(0.000001, (baseMax as number) - (baseMin as number)) : 0
          const allowedMin = canEditRange ? (baseMin as number) - spread * 0.5 : 0
          const allowedMax = canEditRange ? (baseMax as number) + spread * 0.5 : 0

          const selectedMin =
            setting.isCustomEnabled && setting.customMin !== null ? setting.customMin : baseMin !== null ? baseMin : null
          const selectedMax =
            setting.isCustomEnabled && setting.customMax !== null ? setting.customMax : baseMax !== null ? baseMax : null

          const handleToggle = () => {
            if (setting.isCustomEnabled) {
              onChangeSetting(definition.key, { isCustomEnabled: false, customMin: null, customMax: null })
              return
            }
            onChangeSetting(definition.key, {
              isCustomEnabled: true,
              customMin: baseMin !== null && Number.isFinite(baseMin) ? baseMin : null,
              customMax: baseMax !== null && Number.isFinite(baseMax) ? baseMax : null,
            })
          }

          const updateCustomMin = (next: number | null) => {
            const nextMax =
              setting.customMax !== null && next !== null && setting.customMax < next ? next : setting.customMax
            onChangeSetting(definition.key, {
              ...setting,
              isCustomEnabled: true,
              customMin: next,
              customMax: nextMax,
            })
          }

          const updateCustomMax = (next: number | null) => {
            const nextMin =
              setting.customMin !== null && next !== null && setting.customMin > next ? next : setting.customMin
            onChangeSetting(definition.key, {
              ...setting,
              isCustomEnabled: true,
              customMin: nextMin,
              customMax: next,
            })
          }

          return (
            <article key={definition.key} className="card tank-setting-card">
              <div className="tank-setting-head">
                <strong>{definition.label}</strong>
                <label className="tank-setting-toggle">
                  <input type="checkbox" checked={setting.isCustomEnabled} onChange={handleToggle} />
                  <span>{setting.isCustomEnabled ? 'Definir meus limites' : 'Usar modo automático'}</span>
                </label>
              </div>

              <div className="tank-setting-range">
                <div className="tank-setting-line">
                  <span className="bio-card-muted">Automático:</span>{' '}
                  {baseMin !== null && baseMax !== null ? (
                    <span>
                      {formatValue(baseMin)}–{formatValue(baseMax)}
                      {definition.unit ? ` ${definition.unit}` : ''}
                    </span>
                  ) : (
                    <span>sem faixa</span>
                  )}
                </div>
                <div className="tank-setting-line">
                  <span className="bio-card-muted">Em uso:</span>{' '}
                  {current ? (
                    <span>
                      {formatValue(current.min)}–{formatValue(current.max)}
                      {definition.unit ? ` ${definition.unit}` : ''}
                    </span>
                  ) : (
                    <span>sem faixa</span>
                  )}
                </div>
              </div>

              {setting.isCustomEnabled && (
                <div className="tank-setting-custom">
                  {canEditRange && selectedMin !== null && selectedMax !== null ? (
                    <div className="tank-range">
                      <input
                        type="range"
                        min={allowedMin}
                        max={allowedMax}
                        step={step}
                        value={selectedMin}
                        onChange={(event) => updateCustomMin(Number(event.target.value))}
                      />
                      <input
                        type="range"
                        min={allowedMin}
                        max={allowedMax}
                        step={step}
                        value={selectedMax}
                        onChange={(event) => updateCustomMax(Number(event.target.value))}
                      />
                    </div>
                  ) : null}

                  <div className="tank-setting-inputs">
                    <label>
                      Mínimo
                      <input
                        type="number"
                        step={step}
                        value={setting.customMin ?? ''}
                        onChange={(event) =>
                          updateCustomMin(event.target.value.trim() ? Number(event.target.value) : null)
                        }
                      />
                    </label>
                    <label>
                      Máximo
                      <input
                        type="number"
                        step={step}
                        value={setting.customMax ?? ''}
                        onChange={(event) =>
                          updateCustomMax(event.target.value.trim() ? Number(event.target.value) : null)
                        }
                      />
                    </label>
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </div>

      <div className="tank-settings-actions">
        <button type="button" className="secondary-btn" onClick={onCancel} disabled={!canCancel || isSaving}>
          Cancelar alterações
        </button>
        <button type="button" className="tank-settings-save-btn" onClick={onSave} disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Salvar minhas regras'}
        </button>
      </div>
    </section>
  )
}
