import { useState, useRef, type ReactNode, type MouseEvent } from 'react'
import ParameterHealthSummary from './ParameterHealthSummary'
import type { SmartTip } from '../../hooks/useSmartTips'
import type { AnimalRiskItem } from '../../hooks/useAnimalsAtRisk'

type TrendArrow = 'up' | 'down' | 'flat'
type InsightBadge = 'Ideal' | 'Atenção' | 'Crítico' | 'Sem faixa'

type ParameterDefinition = {
  key: string
  label: string
  unit: string
}

type ParameterEntry = {
  measuredAt: string
  value: number
}

type ParameterInsight = {
  arrow: TrendArrow
  badge: InsightBadge
  dailyRate: number | null
  projectedDaysToBound: number | null
  projectedDaysToCriticalMin: number | null
}

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
  dayLabel: string
  protocolsDueToday: ProtocolDueItem[]
  formatDate: (iso: string) => string
  onToggleProtocolCheck: (protocolKey: string, dayIndex: number) => void
  todayProtocolDayIndex: number
  smartTips?: SmartTip[]
  animalsAtRisk?: AnimalRiskItem[]
}

// Clamp a value between 0 and 1 for range bar
function rangePercent(value: number, min: number, max: number): number {
  const span = max - min
  if (span <= 0) return 0.5
  return Math.max(0, Math.min(1, (value - min) / span))
}

// Compute display range: extend safe zone by 25% on each side for context
function displayRange(safe: { min: number; max: number }): { dMin: number; dMax: number } {
  const span = safe.max - safe.min
  const pad = span * 0.4
  return { dMin: safe.min - pad, dMax: safe.max + pad }
}

type ChartTooltip = { x: number; y: number; label: string; value: number; unit: string; date: string } | null

