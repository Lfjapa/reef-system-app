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
}

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
}: Props) {
  return (
    <section className="panel">
      <h2>Status rápido</h2>
      <div className="cards">
        {latestByParameter
          .filter(({ latest }) => Boolean(latest))
          .sort((a, b) => {
            const aTime = a.latest ? new Date(a.latest.measuredAt).getTime() : 0
            const bTime = b.latest ? new Date(b.latest.measuredAt).getTime() : 0
            return bTime - aTime
          })
          .map(({ definition, latest }) => {
            const insight = parameterInsights.get(definition.key)
            const safe = safeZones.get(definition.key) ?? null
            const cloudRate = cloudConsumptionRates.get(definition.key) ?? null
            const isOutsideSafe = Boolean(
              safe && latest && (latest.value < safe.min || latest.value > safe.max),
            )
            const projectedDaysToCriticalMin = insight?.projectedDaysToCriticalMin ?? null
            const projectedDaysToBound = insight?.projectedDaysToBound ?? null
            const badgeClass =
              insight?.badge === 'Ideal'
                ? 'ideal'
                : insight?.badge === 'Atenção'
                  ? 'attention'
                  : insight?.badge === 'Crítico'
                    ? 'critical'
                    : 'neutral'
            const dailyRate = cloudRate ?? insight?.dailyRate ?? null
            const rateLabel =
              dailyRate !== null && Number.isFinite(dailyRate)
                ? `${formatSigned(dailyRate, 3)}${definition.unit ? ` ${definition.unit}/dia` : ' /dia'}`
                : null
            const safeAutonomyLabel =
              safe && latest && dailyRate !== null && Number.isFinite(dailyRate) && dailyRate !== 0
                ? (() => {
                    const min = safe.min
                    const max = safe.max
                    const value = latest.value
                    const days =
                      dailyRate > 0 ? (max - value) / dailyRate : (value - min) / Math.abs(dailyRate)
                    if (!Number.isFinite(days) || days <= 0) return null
                    return `Sai da zona segura em ~${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(days)} dias`
                  })()
                : null
            const autonomyLabel =
              safeAutonomyLabel ??
              (projectedDaysToCriticalMin !== null && Number.isFinite(projectedDaysToCriticalMin)
                ? `Limite em ~${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(projectedDaysToCriticalMin)} dias`
                : projectedDaysToBound !== null && Number.isFinite(projectedDaysToBound)
                  ? `Sai do ideal em ~${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(projectedDaysToBound)} dias`
                  : null)
            const safeLabel =
              safe && Number.isFinite(safe.min) && Number.isFinite(safe.max)
                ? `Zona segura: ${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(safe.min)}–${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(safe.max)}${definition.unit ? ` ${definition.unit}` : ''}`
                : null
            return (
              <article key={definition.key} className="card">
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
                      {safeLabel ? ` · ${safeLabel}` : ''}
                    </>
                  ) : (
                    'Sem histórico'
                  )}
                </small>
              </article>
            )
          })}
      </div>

      <div className="chart-box">
        <div className="chart-head">
          <h3>Dashboard Geral do Aquário</h3>
          <select
            value={dashboardPeriodDays}
            onChange={(event) => setDashboardPeriodDays(Number(event.target.value) as 7 | 30 | 90 | 365)}
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
            <option value={365}>Último ano</option>
          </select>
        </div>
        <div className="chart-frame">
          <svg viewBox="0 0 320 120" className="chart">
            {chartPaths.map((item) => (
              <g key={item.key}>
                {item.laneHeight >= 10 && (
                  <text x={0} y={item.laneTop - 4} fill="#94a3b8" fontSize={9}>
                    {item.label}
                  </text>
                )}
                {item.laneHeight >= 8 && (
                  <line
                    x1={0}
                    y1={item.laneTop + item.laneHeight}
                    x2={320}
                    y2={item.laneTop + item.laneHeight}
                    stroke="rgba(148, 163, 184, 0.14)"
                  />
                )}
                {item.safeBand && (
                  <rect
                    x={0}
                    y={item.safeBand.y}
                    width={320}
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
          </svg>
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
          <div className="chart-note">Escala: normalização 0–100% e tempo por parâmetro (início à esquerda).</div>
        )}
      </div>

      <div className="intelligence">
        <div className="intelligence-head">
          <h3>Informações</h3>
          <p>Insights, alertas e lembretes do dia</p>
        </div>

        {dashboardAlertCards.length > 0 && (
          <div className="intelligence-block">
            <h4>Alertas</h4>
            <div className="insights">
              {dashboardAlertCards.map((text) => (
                <div key={text} className="insight-card">
                  {text}
                </div>
              ))}
            </div>
          </div>
        )}

        {dashboardInsightCards.length > 0 && (
          <div className="intelligence-block">
            <h4>Análises</h4>
            <div className="insights">
              {dashboardInsightCards.map((text) => (
                <div key={text} className="insight-card">
                  {text}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="intelligence-block">
          <h4>Protocolos de hoje ({dayLabel})</h4>
          {protocolsDueToday.length === 0 ? (
            <p className="intelligence-empty">Sem rotinas pendentes para hoje.</p>
          ) : (
            <div className="today-protocols">
              {protocolsDueToday.map((item) => (
                <div key={item.definition.key} className="today-protocol-item">
                  <div className="today-protocol-main">
                    <strong>{item.definition.label}</strong>
                    <span className="today-protocol-meta">
                      {item.doseLabel}
                      {item.latest ? ` · Último: ${formatDate(item.latest.checkedAt)}` : ''}
                    </span>
                  </div>
                  <button className="week-check" onClick={() => onToggleProtocolCheck(item.definition.key, todayProtocolDayIndex)}>
                    Pendente
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
