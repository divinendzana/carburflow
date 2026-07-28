/**
 * Options d’axe X Chart.js pour éviter un axe trop dense quand il y a beaucoup de dates.
 */
export function xAxisTicks(labelCount, textColor) {
  const count = Math.max(0, Number(labelCount) || 0)
  const dense = count > 8
  const crowded = count > 14
  return {
    color: textColor,
    autoSkip: true,
    autoSkipPadding: dense ? 12 : 6,
    maxTicksLimit: crowded ? 8 : dense ? 10 : undefined,
    maxRotation: dense ? 45 : 0,
    minRotation: dense ? 25 : 0,
  }
}

/** Rayon des points : plus discret si la série est longue. */
export function seriesPointRadius(labelCount, base = 4, dense = 2) {
  const count = Math.max(0, Number(labelCount) || 0)
  return count > 12 ? dense : base
}

/** Crée un chart en détruisant d’abord toute instance liée au canvas. */
export function createChart(target, config) {
  const ChartCtor = typeof window !== 'undefined' ? window.Chart : null
  if (!ChartCtor || !target) return null
  const existing = typeof ChartCtor.getChart === 'function' ? ChartCtor.getChart(target) : null
  if (existing) existing.destroy()
  return new ChartCtor(target, config)
}