export default function DashboardTab({
  latestByParameter,
  parameterInsights,
  safeZones,
  cloudConsumptionRates,
  formatSigned,
  arrowSymbol,
  dashboardPeriodDays,
  setDashboardPeriodDays,
  chartPaths,
  dashboardAlertCards,
  dashboardInsightCards,
  dayLabel,
  protocolsDueToday,
  formatDate,
  onToggleProtocolCheck,
  todayProtocolDayIndex,
  smartTips = [],
  animalsAtRisk = [],
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

  const heroItems = withData.filter(({ definition }) => HERO_PARAMS.has(definition.key))
  const secondaryItems = withData.filter(({ definition }) => !HERO_PARAMS.has(definition.key))

  // Critical alerts from smart tips + alert cards
  const criticalTips = smartTips.filter((t) => t.severity === 'critical')
  const warningTips = smartTips.filter((t) => t.severity === 'warning')
  const infoTips = smartTips.filter((t) => t.severity === 'info')

  function renderCard(
    { definition, latest }: LatestByParameterItem,
    secondary = false,
  ) {
    const insight = parameterInsights.get(definition.key)
    const safe = safeZones.get(definition.key) ?? null
    const cloudRate = cloudConsumptionRates.get(definition.key) ?? null
    const isOutsideSafe = Boolean(safe && latest && (latest.value < safe.min || latest.value > safe.max))
    const badgeClass =
      insight?.badge === 'Ideal'
        ? 'ideal'
        : insight?.badge === 'Atenção'
          ? 'attention'
          : insight?.badge === 'Crítico'
            ? 'critical'
            : 'neutral'
    const cardStatusClass =
      insight?.badge === 'Ideal'
        ? 'card--ideal'
        : insight?.badge === 'Atenção'
          ? 'card--attention'
          : insight?.badge === 'Crítico'
            ? 'card--critical'
            : ''
    const dailyRate = cloudRate ?? insight?.dailyRate ?? null
    const rateLabel =
      dailyRate !== null && Number.isFinite(dailyRate)
        ? `${formatSigned(dailyRate, 3)}${definition.unit ? ` ${definition.unit}/dia` : ' /dia'}`
        : null

    const autonomyLabel = (() => {
      if (safe && latest && dailyRate !== null && Number.isFinite(dailyRate) && dailyRate !== 0) {
        const days =
          dailyRate > 0 ? (safe.max - latest.value) / dailyRate : (latest.value - safe.min) / Math.abs(dailyRate)
        if (Number.isFinite(days) && days > 0) {
          return `Sai da zona em ~${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(days)} dias`
        }
      }
      const projDays = insight?.projectedDaysToCriticalMin ?? insight?.projectedDaysToBound ?? null
      if (projDays !== null && Number.isFinite(projDays)) {
        return `Limite em ~${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(projDays)} dias`
      }
      return null
    })()

    // Range bar
    let rangeBar: ReactNode = null
    if (safe && latest && Number.isFinite(safe.min) && Number.isFinite(safe.max)) {
      const { dMin, dMax } = displayRange(safe)
      const thumbPct = rangePercent(latest.value, dMin, dMax) * 100
      const safePctLeft = rangePercent(safe.min, dMin, dMax) * 100
      const safePctWidth = rangePercent(safe.max, dMin, dMax) * 100 - safePctLeft
      const thumbColor =
        isOutsideSafe
          ? 'var(--danger)'
          : insight?.badge === 'Atenção'
            ? 'var(--warning-color)'
            : 'var(--success)'
      rangeBar = (
        <div className="param-range-track">
          <div
            className="param-range-safe"
            style={{ left: `${safePctLeft}%`, width: `${safePctWidth}%` }}
          />
          <div
            className="param-range-thumb"
            style={{ left: `${thumbPct}%`, backgroundColor: thumbColor }}
          />
        </div>
      )
    }

    const cardClass = `card${cardStatusClass ? ` ${cardStatusClass}` : ''}${secondary ? ' card--secondary' : ''}`

    return (
      <article key={definition.key} className={cardClass}>
        <span>{definition.label}</span>
        <strong>
          {latest ? (
            <>
              <span className={`trend-arrow ${insight?.arrow ?? 'flat'}`}>
                {arrowSymbol[insight?.arrow ?? 'flat']}
              </span>{' '}
              {`${latest.value} ${definition.unit}`.trim()}
            </>
          ) : (
            'Sem medição'
          )}
        </strong>
        {rangeBar}
        <small>
          {latest && insight ? (
            <>
              <span className={`status-badge ${badgeClass}`}>{insight.badge}</span>
              {isOutsideSafe ? (
                <>
                  {' '}
                  <span className="status-badge critical">Fora zona</span>
                </>
              ) : null}
              {rateLabel ? ` · ${rateLabel}` : ''}
              {autonomyLabel ? ` · ${autonomyLabel}` : ''}
            </>
          ) : (
            'Sem histórico'
          )}
        </small>
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
            value: 0,
            unit: '',
            date: '',
          }
        }
      }
    }
    setTooltip(best)
  }

  // Y-axis labels: compute min/max from all lane data
  const yLabels: { y: number; text: string }[] = []
  if (chartPaths.length > 0) {
    // 5 evenly spaced labels: 0%, 25%, 50%, 75%, 100% of chart height (120)
    for (const pct of [0, 25, 50, 75, 100]) {
      yLabels.push({ y: (pct / 100) * 120, text: `${100 - pct}%` })
    }
  }

  return (
    <section className="panel">
      <h2>Status rápido</h2>

      {/* ── Zone 1: Critical alert strip ── */}
      {(criticalTips.length > 0 || dashboardAlertCards.length > 0 || animalsAtRisk.length > 0) && (
        <div className="dashboard-alerts-strip">
          {criticalTips.map((tip) => (
            <div key={tip.id} className="dashboard-alert-banner">
              <span style={{ fontWeight: 800 }}>!</span>
              <span>{tip.message}</span>
            </div>
          ))}
          {dashboardAlertCards.map((text) => (
            <div key={text} className="dashboard-alert-banner dashboard-alert-banner--warning">
              <span>⚠</span>
              <span>{text}</span>
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

      {/* ── Zone 2: Hero parameters ── */}
      {heroItems.length > 0 && (
        <div className="dashboard-hero-grid">
          {heroItems.map((item) => renderCard(item, false))}
        </div>
      )}

      {/* ── Zone 3: Secondary parameters ── */}
      {secondaryItems.length > 0 && (
        <div className="dashboard-secondary-grid">
          {secondaryItems.map((item) => renderCard(item, true))}
        </div>
      )}

      {/* Show all params if none fall into hero category */}
      {heroItems.length === 0 && withData.length > 0 && (
        <div className="cards">
          {withData.map((item) => renderCard(item, false))}
        </div>
      )}

      <ParameterHealthSummary parameterInsights={parameterInsights} />

      {/* ── Zone 4: Chart + today's protocols side by side ── */}
      <div className="dashboard-chart-row">
        <div className="chart-box" style={{ marginTop: 0 }}>
          <div className="chart-head">
            <h3>Tendências</h3>
            <select
              value={dashboardPeriodDays}
              onChange={(event) => setDashboardPeriodDays(Number(event.target.value) as 7 | 30 | 90 | 365)}
            >
              <option value={7}>7 dias</option>
              <option value={30}>30 dias</option>
              <option value={90}>90 dias</option>
              <option value={365}>1 ano</option>
            </select>
          </div>
          <div className="chart-frame">
            <svg
              ref={svgRef}
              viewBox="0 0 340 130"
              className="chart"
              onMouseMove={handleSvgMouseMove}
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: 'crosshair' }}
            >
              {/* Y-axis grid lines + labels */}
              {yLabels.map(({ y, text }) => (
                <g key={y}>
                  <line x1={28} y1={y + 5} x2={340} y2={y + 5} stroke="rgba(148,163,184,0.08)" />
                  <text x={24} y={y + 9} fill="#64748b" fontSize={7} textAnchor="end">
                    {text}
                  </text>
                </g>
              ))}
              {/* Data lanes shifted right by 28px for Y-axis space */}
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
              {/* Tooltip crosshair */}
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

        {/* Today's protocols panel */}
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

      {/* ── Zone 5: Warning/info tips + insights ── */}
      {(warningTips.length > 0 || infoTips.length > 0 || dashboardInsightCards.length > 0) && (
        <div className="smart-tips" style={{ marginTop: 16 }}>
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
    </section>
  )
}
