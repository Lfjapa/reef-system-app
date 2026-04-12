import { useState, useRef, type MouseEvent } from 'react'
import HealthScoreCircle from './HealthScoreCircle'
import type { SmartTip } from '../../hooks/useSmartTips'
import type { AnimalRiskItem } from '../../hooks/useAnimalsAtRisk'
import type { TrendArrow, ParameterDefinition, ParameterEntry, ParameterInsight } from '../../types'

type LatestByParameterItem = {
  definition: ParameterDefinition
  latest?: ParameterEntry
}

type ChartPoint = { x: number; y: number }

type ChartLane = {
  key: string
  label: string
  color: string
  path: string | null
  points: ChartPoint[]
  laneTop: number
  laneHeight: number
  lanePath: string | null
  lanePoints: ChartPoint[]
  safeBand: { y: number; height: number } | null
  safeBandInLane: { y: number; height: number } | null
}

type ProtocolDefinition = {
  key: string
  label: string
}

type ProtocolCheck = {
  checkedAt: string
}

type ProtocolDueItem = {
  definition: ProtocolDefinition
  doseLabel: string
  latest: ProtocolCheck | null
}

// Primary parameters shown as hero cards
const HERO_PARAMS = new Set(['kh', 'ca', 'mg', 'temperature', 'salinity', 'ph'])

const arrowSymbol: Record<TrendArrow, string> = {
  up: '↑',
  down: '↓',
  flat: '→',
}

type Props = {
  latestByParameter: LatestByParameterItem[]
  parameterInsights: Map<string, ParameterInsight>
  safeZones: Map<string, { min: number; max: number }>
  cloudConsumptionRates: Map<string, number>
  formatSigned: (value: number, maximumFractionDigits: number) => string
  arrowSymbol: Record<TrendArrow, string>
  dashboardPeriodDays: 7 | 30 | 90 | 365
  setDashboardPeriodDays: (next: 7 | 30 | 90 | 365) => void
  chartPaths: ChartLane[]
  dashboardAlertCards: string[]
  dashboardInsightCards: string[]
  bottleForecastCards: Array<{ label: string; daysRemaining: number; mlPerDay: number; mlRemaining: number }>
  dayLabel: string
  protocolsDueToday: ProtocolDueItem[]
  formatDate: (iso: string) => string
  onToggleProtocolCheck: (protocolKey: string, dayIndex: number) => void
  todayProtocolDayIndex: number
  smartTips?: SmartTip[]
  animalsAtRisk?: AnimalRiskItem[]
  tankInfo: {
    name: string
    volumeLiters: number
    systemType: string
    tankAgeMonths?: number
  }
  onNavigate: (tab: 'parametros' | 'protocolos' | 'inventario' | 'configuracoes') => void
  tankHealthScore: number
}

type ChartTooltip = { x: number; y: number; label: string } | null

function timeAgoLabel(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const diffH = Math.round(diffMs / 3600000)
  if (diffH < 1) return 'Há menos de 1h'
  if (diffH < 24) return `Há ${diffH}h`
  const diffD = Math.round(diffH / 24)
  return `Há ${diffD}d`
}

