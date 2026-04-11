// SVG chart utilities

export type ChartPoint = { x: number; y: number }

/** Builds a monotone cubic spline SVG path through the given points. */
export const buildMonotonePath = (points: ChartPoint[]) => {
  if (points.length < 2) return ''
  const n = points.length
  const x = points.map((p) => p.x)
  const y = points.map((p) => p.y)
  const dx = new Array<number>(n - 1)
  const m = new Array<number>(n - 1)

  for (let i = 0; i < n - 1; i += 1) {
    const dxi = x[i + 1] - x[i]
    dx[i] = dxi === 0 ? 1 : dxi
    m[i] = (y[i + 1] - y[i]) / dx[i]
  }

  const t = new Array<number>(n)
  t[0] = m[0]
  t[n - 1] = m[n - 2]

  for (let i = 1; i < n - 1; i += 1) {
    const m0 = m[i - 1]
    const m1 = m[i]
    if (m0 === 0 || m1 === 0 || m0 * m1 <= 0) {
      t[i] = 0
    } else {
      t[i] = (m0 + m1) / 2
    }
  }

  for (let i = 0; i < n - 1; i += 1) {
    const mi = m[i]
    if (mi === 0) {
      t[i] = 0
      t[i + 1] = 0
      continue
    }
    const a = t[i] / mi
    const b = t[i + 1] / mi
    const s = a * a + b * b
    if (s > 9) {
      const r = 3 / Math.sqrt(s)
      t[i] = r * a * mi
      t[i + 1] = r * b * mi
    }
  }

  const fmt = (value: number) => Number(value.toFixed(2))
  let d = `M ${fmt(x[0])},${fmt(y[0])}`

  for (let i = 0; i < n - 1; i += 1) {
    const h = x[i + 1] - x[i]
    const c1x = x[i] + h / 3
    const c1y = y[i] + (t[i] * h) / 3
    const c2x = x[i + 1] - h / 3
    const c2y = y[i + 1] - (t[i + 1] * h) / 3
    d += ` C ${fmt(c1x)},${fmt(c1y)} ${fmt(c2x)},${fmt(c2y)} ${fmt(x[i + 1])},${fmt(y[i + 1])}`
  }

  return d
}
