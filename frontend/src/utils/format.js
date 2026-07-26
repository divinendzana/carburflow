/**
 * Formate un nombre d'heures d'autonomie en chaîne lisible.
 * Ex. 14 → "14 h", 54 → "2 j 6 h"
 */
export function formatAutonomy(hours) {
  if (hours == null || Number.isNaN(hours)) return '—'
  if (hours <= 0) return '0 h'
  const totalMinutes = Math.round(hours * 60)
  const totalHours = Math.round(totalMinutes / 60)
  if (totalHours < 24) return `${totalHours} h`
  const days = Math.floor(totalHours / 24)
  const remHours = totalHours % 24
  if (remHours === 0) return `${days} j`
  return `${days} j ${remHours} h`
}

/**
 * Niveau d'autonomie pour l'UI : critical | medium | low | ok | unknown
 * - critical : < 24h ou consommation sans heures (0 h)
 * - medium   : 24–36 h
 * - low      : 36–72 h
 * - ok       : ≥ 72 h
 * - unknown  : pas assez de données (ex-symbole ∞ côté API)
 */
export function getAutonomySeverity(entity = {}) {
  if (entity.is_infinite_consumption) return 'critical'
  if (entity.is_infinite_autonomy || entity.formatted_autonomy === '∞') return 'unknown'
  const hrs = entity.autonomie_hours
  if (hrs == null || Number.isNaN(Number(hrs))) return 'unknown'
  if (hrs < 24) return 'critical'
  if (hrs < 36) return 'medium'
  if (hrs < 72) return 'low'
  return 'ok'
}

export function getAutonomySeverityLabel(severity) {
  if (severity === 'critical') return 'Urgent'
  if (severity === 'medium') return 'À surveiller'
  if (severity === 'low') return 'Attention'
  if (severity === 'ok') return 'Confortable'
  if (severity === 'unknown') return 'Indéterminée'
  return 'Non disponible'
}

/**
 * Valeur courte affichée dans les tableaux / pastilles.
 * Jamais "∞" : le client doit comprendre tout de suite.
 */
export function formatAutonomyValue(entity = {}) {
  if (entity.is_infinite_consumption) return '0 h'
  if (entity.is_infinite_autonomy || entity.formatted_autonomy === '∞') return 'Indét.'
  if (entity.formatted_autonomy && entity.formatted_autonomy !== '∞') {
    return String(entity.formatted_autonomy)
      .replace(/(\d+)j(\d+)h/, '$1 j $2 h')
      .replace(/(\d+)j$/, '$1 j')
      .replace(/(\d+)h$/, '$1 h')
  }
  if (entity.autonomie_hours != null) return formatAutonomy(entity.autonomie_hours)
  return '—'
}

/**
 * Phrase d’aide au survol / accessibilité.
 */
export function getAutonomyHint(entity = {}) {
  if (entity.is_infinite_consumption) {
    return 'Consommation détectée sans heures de fonctionnement : stock à risque.'
  }
  if (entity.is_infinite_autonomy || entity.formatted_autonomy === '∞') {
    return 'Pas assez de données pour estimer le temps restant avant rupture.'
  }
  const severity = getAutonomySeverity(entity)
  if (severity === 'critical') return 'Moins de 24 heures estimées — action rapide recommandée.'
  if (severity === 'medium') return 'Entre 24 et 36 heures estimées — à surveiller de près.'
  if (severity === 'low') return 'Entre 36 et 72 heures estimées — planifiez un réapprovisionnement.'
  if (severity === 'ok') return 'Plus de 72 heures estimées — situation confortable.'
  return 'Autonomie non disponible pour le moment.'
}

/** Libellés métier partagés (éviter le jargon stats). */
export const METRIC_LABELS = {
  totalPeriod: 'Total sur la période',
  averagePeriod: 'Moyenne sur la période',
  habitualAverage: 'Moyenne habituelle',
  variability: 'Variabilité',
  hoursMean: 'Heures (moyenne)',
  consumptionMean: 'Conso. moyenne (litres)',
  autonomyRemaining: 'Temps restant estimé',
  noPreviousPeriod: 'Pas de période précédente pour comparer',
}
