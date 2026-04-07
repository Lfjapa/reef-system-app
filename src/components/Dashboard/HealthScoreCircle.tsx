import { healthScoreColor } from '../../lib/tankHealthScore'

const CIRCUMFERENCE = 2 * Math.PI * 48 // ≈ 301.59

type Props = {
  score: number
  size?: number
}

export default function HealthScoreCircle({ score, size = 110 }: Props) {
  const color = healthScoreColor(score)
  const offset = CIRCUMFERENCE * (1 - score / 100)

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      aria-label={`Saúde do aquário: ${score} de 100`}
    >
      {/* Track ring */}
      <circle
        cx="60"
        cy="60"
        r="48"
        fill="none"
        stroke="rgba(148,163,184,0.12)"
        strokeWidth="10"
      />
      {/* Progress arc */}
      <circle
        cx="60"
        cy="60"
        r="48"
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        transform="rotate(-90 60 60)"
        style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
      />
      {/* Score number */}
      <text
        x="60"
        y="55"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--text)"
        fontSize="26"
        fontWeight="800"
        fontFamily="inherit"
      >
        {score}
      </text>
      {/* Sub-label */}
      <text
        x="60"
        y="74"
        textAnchor="middle"
        fill="var(--muted-2)"
        fontSize="10"
        fontFamily="inherit"
      >
        /100
      </text>
    </svg>
  )
}
