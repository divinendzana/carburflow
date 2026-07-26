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
