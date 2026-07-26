/**
 * Formate un nombre d'heures d'autonomie en chaîne lisible.
 * Si heures >= 24h, retourne "XjYh" (ex: 2j6h).
 * Si heures < 24h, retourne "Xh" (ex: 14h).
 * Si heures est null/undefined, retourne "—".
 */
export function formatAutonomy(hours) {
  if (hours == null || Number.isNaN(hours)) return '—'
  if (hours <= 0) return '0h'
  const totalMinutes = Math.round(hours * 60)
  const totalHours = Math.round(totalMinutes / 60)
  if (totalHours < 24) return `${totalHours}h`
  const days = Math.floor(totalHours / 24)
  const remHours = totalHours % 24
  return `${days}j${remHours}h`
}

/**
 * Niveau d'autonomie pour l'UI : critical | medium | low | ok | unknown
 * - critical : < 24h ou 0h (consommation sans heures)
 * - medium   : 24h–36h
 * - low      : 36h–72h (à surveiller, mais moins pressant)
 * - ok       : ≥ 72h ou ∞
 */
export function getAutonomySeverity(entity = {}) {
  if (entity.is_infinite_consumption) return 'critical'
  if (entity.is_infinite_autonomy || entity.formatted_autonomy === '∞') return 'ok'
  const hrs = entity.autonomie_hours
  if (hrs == null || Number.isNaN(Number(hrs))) return 'unknown'
  if (hrs < 24) return 'critical'
  if (hrs < 36) return 'medium'
  if (hrs < 72) return 'low'
  return 'ok'
}

export function getAutonomySeverityLabel(severity) {
  if (severity === 'critical') return 'Critique'
  if (severity === 'medium') return 'Moyen'
  if (severity === 'low') return 'Faible risque'
  if (severity === 'ok') return 'OK'
  return '—'
}

export function formatAutonomyValue(entity = {}) {
  if (entity.is_infinite_consumption) return '0h'
  if (entity.is_infinite_autonomy || entity.formatted_autonomy === '∞') return '∞'
  if (entity.formatted_autonomy) return entity.formatted_autonomy
  if (entity.autonomie_hours != null) return formatAutonomy(entity.autonomie_hours)
  return '—'
}
