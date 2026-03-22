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

type Props = {
  parameterDefinitions: ParameterDefinition[]
  safeZones: Map<ParameterKey, { min: number; max: number }>
  safeZonesBase: Map<ParameterKey, { min: number; max: number }>
  settings: Map<ParameterKey, TankParameterSetting>
  onChangeSetting: (parameter: ParameterKey, next: TankParameterSetting) => void
  onSave: () => void
  isSaving: boolean
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
  onSave,
  isSaving,
}: Props) {
  return (
    <section className="panel">
      <h2>Configurações do meu tanque</h2>
      <p className="helper">
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

      <button type="button" className="full" onClick={onSave} disabled={isSaving}>
        {isSaving ? 'Salvando...' : 'Salvar minhas regras'}
      </button>
    </section>
  )
}

