import React from 'react'
import {
  formatAutonomyValue,
  getAutonomyHint,
  getAutonomySeverity,
  getAutonomySeverityLabel,
} from '../utils/format.js'

/**
 * Pastille d’autonomie lisible (jamais ∞).
 * size: "sm" | "md" | "lg"
 */
function AutonomyBadge({ entity = {}, size = 'md', showLabel = true, className = '' }) {
  const severity = getAutonomySeverity(entity)
  const value = formatAutonomyValue(entity)
  const label = getAutonomySeverityLabel(severity)
  const hint = getAutonomyHint(entity)

  return (
    <span
      className={`autonomy-badge autonomy-badge--${severity} autonomy-badge--${size} ${className}`.trim()}
      title={hint}
      aria-label={`${value}. ${label}. ${hint}`}
    >
      <span className="autonomy-badge-value">{value}</span>
      {showLabel ? <span className="autonomy-badge-label">{label}</span> : null}
    </span>
  )
}

export default AutonomyBadge
