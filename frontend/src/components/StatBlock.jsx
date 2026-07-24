import DeltaBadge from './DeltaBadge'
import { fmt } from '../lib/format'

/**
 * Bloc de 4 statistiques (total période, moyenne, moyenne absolue, écart type)
 * avec badges de variation — le motif répété sur les pages Sites/Cuves/Groupes.
 */
export default function StatBlock({ title, metric, unit = 'L', columns = 2 }) {
  return (
    <div className="metric-stat-block">
      {title && <span className="curve-title">{title}</span>}
      <div className="group-stats" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        <div>
          <span>Total période</span>
          <strong>{fmt(metric?.total, unit)}</strong>
          <DeltaBadge metric={metric} field="variation_pct" />
        </div>
        <div>
          <span>Moyenne</span>
          <strong>{fmt(metric?.mean, unit)}</strong>
          <DeltaBadge metric={metric} field="mean_variation_pct" />
        </div>
        <div>
          <span>Moy. absolue</span>
          <strong>{fmt(metric?.all_time_mean, unit)}</strong>
        </div>
        <div>
          <span>Écart type</span>
          <strong>{fmt(metric?.all_time_stddev, unit)}</strong>
        </div>
      </div>
    </div>
  )
}

export function SummaryChip({ label, value, unit, metric, field }) {
  return (
    <div className="summary-chip">
      <span>{label}</span>
      <strong>{fmt(value, unit)}</strong>
      {metric && <DeltaBadge metric={metric} field={field} />}
    </div>
  )
}
