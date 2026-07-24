import { fmtPct } from '../lib/format'

/**
 * Badge de variation en % par rapport à la période précédente.
 * `field` : 'variation_pct' (total) ou 'mean_variation_pct' (moyenne).
 */
export default function DeltaBadge({ metric, field = 'variation_pct' }) {
  if (metric?.has_previous_period === false) {
    return <small className="delta-neutral">— pas de période précédente</small>
  }

  const value = metric?.[field]
  if (typeof value !== 'number') {
    return <small className="delta-neutral">—</small>
  }

  const direction = value >= 0 ? 'delta-up' : 'delta-down'
  const arrow = value >= 0 ? '▲' : '▼'
  return (
    <small className={direction}>
      {arrow} {fmtPct(value)}
    </small>
  )
}
