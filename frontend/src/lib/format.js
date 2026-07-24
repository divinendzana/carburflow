const numberFr = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })
const numberFr0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

export function fmt(value, unit = '') {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return unit ? `${numberFr.format(value)} ${unit}` : numberFr.format(value)
}

export function fmtInt(value, unit = '') {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return unit ? `${numberFr0.format(value)} ${unit}` : numberFr0.format(value)
}

export function fmtPct(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return `${value >= 0 ? '+' : ''}${numberFr.format(value)} %`
}

export function fmtDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('fr-FR')
}
