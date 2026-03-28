import { useState } from 'react'

type Tab = 'kh' | 'calcio' | 'magnesio' | 'salinidade'

type Props = {
  latestValues: Map<string, number>
  tankVolumeLiters: number
  onTankVolumeChange?: (vol: number) => void
  onClose: () => void
}

const TAB_LABELS: Record<Tab, string> = {
  kh: 'KH',
  calcio: 'Cálcio',
  magnesio: 'Magnésio',
  salinidade: 'Salinidade',
}

function computeDose(
  tab: Tab,
  current: number,
  target: number,
  volume: number,
): { amount: number; unit: string; warning: string | null } | null {
  const diff = target - current
  if (!Number.isFinite(diff) || diff <= 0 || volume <= 0) return null

  if (tab === 'kh') {
    // ~2 ml of standard 2-part Part B per 1 dKH per 100L
    const dose = diff * (volume / 100) * 2
    const safeMax = volume * 0.1
    return {
      amount: Math.round(dose * 10) / 10,
      unit: 'ml (2-partes)',
      warning:
        dose > safeMax
          ? `Dose elevada (${Math.round(dose)} ml). Divida em ${Math.ceil(dose / safeMax)} adições diárias de ~${Math.round(dose / Math.ceil(dose / safeMax))} ml para evitar choque osmótico.`
          : null,
    }
  }
  if (tab === 'calcio') {
    // ~0.4 g CaCl2 per 1 ppm per 100L
    const dose = diff * (volume / 100) * 0.4
    const safeMax = volume * 0.5
    return {
      amount: Math.round(dose * 10) / 10,
      unit: 'g (cloreto de cálcio)',
      warning:
        dose > safeMax
          ? `Dose elevada. Adicione no máximo ${Math.round(safeMax)} g por dia.`
          : null,
    }
  }
  if (tab === 'magnesio') {
    // ~0.6 g MgSO4 per 1 ppm per 100L
    const dose = diff * (volume / 100) * 0.6
    const safeMax = volume * 2
    return {
      amount: Math.round(dose * 10) / 10,
      unit: 'g (sulfato de magnésio)',
      warning:
        dose > safeMax
          ? `Dose elevada. Adicione no máximo ${Math.round(safeMax)} g por dia.`
          : null,
    }
  }
  if (tab === 'salinidade') {
    // diff is in SG units — raise by 0.001 SG per 100L ≈ 1.7 g salt
    const dose = diff * 1000 * (volume / 100) * 1.7
    return {
      amount: Math.round(dose),
      unit: 'g (sal sintético)',
      warning:
        diff > 0.002
          ? `Variação grande de salinidade. Adicione aos poucos e monitore a cada hora.`
          : null,
    }
  }
  return null
}

export default function DosingCalculatorModal({ latestValues, tankVolumeLiters, onTankVolumeChange, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('kh')
  const [volume, setVolume] = useState<string>(String(tankVolumeLiters))
  const [current, setCurrent] = useState<string>('')
  const [target, setTarget] = useState<string>('')

  const paramKey: Record<Tab, string> = {
    kh: 'kh',
    calcio: 'calcio',
    magnesio: 'magnesio',
    salinidade: 'salinidade',
  }

  const units: Record<Tab, string> = {
    kh: 'dKH',
    calcio: 'ppm',
    magnesio: 'ppm',
    salinidade: 'sg',
  }

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab)
    const latest = latestValues.get(paramKey[tab])
    setCurrent(latest !== undefined ? String(latest) : '')
    setTarget('')
  }

  const prefillCurrent = () => {
    const latest = latestValues.get(paramKey[activeTab])
    if (latest !== undefined) setCurrent(String(latest))
  }

  const currentNum = parseFloat(current.replace(',', '.'))
  const targetNum = parseFloat(target.replace(',', '.'))
  const volumeNum = parseFloat(volume.replace(',', '.'))

  const result =
    Number.isFinite(currentNum) && Number.isFinite(targetNum) && Number.isFinite(volumeNum)
      ? computeDose(activeTab, currentNum, targetNum, volumeNum)
      : null

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(v)

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-head">
          <h3>Calculadora de Dosagem</h3>
          <button type="button" className="secondary-btn" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="dosing-tabs">
          {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? 'tab-btn tab-btn--active' : 'tab-btn'}
              onClick={() => handleTabChange(tab)}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        <div className="dosing-form">
          <div className="field-row">
            <label>Volume do aquário (L)</label>
            <input
              type="number"
              value={volume}
              onChange={(e) => {
                setVolume(e.target.value)
                const n = parseFloat(e.target.value)
                if (Number.isFinite(n) && n > 0) onTankVolumeChange?.(n)
              }}
              min={1}
              step={10}
            />
          </div>

          <div className="field-row">
            <label>
              Valor atual ({units[activeTab]})
              {latestValues.has(paramKey[activeTab]) && (
                <button type="button" className="link-btn" onClick={prefillCurrent}>
                  usar medição atual
                </button>
              )}
            </label>
            <input
              type="number"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder={`ex: ${activeTab === 'kh' ? '7' : activeTab === 'calcio' ? '420' : activeTab === 'magnesio' ? '1250' : '1.024'}`}
              step={activeTab === 'salinidade' ? '0.001' : '1'}
            />
          </div>

          <div className="field-row">
            <label>Valor alvo ({units[activeTab]})</label>
            <input
              type="number"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={`ex: ${activeTab === 'kh' ? '8.5' : activeTab === 'calcio' ? '450' : activeTab === 'magnesio' ? '1350' : '1.026'}`}
              step={activeTab === 'salinidade' ? '0.001' : '1'}
            />
          </div>
        </div>

        {result && (
          <div className="dosing-result">
            <div className="dosing-result-amount">
              Adicionar: <strong>{fmt(result.amount)} {result.unit}</strong>
            </div>
            {result.warning && (
              <div className="dosing-result-warning">{result.warning}</div>
            )}
            <p className="dosing-result-note">
              Fórmula baseada em volumes de aquário padrão. Meça novamente após 24h para confirmar.
            </p>
          </div>
        )}

        {Number.isFinite(currentNum) && Number.isFinite(targetNum) && targetNum <= currentNum && (
          <div className="dosing-result">
            <p className="dosing-result-note">
              O valor alvo é igual ou menor que o atual. Para reduzir {TAB_LABELS[activeTab]}, realize uma troca parcial de água.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
