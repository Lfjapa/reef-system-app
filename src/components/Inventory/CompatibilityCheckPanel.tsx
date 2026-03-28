import type { CompatibilityWarning } from '../../lib/compatibilityEngine'

type Props = {
  warnings: CompatibilityWarning[]
}

export default function CompatibilityCheckPanel({ warnings }: Props) {
  if (warnings.length === 0) return null

  const icon = (severity: CompatibilityWarning['severity']) => {
    if (severity === 'critical') return '🚫'
    if (severity === 'warning') return '⚠️'
    return 'ℹ️'
  }

  const badgeClass = (severity: CompatibilityWarning['severity']) => {
    if (severity === 'critical') return 'critical'
    if (severity === 'warning') return 'attention'
    return 'neutral'
  }

  return (
    <div className="compatibility-panel full">
      <div className="compatibility-panel-title">
        Verificação de compatibilidade
      </div>
      <ul className="compatibility-list">
        {warnings.map((w, i) => (
          <li key={i} className={`compatibility-item compatibility-item--${w.severity}`}>
            <span className={`status-badge ${badgeClass(w.severity)}`}>{icon(w.severity)}</span>
            <span className="compatibility-item-msg">{w.message}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
