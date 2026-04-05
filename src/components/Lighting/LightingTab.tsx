type LightingPhase = {
  id: string
  name: string
  time: string
  uv: number
  white: number
  blue: number
}

type Props = {
  lightingPhases: LightingPhase[]
  timeToMinutes: (time: string) => number
  openEditLightingModal: (phase: LightingPhase) => void
  isLightingModalOpen: boolean
  closeLightingModal: () => void
  lightingEditName: string
  setLightingEditName: (next: string) => void
  lightingEditTime: string
  setLightingEditTime: (next: string) => void
  lightingEditUv: string
  setLightingEditUv: (next: string) => void
  lightingEditWhite: string
  setLightingEditWhite: (next: string) => void
  lightingEditBlue: string
  setLightingEditBlue: (next: string) => void
  onSaveLightingPhase: () => void
}

const TIMELINE_W = 700
const TIMELINE_H = 80
const LABEL_H = 14
const CHART_H = TIMELINE_H - LABEL_H

// Colors for each channel
const CHANNEL_COLORS = {
  uv: '#a855f7',
  white: '#e2e8f0',
  blue: '#38bdf8',
}

export default function LightingTab({
  lightingPhases,
  timeToMinutes,
  openEditLightingModal,
  isLightingModalOpen,
  closeLightingModal,
  lightingEditName,
  setLightingEditName,
  lightingEditTime,
  setLightingEditTime,
  lightingEditUv,
  setLightingEditUv,
  lightingEditWhite,
  setLightingEditWhite,
  lightingEditBlue,
  setLightingEditBlue,
  onSaveLightingPhase,
}: Props) {
  const sorted = lightingPhases.slice().sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))

  // Build step-line paths for each channel across the 24h axis
  // Between phases, intensity is the value at the start phase
  // After the last phase, assume 0 (off)
  function buildPath(channel: 'uv' | 'white' | 'blue'): string {
    if (sorted.length === 0) return ''
    const totalMins = 24 * 60
    const pts: { x: number; y: number }[] = []

    // Start at 0 with value 0 before first phase
    const firstMinutes = timeToMinutes(sorted[0].time)
    if (firstMinutes > 0) {
      pts.push({ x: 0, y: CHART_H })
      pts.push({ x: (firstMinutes / totalMins) * TIMELINE_W, y: CHART_H })
    }

    for (let i = 0; i < sorted.length; i++) {
      const phase = sorted[i]
      const nextPhase = sorted[i + 1]
      const xStart = (timeToMinutes(phase.time) / totalMins) * TIMELINE_W
      const xEnd = nextPhase
        ? (timeToMinutes(nextPhase.time) / totalMins) * TIMELINE_W
        : TIMELINE_W
      const val = phase[channel]
      const y = CHART_H - (val / 100) * CHART_H

      pts.push({ x: xStart, y })
      pts.push({ x: xEnd, y })
    }

    // End at 0 after last phase
    const lastMinutes = timeToMinutes(sorted[sorted.length - 1].time)
    if (lastMinutes < totalMins) {
      pts.push({ x: TIMELINE_W, y: CHART_H })
    }

    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  }

  // Build fill path (close bottom)
  function buildFill(channel: 'uv' | 'white' | 'blue'): string {
    const line = buildPath(channel)
    if (!line) return ''
    return `${line} L${TIMELINE_W},${CHART_H} L0,${CHART_H} Z`
  }

  // Hour tick labels: 0, 6, 12, 18, 24
  const hourTicks = [0, 6, 12, 18, 24]

  return (
    <section className="panel">
      <h2>Iluminação (Rampa de LED)</h2>
      <p className="helper">Edite horários e potências reais por canal. 19:30 é o desligamento.</p>

      {/* 24h Timeline */}
      <div className="lighting-timeline-wrap">
        <div className="lighting-timeline-labels">
          {hourTicks.map((h) => (
            <span key={h}>{String(h).padStart(2, '0')}:00</span>
          ))}
        </div>
        <svg
          viewBox={`0 0 ${TIMELINE_W} ${TIMELINE_H}`}
          className="lighting-timeline"
          preserveAspectRatio="none"
        >
          {/* Background grid lines */}
          {hourTicks.map((h) => {
            const x = (h / 24) * TIMELINE_W
            return (
              <line
                key={h}
                x1={x}
                y1={0}
                x2={x}
                y2={CHART_H}
                stroke="rgba(148,163,184,0.12)"
                strokeWidth={1}
              />
            )
          })}

          {/* Channel fills */}
          <path d={buildFill('blue')} fill="rgba(56, 189, 248, 0.15)" />
          <path d={buildFill('white')} fill="rgba(226, 232, 240, 0.08)" />
          <path d={buildFill('uv')} fill="rgba(168, 85, 247, 0.12)" />

          {/* Channel lines */}
          <path d={buildPath('blue')} fill="none" stroke={CHANNEL_COLORS.blue} strokeWidth={1.5} />
          <path d={buildPath('white')} fill="none" stroke={CHANNEL_COLORS.white} strokeWidth={1.5} />
          <path d={buildPath('uv')} fill="none" stroke={CHANNEL_COLORS.uv} strokeWidth={1.5} />

          {/* Phase markers */}
          {sorted.map((phase) => {
            const x = (timeToMinutes(phase.time) / (24 * 60)) * TIMELINE_W
            return (
              <g key={phase.id}>
                <line
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={CHART_H}
                  stroke="rgba(148,163,184,0.35)"
                  strokeWidth={1}
                  strokeDasharray="2,2"
                />
                <text x={x + 3} y={10} fill="#94a3b8" fontSize={9}>
                  {phase.time}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="lighting-timeline-legend">
          {(['uv', 'white', 'blue'] as const).map((ch) => (
            <span key={ch} className="lighting-timeline-legend-item">
              <span className="lighting-timeline-legend-dot" style={{ backgroundColor: CHANNEL_COLORS[ch] }} />
              {ch === 'uv' ? 'UV' : ch === 'white' ? 'Branco' : 'Azul'}
            </span>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Fase</th>
              <th>Horário</th>
              <th>R (UV)</th>
              <th>G (Branco)</th>
              <th>B (Azul)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((phase) => (
              <tr key={phase.id}>
                <td>{phase.name}</td>
                <td>{phase.time}</td>
                <td>
                  <span style={{ color: CHANNEL_COLORS.uv, fontWeight: 700 }}>{phase.uv}</span>
                </td>
                <td>
                  <span style={{ color: CHANNEL_COLORS.white, fontWeight: 700 }}>{phase.white}</span>
                </td>
                <td>
                  <span style={{ color: CHANNEL_COLORS.blue, fontWeight: 700 }}>{phase.blue}</span>
                </td>
                <td className="table-actions">
                  <button className="secondary-btn" onClick={() => openEditLightingModal(phase)}>
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isLightingModalOpen && (
        <div className="modal-backdrop" onClick={closeLightingModal}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <h3>Editar fase</h3>
              <button className="secondary-btn" onClick={closeLightingModal}>
                Fechar
              </button>
            </div>

            <label className="fauna-search">
              Nome da fase
              <input type="text" value={lightingEditName} onChange={(event) => setLightingEditName(event.target.value)} />
            </label>

            <div className="protocol-dose">
              <label>
                Horário
                <input type="time" value={lightingEditTime} onChange={(event) => setLightingEditTime(event.target.value)} />
              </label>
              <label>
                UV
                <input type="number" value={lightingEditUv} onChange={(event) => setLightingEditUv(event.target.value)} />
              </label>
              <label>
                Branco
                <input
                  type="number"
                  value={lightingEditWhite}
                  onChange={(event) => setLightingEditWhite(event.target.value)}
                />
              </label>
              <label>
                Azul
                <input type="number" value={lightingEditBlue} onChange={(event) => setLightingEditBlue(event.target.value)} />
              </label>
            </div>

            <div className="modal-actions">
              <button className="secondary-btn" onClick={onSaveLightingPhase}>
                Salvar
              </button>
              <button className="danger-btn" onClick={closeLightingModal}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
