const safeValue = (value) => (typeof value === 'number' && !Number.isNaN(value) ? value : 0)

/**
 * Statistiques dérivées d'une série de valeurs (utilisé pour la consommation horaire
 * calculée côté client sur la page Groupes).
 */
export function buildDerivedMetric(values = []) {
  const normalized = (values || []).map(safeValue).filter((v) => v > 0)
  if (!normalized.length) {
    return {
      total: 0,
      mean: 0,
      all_time_mean: 0,
      all_time_stddev: 0,
      variation_pct: null,
      mean_variation_pct: null,
      has_previous_period: false,
    }
  }

  const total = normalized.reduce((sum, v) => sum + v, 0)
  const mean = total / normalized.length
  const first = normalized[0]
  const last = normalized[normalized.length - 1]
  const variationPct = first === 0 ? null : ((last - first) / first) * 100
  const meanVariationPct = first === 0 ? null : ((mean - first) / first) * 100
  const variance = normalized.reduce((sum, v) => sum + (v - mean) ** 2, 0) / normalized.length

  return {
    total: Number(total.toFixed(1)),
    mean: Number(mean.toFixed(1)),
    all_time_mean: Number(mean.toFixed(1)),
    all_time_stddev: Number(Math.sqrt(variance).toFixed(1)),
    variation_pct: variationPct === null ? null : Number(variationPct.toFixed(1)),
    mean_variation_pct: meanVariationPct === null ? null : Number(meanVariationPct.toFixed(1)),
    has_previous_period: normalized.length > 1,
  }
}

/**
 * Statistiques sur une fenêtre [start, end] d'une série, comparées à la fenêtre
 * précédente de même longueur (utilisé sur la page Sites, calcul côté client).
 */
export function windowStats(values = [], start, end) {
  const window = values.slice(start, end + 1)
  const total = window.reduce((sum, v) => sum + safeValue(v), 0)
  const mean = window.length ? total / window.length : 0

  const prevLength = end - start + 1
  const prevStart = start - prevLength
  const prevWindow = prevStart >= 0 ? values.slice(prevStart, start) : []
  const prevTotal = prevWindow.reduce((sum, v) => sum + safeValue(v), 0)
  const prevMean = prevWindow.length ? prevTotal / prevWindow.length : 0

  const allTimeMean = values.length
    ? values.reduce((sum, v) => sum + safeValue(v), 0) / values.length
    : 0
  const variance = values.length
    ? values.reduce((sum, v) => sum + (safeValue(v) - allTimeMean) ** 2, 0) / values.length
    : 0

  const variationPct = prevTotal === 0 ? null : ((total - prevTotal) / prevTotal) * 100
  const meanVariationPct = prevMean === 0 ? null : ((mean - prevMean) / prevMean) * 100

  return {
    total: Number(total.toFixed(1)),
    mean: Number(mean.toFixed(1)),
    previous_total: prevWindow.length ? Number(prevTotal.toFixed(1)) : null,
    previous_mean: prevWindow.length ? Number(prevMean.toFixed(1)) : null,
    variation_pct: variationPct === null ? null : Number(variationPct.toFixed(1)),
    mean_variation_pct: meanVariationPct === null ? null : Number(meanVariationPct.toFixed(1)),
    all_time_mean: Number(allTimeMean.toFixed(1)),
    all_time_stddev: Number(Math.sqrt(variance).toFixed(1)),
    has_previous_period: prevWindow.length > 0,
  }
}

export { safeValue }
