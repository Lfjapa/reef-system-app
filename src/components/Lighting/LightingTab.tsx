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
const PAD_TOP = 14        // breathing room so 100% peak doesn't clip
const CHART_DRAW_H = 130  // drawable chart area
const LABEL_AREA_H = 28   // area below chart for rotated time labels
const TIMELINE_H = PAD_TOP + CHART_DRAW_H + LABEL_AREA_H  // 172
const CHART_BOTTOM = PAD_TOP + CHART_DRAW_H               // y of 0%
const TICK_Y = CHART_BOTTOM + LABEL_AREA_H - 4            // hour labels baseline

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

  // Dynamic scale: use the max value across all channels (min 100 to keep shape)
  const maxVal = Math.max(...sorted.flatMap((p) => [p.uv, p.white, p.blue]), 100)

  const valToY = (val: number) => CHART_BOTTOM - (val / maxVal) * CHART_DRAW_H

  // Build step-line paths for each channel across the 24h axis
  function buildPath(channel: 'uv' | 'white' | 'blue'): string {
    if (sorted.length === 0) return ''
    const totalMins = 24 * 60
    const pts: { x: number; y: number }[] = []

    const firstMinutes = timeToMinutes(sorted[0].time)
    if (firstMinutes > 0) {
      pts.push({ x: 0, y: CHART_BOTTOM })
      pts.push({ x: (firstMinutes / totalMins) * TIMELINE_W, y: CHART_BOTTOM })
    }

    for (let i = 0; i < sorted.length; i++) {
      const phase = sorted[i]
      const nextPhase = sorted[i + 1]
      const xStart = (timeToMinutes(phase.time) / totalMins) * TIMELINE_W
      const xEnd = nextPhase
        ? (timeToMinutes(nextPhase.time) / totalMins) * TIMELINE_W
        : TIMELINE_W
      const y = valToY(phase[channel])
      pts.push({ x: xStart, y })
      pts.push({ x: xEnd, y })
    }

    const lastMinutes = timeToMinutes(sorted[sorted.length - 1].time)
    if (lastMinutes < totalMins) {
      pts.push({ x: TIMELINE_W, y: CHART_BOTTOM })
    }

    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  }

  function buildFill(channel: 'uv' | 'white' | 'blue'): string {
    const line = buildPath(channel)
    if (!line) return ''
    return `${line} L${TIMELINE_W},${CHART_BOTTOM} L0,${CHART_BOTTOM} Z`
  }

  // Hour tick marks every 3 hours
  const hourTicks = [0, 3, 6, 9, 12, 15, 18, 21, 24]

  return (
    <section className="panel">
      <h2>Iluminação (Rampa de LED)</h2>
      <p className="helper">Edite horários e potências reais por canal. 19:30 é o desligamento.</p>

      {/* 24h Timeline */}
      <div className="lighting-timeline-wrap">
        <svg
          viewBox={`0 0 ${TIMELINE_W} ${TIMELINE_H}`}
          className="lighting-timeline"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Chart background */}
          <rect x={0} y={PAD_TOP} width={TIMELINE_W} height={CHART_DRAW_H} fill="#071022" rx={4} />

          {/* Horizontal grid lines at 25%, 50%, 75%, 100% */}
          {[25, 50, 75, 100].map((pct) => {
            const y = valToY((pct / 100) * maxVal)
            return (
              <g key={pct}>
                <line x1={0} y1={y} x2={TIMELINE_W} y2={y} stroke="rgba(148,163,184,0.1)" strokeWidth={1} />
                <text x={4} y={y - 3} fill="rgba(148,163,184,0.5)" fontSize={8}>
                  {Math.round((pct / 100) * maxVal)}
                </text>
              </g>
            )
          })}

          {/* Vertical grid lines at every hour tick */}
          {hourTicks.map((h) => {
            const x = (h / 24) * TIMELINE_W
            const isMajor = h % 6 === 0
            return (
              <line
                key={h}
                x1={x} y1={PAD_TOP}
                x2={x} y2={CHART_BOTTOM}
                stroke={isMajor ? 'rgba(148,163,184,0.18)' : 'rgba(148,163,184,0.07)'}
                strokeWidth={1}
              />
            )
          })}

          {/* Channel fills */}
          <path d={buildFill('blue')} fill="rgba(56, 189, 248, 0.15)" />
          <path d={buildFill('white')} fill="rgba(226, 232, 240, 0.08)" />
          <path d={buildFill('uv')} fill="rgba(168, 85, 247, 0.12)" />

          {/* Channel lines */}
          <path d={buildPath('blue')} fill="none" stroke={CHANNEL_COLORS.blue} strokeWidth={2} />
          <path d={buildPath('white')} fill="none" stroke={CHANNEL_COLORS.white} strokeWidth={2} />
          <path d={buildPath('uv')} fill="none" stroke={CHANNEL_COLORS.uv} strokeWidth={2} />

          {/* Phase markers + rotated time labels */}
          {sorted.map((phase) => {
            const x = (timeToMinutes(phase.time) / (24 * 60)) * TIMELINE_W
            return (
              <g key={phase.id}>
                <line
                  x1={x} y1={PAD_TOP}
                  x2={x} y2={CHART_BOTTOM}
                  stroke="rgba(148,163,184,0.4)"
                  strokeWidth={1}
                  strokeDasharray="3,3"
                />
                <text
                  x={x}
                  y={CHART_BOTTOM + 4}
                  fill="#94a3b8"
                  fontSize={9.5}
                  textAnchor="end"
                  transform={`rotate(-45, ${x}, ${CHART_BOTTOM + 4})`}
                >
                  {phase.time}
                </text>
              </g>
            )
          })}

          {/* Hour tick labels at the very bottom (major ticks only: 0, 6, 12, 18, 24) */}
          {[0, 6, 12, 18, 24].map((h) => {
            const x = (h / 24) * TIMELINE_W
            return (
              <text
                key={h}
                x={x}
                y={TICK_Y}
                fill="rgba(148,163,184,0.6)"
                fontSize={9}
                textAnchor={h === 0 ? 'start' : h === 24 ? 'end' : 'middle'}
              >
                {String(h).padStart(2, '0')}:00
              </text>
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