export default function DashboardTab({
  latestByParameter,
  parameterInsights,
  dashboardPeriodDays,
  setDashboardPeriodDays,
  chartPaths,
  dashboardAlertCards,
  dashboardInsightCards,
  bottleForecastCards,
  dayLabel,
  protocolsDueToday,
  formatDate,
  onToggleProtocolCheck,
  todayProtocolDayIndex,
  smartTips = [],
  animalsAtRisk = [],
  tankInfo,
  onNavigate,
  tankHealthScore,
}: Props) {
  const [tooltip, setTooltip] = useState<ChartTooltip>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const withData = latestByParameter
    .filter(({ latest }) => Boolean(latest))
    .sort((a, b) => {
      const aTime = a.latest ? new Date(a.latest.measuredAt).getTime() : 0
      const bTime = b.latest ? new Date(b.latest.measuredAt).getTime() : 0
      return bTime - aTime
    })

  const criticalTips = smartTips.filter((t) => t.severity === 'critical')
  const warningTips = smartTips.filter((t) => t.severity === 'warning')
  const infoTips = smartTips.filter((t) => t.severity === 'info')

  const mostRecentMeasuredAt =
    withData.length > 0 && withData[0].latest ? withData[0].latest.measuredAt : null

  function renderCurrentParamCard({ definition, latest }: LatestByParameterItem) {
    const insight = parameterInsights.get(definition.key)
    const isHero = HERO_PARAMS.has(definition.key)
    const badgeClass =
      insight?.badge === 'Ideal'
        ? 'ideal'
        : insight?.badge === 'Atenção'
          ? 'attention'
          : insight?.badge === 'Crítico'
            ? 'critical'
            : 'neutral'

    return (
      <article
        key={definition.key}
        className={`rf-param-card rf-param-card--${badgeClass}${isHero ? ' rf-param-card--hero' : ''}`}
      >
        <span className="rf-param-label">{definition.label}</span>
        <div className="rf-param-value-row">
          <strong className="rf-param-value">
            {latest ? latest.value : '—'}
          </strong>
          {definition.unit && latest && (
            <span className="rf-param-unit">{definition.unit}</span>
          )}
          {insight && (
            <span className={`rf-param-arrow rf-param-arrow--${insight.arrow}`}>
              {arrowSymbol[insight.arrow]}
            </span>
          )}
        </div>
        {insight && insight.badge !== 'Sem faixa' && latest && (
          <span className={`status-badge ${badgeClass}`}>{insight.badge}</span>
        )}
      </article>
    )
  }

  function handleSvgMouseMove(event: MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current
    if (!svg || chartPaths.length === 0) return
    const rect = svg.getBoundingClientRect()
    const relX = ((event.clientX - rect.left) / rect.width) * 320
    let best: ChartTooltip = null
    let bestDist = Infinity
    for (const lane of chartPaths) {
      for (const pt of lane.points) {
        const d = Math.abs(pt.x - relX)
        if (d < bestDist && d < 12) {
          bestDist = d
          best = {
            x: (pt.x / 320) * rect.width + rect.left - rect.left,
            y: pt.y,
            label: lane.label,
          }
        }
      }
    }
    setTooltip(best)
  }

  const yLabels: { y: number; text: string }[] = []
  if (chartPaths.length > 0) {
    for (const pct of [0, 25, 50, 75, 100]) {
      yLabels.push({ y: (pct / 100) * 120, text: `${100 - pct}%` })
    }
  }

  const quickActions = [
    { label: 'Testar', icon: '🧪', tab: 'parametros' as const },
    { label: 'TPA', icon: '💧', tab: 'protocolos' as const },
    { label: 'Animal', icon: '🐟', tab: 'inventario' as const },
    { label: 'Ajustes', icon: '⚙️', tab: 'configuracoes' as const },
  ]

  return (
    <section className="dashboard-root">

      {/* ── Zone 1: Aquarium Hero Card ── */}
      <div className="dashboard-hero-card">
        <div className="dashboard-hero-bg" aria-hidden="true" />
        <div className="dashboard-hero-content">
          <div className="dashboard-hero-info">
            <h2 className="dashboard-hero-name">{tankInfo.name}</h2>
            <div className="dashboard-hero-meta">
              <span>{tankInfo.volumeLiters}L</span>
              <span className="dashboard-hero-dot">·</span>
              <span>{tankInfo.systemType}</span>
              {tankInfo.tankAgeMonths !== undefined && (
                <>
                  <span className="dashboard-hero-dot">·</span>
                  <span>{tankInfo.tankAgeMonths} meses</span>
                </>
              )}
            </div>
          </div>
          <div className="dashboard-hero-score">
            <HealthScoreCircle score={tankHealthScore} size={110} />
          </div>
        </div>
      </div>

      {/* ── Zone 2: Quick Action Buttons ── */}
      <div className="dashboard-quick-actions">
        {quickActions.map(({ label, icon, tab }) => (
          <button
            key={tab}
            className="dashboard-quick-btn"
            onClick={() => onNavigate(tab)}
            type="button"
          >
            <span className="dashboard-quick-icon">{icon}</span>
            <span className="dashboard-quick-label">{label}</span>
          </button>
        ))}
      </div>

      {/* ── Body (padded) ── */}
      <div className="dashboard-body">

        {/* ── Alert Strip ── */}
        {(criticalTips.length > 0 || animalsAtRisk.length > 0) && (
          <div className="dashboard-alerts-strip">
            {criticalTips.map((tip) => (
              <div key={tip.id} className="dashboard-alert-banner">
                <span style={{ fontWeight: 800 }}>!</span>
                <span>{tip.message}</span>
              </div>
            ))}
            {animalsAtRisk.map((animal) => (
              <div key={animal.entryId} className="dashboard-alert-banner">
                <span>⚠</span>
                <span>
                  <strong>{animal.name}</strong>
                  {': '}
                  {animal.violations.map((v) => v.label).join(', ')} fora do ideal
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Parâmetros Atuais ── */}
        <div className="dashboard-params-section">
          <div className="dashboard-params-header">
            <h3 className="dashboard-section-title">Parâmetros Atuais</h3>
            {mostRecentMeasuredAt && (
              <span className="dashboard-params-ts">{timeAgoLabel(mostRecentMeasuredAt)}</span>
            )}
          </div>
          {withData.length > 0 ? (
            <div className="dashboard-params-grid">
              {withData.map((item) => renderCurrentParamCard(item))}
            </div>
          ) : (
            <p className="intelligence-empty">Nenhuma medição registrada ainda.</p>
          )}
        </div>

        {/* ── Tendências (colapsável) ── */}
        <details className="dashboard-trends-details">
          <summary className="dashboard-trends-summary">
            <span>Tendências</span>
            <select
              value={dashboardPeriodDays}
              onChange={(event) => setDashboardPeriodDays(Number(event.target.value) as 7 | 30 | 90 | 365)}
              onClick={(e) => e.stopPropagation()}
            >
              <option value={7}>7 dias</option>
              <option value={30}>30 dias</option>
              <option value={90}>90 dias</option>
              <option value={365}>1 ano</option>
            </select>
          </summary>

          <div className="chart-box" style={{ marginTop: 0 }}>
            <div className="chart-frame">
              <svg
                ref={svgRef}
                viewBox="0 0 340 130"
                className="chart"
                onMouseMove={handleSvgMouseMove}
                onMouseLeave={() => setTooltip(null)}
                style={{ cursor: 'crosshair' }}
              >
                {yLabels.map(({ y, text }) => (
                  <g key={y}>
                    <line x1={28} y1={y + 5} x2={340} y2={y + 5} stroke="rgba(148,163,184,0.08)" />
                    <text x={24} y={y + 9} fill="#64748b" fontSize={7} textAnchor="end">
                      {text}
                    </text>
                  </g>
                ))}
                <g transform="translate(28, 5)">
                  {chartPaths.map((item) => (
                    <g key={item.key}>
                      {item.laneHeight >= 10 && (
                        <text x={0} y={item.laneTop - 4} fill="#94a3b8" fontSize={8}>
                          {item.label}
                        </text>
                      )}
                      {item.laneHeight >= 8 && (
                        <line
                          x1={0}
                          y1={item.laneTop + item.laneHeight}
                          x2={312}
                          y2={item.laneTop + item.laneHeight}
                          stroke="rgba(148, 163, 184, 0.10)"
                        />
                      )}
                      {item.safeBand && (
                        <rect
                          x={0}
                          y={item.safeBand.y}
                          width={312}
                          height={item.safeBand.height}
                          fill="rgba(34, 197, 94, 0.10)"
                        />
                      )}
                      {item.path && <path d={item.path} stroke={item.color} />}
                      {item.points.map((point, index) => (
                        <circle
                          key={`${item.key}-${index}`}
                          cx={point.x}
                          cy={point.y}
                          r={2.4}
                          fill={item.color}
                        />
                      ))}
                    </g>
                  ))}
                </g>
                {tooltip && (
                  <line
                    x1={tooltip.x + 28}
                    y1={5}
                    x2={tooltip.x + 28}
                    y2={125}
                    stroke="rgba(148,163,184,0.4)"
                    strokeDasharray="3,2"
                  />
                )}
              </svg>
              {tooltip && (
                <div
                  style={{
                    position: 'absolute',
                    background: 'var(--panel)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '6px 10px',
                    pointerEvents: 'none',
                    fontSize: '0.8rem',
                    color: 'var(--muted)',
                  }}
                >
                  {tooltip.label}
                </div>
              )}
            </div>
            <div className="chart-mobile-list">
              {chartPaths.map((item) => (
                <div key={item.key} className="chart-mobile-item">
                  <div className="chart-mobile-head">
                    <span className="chart-mobile-dot" style={{ backgroundColor: item.color }}></span>
                    <strong>{item.label}</strong>
                  </div>
                  <svg viewBox={`0 0 320 ${item.laneHeight}`} className="chart-mobile-spark">
                    {item.safeBandInLane && (
                      <rect
                        x={0}
                        y={item.safeBandInLane.y}
                        width={320}
                        height={item.safeBandInLane.height}
                        fill="rgba(34, 197, 94, 0.10)"
                      />
                    )}
                    {item.lanePath && <path d={item.lanePath} stroke={item.color} />}
                    {item.lanePoints.map((point, index) => (
                      <circle key={`${item.key}-m-${index}`} cx={point.x} cy={point.y} r={2.2} fill={item.color} />
                    ))}
                  </svg>
                </div>
              ))}
              {chartPaths.length === 0 && <span>Sem registros no período.</span>}
            </div>
            <div className="legend">
              {chartPaths.map((item) => (
                <span key={item.key} className="legend-item">
                  <i style={{ backgroundColor: item.color }}></i>
                  {item.label}
                </span>
              ))}
              {chartPaths.length === 0 && <span>Sem registros no período.</span>}
            </div>
            {chartPaths.length > 0 && (
              <div className="chart-note">Eixo Y normalizado 0–100% por parâmetro.</div>
            )}
          </div>
        </details>

        {/* ── Chart + Today's Protocols ── */}
        <div className="dashboard-chart-row">
          <div className="dashboard-protocols-panel">
            <h4>Hoje ({dayLabel})</h4>
            {protocolsDueToday.length === 0 ? (
              <p className="intelligence-empty">Sem rotinas pendentes.</p>
            ) : (
              <div className="today-protocols">
                {protocolsDueToday.map((item) => (
                  <div key={item.definition.key} className="today-protocol-item">
                    <div className="today-protocol-main">
                      <strong>{item.definition.label}</strong>
                      <span className="today-protocol-meta">
                        {item.doseLabel}
                        {item.latest ? ` · ${formatDate(item.latest.checkedAt)}` : ''}
                      </span>
                    </div>
                    <button
                      className="week-check"
                      onClick={() => onToggleProtocolCheck(item.definition.key, todayProtocolDayIndex)}
                    >
                      Pendente
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Warning/info tips + insights ── */}
        {(warningTips.length > 0 || infoTips.length > 0 || dashboardInsightCards.length > 0) && (
          <div className="smart-tips">
            {(warningTips.length > 0 || infoTips.length > 0) && (
              <>
                <h3 className="smart-tips-title">Alertas Inteligentes</h3>
                <div className="smart-tips-list">
                  {warningTips.map((tip) => (
                    <div key={tip.id} className="smart-tip smart-tip--warning">
                      <span className="smart-tip-icon">⚠</span>
                      <span className="smart-tip-msg">{tip.message}</span>
                    </div>
                  ))}
                  {infoTips.map((tip) => (
                    <div key={tip.id} className="smart-tip smart-tip--info">
                      <span className="smart-tip-icon">i</span>
                      <span className="smart-tip-msg">{tip.message}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {dashboardInsightCards.length > 0 && (
              <div className="insights" style={{ marginTop: 8 }}>
                {dashboardInsightCards.map((text) => (
                  <div key={text} className="insight-card">
                    {text}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {bottleForecastCards.length > 0 && (
          <div className="bottle-forecast-section">
            <h3 className="bottle-forecast-title">Frascos de reagente</h3>
            <div className="bottle-forecast-list">
              {bottleForecastCards.map(({ label, daysRemaining, mlPerDay, mlRemaining }) => {
                const days = Math.floor(daysRemaining)
                const isWarning = days <= 7
                const isAlert = days <= 3
                const fmtMl = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(v)
                return (
                  <div
                    key={label}
                    className={`bottle-card${isAlert ? ' bottle-card--alert' : isWarning ? ' bottle-card--warning' : ''}`}
                  >
                    <span className="bottle-icon">{isAlert ? '🪫' : isWarning ? '⚠️' : '🧴'}</span>
                    <div className="bottle-body">
                      <span className="bottle-label">{label}</span>
                      <span className="bottle-detail">
                        {fmtMl(mlRemaining)} ml restantes · usa {fmtMl(mlPerDay)} ml/dia
                      </span>
                    </div>
                    <div className={`bottle-days${isAlert ? ' bottle-days--alert' : isWarning ? ' bottle-days--warning' : ''}`}>
                      ~{days} dias
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </section>
  )
}
