import React, { useEffect, useMemo, useRef, useState } from 'react'
import Topbar from '../components/Topbar.jsx'
import WelcomeBanner from '../components/WelcomeBanner.jsx'
import { apiFetch } from '../auth.js'
import AutonomyBadge from '../components/AutonomyBadge.jsx'
import PageLoader from '../components/PageLoader.jsx'
import PageEnter from '../components/PageEnter.jsx'
import { useChartPalette } from '../hooks/useChartPalette.js'
import { createChart, defaultPeriodIndices, MAX_CHART_WEEKS, seriesPointRadius, toChartLabels, visibleChartRange, xAxisTicks } from '../utils/chartAxis.js'
import {
  formatAutonomyValue,
  getAutonomySeverity,
  getAutonomySeverityLabel,
  METRIC_LABELS,
} from '../utils/format.js'

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value)

const extractPower = (value) => {
  if (value == null || value === '') return 0
  const match = String(value).trim().replace(',', '.').match(/(\d+(?:\.\d+)?)/)
  return match ? Number(match[1]) : 0
}

/** Autonomie = (volume_CP × proportion + CJ) / conso_horaire_moyenne.
 * Sans conso moyenne significative (« - ») → autonomie indéterminée.
 */
const buildGroupAutonomyEntity = (group, allBlocks = [], meanHourlyLh = null) => {
  // Uniquement la moyenne affichée dans les métriques (pas de fallback backend)
  const mean = isFiniteNumber(meanHourlyLh) && meanHourlyLh > 0 ? meanHourlyLh : null

  if (mean == null) {
    return {
      ...group,
      autonomie_hours: null,
      formatted_autonomy: '∞',
      is_infinite_autonomy: true,
      is_infinite_consumption: false,
    }
  }

  const cpVolume = isFiniteNumber(group.latest_main_volume) ? group.latest_main_volume : null
  if (cpVolume == null) {
    return {
      ...group,
      autonomie_hours: null,
      formatted_autonomy: '∞',
      is_infinite_autonomy: true,
      is_infinite_consumption: false,
    }
  }

  const peers = (allBlocks || []).filter((block) => (
    group.site_id != null && String(block.site_id) === String(group.site_id)
  ))
  const peerList = peers.length ? peers : [group]
  const totalPower = peerList.reduce((sum, block) => sum + extractPower(block.puissance), 0)
  const groupPower = extractPower(group.puissance)
  const powerShare = totalPower > 0
    ? groupPower / totalPower
    : (isFiniteNumber(group.power_share) ? group.power_share : 1)
  const cjVolume = isFiniteNumber(group.latest_daily_volume) ? group.latest_daily_volume : 0
  const volumeProportionnel = cpVolume * powerShare + cjVolume
  const autonomyHours = volumeProportionnel / mean

  return {
    ...group,
    power_share: powerShare,
    volume_proportionnel: Number(volumeProportionnel.toFixed(1)),
    autonomie_hours: Number(autonomyHours.toFixed(1)),
    formatted_autonomy: null,
    is_infinite_autonomy: false,
    is_infinite_consumption: false,
  }
}


const buildDerivedMetric = (values = []) => {
  const normalizedValues = (values || []).filter(isFiniteNumber).filter((value) => value > 0)
  if (!normalizedValues.length) {
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

  const total = normalizedValues.reduce((sum, value) => sum + value, 0)
  const mean = total / normalizedValues.length
  const firstValue = normalizedValues[0]
  const variationPct = firstValue === 0 ? null : ((normalizedValues[normalizedValues.length - 1] - firstValue) / firstValue) * 100
  const meanVariationPct = firstValue === 0 ? null : ((mean - firstValue) / firstValue) * 100
  const variance = normalizedValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / normalizedValues.length

  return {
    total: Number(total.toFixed(1)),
    mean: Number(mean.toFixed(1)),
    all_time_mean: Number(mean.toFixed(1)),
    all_time_stddev: Number(Math.sqrt(variance).toFixed(1)),
    variation_pct: variationPct === null ? null : Number(variationPct.toFixed(1)),
    mean_variation_pct: meanVariationPct === null ? null : Number(meanVariationPct.toFixed(1)),
    has_previous_period: normalizedValues.length > 1,
  }
}

const safeNum = (value) => (isFiniteNumber(value) ? value : 0)

const lastFinite = (values = []) => {
  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (isFiniteNumber(values[i])) return values[i]
  }
  return null
}

const formatMetric = (value, digits = 1) => (
  isFiniteNumber(value) ? value.toFixed(digits) : '—'
)

/** Stats sur une série (semaine N / N-1 / total / moyenne).
 * Ignore les null (pas de relevé) — ne les transforme pas en 0.
 */
const buildPeriodSeriesStats = (values = []) => {
  const series = values || []
  if (!series.length) {
    return { weekN: null, weekN1: null, total: null, mean: null }
  }
  const finite = series.filter(isFiniteNumber)
  const total = finite.reduce((sum, value) => sum + value, 0)
  const nonZeroCount = finite.filter((v) => v > 0).length
  const weekN = lastFinite(series)
  let weekN1 = null
  if (series.length > 1) {
    for (let i = series.length - 2; i >= 0; i -= 1) {
      if (isFiniteNumber(series[i])) {
        weekN1 = series[i]
        break
      }
    }
  }
  return {
    weekN,
    weekN1,
    total: finite.length ? total : null,
    mean: nonZeroCount > 0 ? total / nonZeroCount : (finite.length ? 0 : null),
  }
}

/**
 * Série L/h pour la courbe :
 * - zero     : conso = 0 & heures > 0 → 0 L/h (point normal sur la courbe)
 * - infinite : conso > 0 & heures = 0 → ∞ (marqueur en haut d’échelle)
 * - missing  : pas de relevé (null) → trou
 * Toute date avec heures + conso numériques est affichée (y compris 0h/0L → 0).
 */
const buildHourlyRateSeries = (hours = [], consumption = []) => {
  const len = Math.max(hours.length, consumption.length)
  const kinds = []
  const raw = []

  for (let index = 0; index < len; index += 1) {
    const hoursValue = hours[index]
    const consumptionValue = consumption[index]
    if (!isFiniteNumber(hoursValue) || !isFiniteNumber(consumptionValue)) {
      kinds.push('missing')
      raw.push(null)
      continue
    }
    if (hoursValue > 0 && consumptionValue === 0) {
      kinds.push('zero')
      raw.push(0)
      continue
    }
    if (hoursValue === 0 && consumptionValue > 0) {
      kinds.push('infinite')
      raw.push(Infinity)
      continue
    }
    if (hoursValue > 0) {
      kinds.push('normal')
      raw.push(Number((consumptionValue / hoursValue).toFixed(2)))
      continue
    }
    // 0 h et 0 L : point à 0 pour garder toutes les dates visibles
    kinds.push('zero')
    raw.push(0)
  }

  const finitePositive = raw.filter((value) => isFiniteNumber(value) && value > 0)
  const finiteAll = raw.filter((value) => isFiniteNumber(value))
  const hasInfinite = raw.some((value) => value === Infinity)
  const baseMax = finitePositive.length
    ? Math.max(...finitePositive)
    : (finiteAll.length ? Math.max(...finiteAll, 1) : 1)
  const infinityDisplay = Number((Math.max(baseMax * 1.35, 1)).toFixed(2))
  const suggestedMax = hasInfinite
    ? infinityDisplay
    : (finiteAll.length ? Math.max(...finiteAll, 0) * 1.1 || 1 : 1)

  const data = raw.map((value) => (value === Infinity ? infinityDisplay : value))

  return {
    data,
    kinds,
    infinityDisplay,
    suggestedMax,
    hasZero: kinds.includes('zero'),
    hasInfinite,
  }
}

/**
 * Métriques L/h : uniquement les taux significatifs (> 0).
 * Exclus : 0 L/h, ∞, absents, 0h+0L → tiret s’il ne reste rien.
 */
const buildHourlyConsumptionStats = (hours = [], consumption = []) => {
  const series = buildHourlyRateSeries(hours, consumption)
  const rates = series.data
    .map((value, index) => (series.kinds[index] === 'normal' && value > 0 ? value : null))
    .filter(isFiniteNumber)

  if (!rates.length) {
    return {
      mean: null,
      max: null,
      min: null,
      stddev: null,
      noData: true,
      zeroCount: series.kinds.filter((k) => k === 'zero').length,
      infiniteCount: series.kinds.filter((k) => k === 'infinite').length,
    }
  }

  const mean = rates.reduce((sum, value) => sum + value, 0) / rates.length
  const variance = rates.reduce((sum, value) => sum + (value - mean) ** 2, 0) / rates.length

  return {
    mean,
    max: Math.max(...rates),
    min: Math.min(...rates),
    stddev: Math.sqrt(variance),
    noData: false,
    zeroCount: series.kinds.filter((k) => k === 'zero').length,
    infiniteCount: series.kinds.filter((k) => k === 'infinite').length,
  }
}

function GroupsPage({ onNavigate }) {
  const chartPalette = useChartPalette()
  const [groupsData, setGroupsData] = useState(null)
  const [rapportDebut, setRapportDebut] = useState('')
  const [rapportFin, setRapportFin] = useState('')
  const [siteId, setSiteId] = useState('')
  const queryGroupId = useMemo(() => new URLSearchParams(window.location.search).get('groupId'), [])
  const queryGroupLabel = useMemo(() => new URLSearchParams(window.location.search).get('groupLabel'), [])
  const queryMode = useMemo(() => new URLSearchParams(window.location.search).get('mode'), [])
  // Par défaut : vue globale (tous les groupes, tous les sites) si on arrive sans
  // option (pas de groupId dans l'URL). Si on arrive via un lien qui cible un
  // groupe précis (queryGroupId présent, ex. depuis une alerte du Dashboard), on
  // garde le comportement existant : vue détail sur ce groupe.
  const [mode, setMode] = useState(queryMode || (queryGroupId ? 'details' : 'all'))
  const [filtering, setFiltering] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [chartPan, setChartPan] = useState(0)
  const filterSeq = useRef(0)

  const reportChoices = useMemo(() => (groupsData?.rapport_choices || groupsData?.report_choices || []), [groupsData])
  const rapportDebutIndex = useMemo(() => {
    if (!reportChoices.length) return 0
    const selectedId = rapportDebut ? String(rapportDebut) : ''
    const selectedIndex = reportChoices.findIndex((choice) => String(choice.id) === selectedId)
    return selectedIndex >= 0 ? selectedIndex : 0
  }, [rapportDebut, reportChoices])
  const rapportFinIndex = useMemo(() => {
    if (!reportChoices.length) return 0
    const selectedId = rapportFin ? String(rapportFin) : ''
    const selectedIndex = reportChoices.findIndex((choice) => String(choice.id) === selectedId)
    return selectedIndex >= 0 ? selectedIndex : reportChoices.length - 1
  }, [rapportFin, reportChoices])
  const startIndex = Math.min(rapportDebutIndex, rapportFinIndex)
  const endIndex = Math.max(rapportDebutIndex, rapportFinIndex)
  const chartWindow = useMemo(
    () => visibleChartRange(startIndex, endIndex, chartPan),
    [startIndex, endIndex, chartPan],
  )
  const { viewStart, viewEnd, maxPan, canScroll } = chartWindow

  useEffect(() => {
    // Afficher les 4 semaines les plus récentes de la période sélectionnée
    setChartPan(Math.max(0, endIndex - startIndex + 1 - MAX_CHART_WEEKS))
  }, [startIndex, endIndex])

  const loadGroupsData = async (queryParams = '', options = {}) => {
    const seq = ++filterSeq.current
    try {
      if (options.isFilter) setFiltering(true)
      const data = await apiFetch(`/api/v1/dashboard/groupes${queryParams ? `?${queryParams}` : ''}`)
      if (seq !== filterSeq.current) return
      const choices = data.rapport_choices || data.report_choices || []
      const normalizedBlocks = (data.group_blocks || []).map((block) => ({
        ...block,
        hours: buildDerivedMetric(block.hours_run || []),
        consumption_stats: buildDerivedMetric(block.consumption || []),
        volume_stats: buildDerivedMetric(block.volume || []),
        rate: block.mean_hourly_consumption_deduite != null ? block.mean_hourly_consumption_deduite : null,
      }))

      setGroupsData({
        ...data,
        group_blocks: normalizedBlocks,
      })
      // L’API Groupes ignore rapport_debut/fin : période client = 4 dernières semaines par défaut
      if (!options.preservePeriod) {
        const { first, last } = defaultPeriodIndices(choices.length)
        setRapportDebut(String(choices[first]?.id ?? ''))
        setRapportFin(String(choices[last]?.id ?? ''))
      }
      if (!options.preserveSiteSelection) {
        const nextSite = data.selected_site_id != null ? String(data.selected_site_id) : ''
        setSiteId(nextSite)
      }
    } catch (error) {
      console.warn('Groups backend unavailable:', error)
    } finally {
      if (seq === filterSeq.current) {
        setFiltering(false)
        setInitialLoading(false)
      }
    }
  }

  useEffect(() => {
    // Premier chargement : tous les groupes / tous les sites
    loadGroupsData()
  }, [])

  const runFilters = async (next = {}) => {
    // Période = filtre client uniquement (l’API Groupes ne la gère pas)
    if (next.rapportDebut != null) setRapportDebut(next.rapportDebut)
    if (next.rapportFin != null) setRapportFin(next.rapportFin)

    if (next.siteId === undefined) return

    const site = next.siteId
    setSiteId(site)
    const params = new URLSearchParams()
    if (site) params.set('site_id', site)
    await loadGroupsData(params.toString(), {
      preserveSiteSelection: true,
      preservePeriod: true,
      isFilter: true,
    })
  }

  useEffect(() => {
    if (!window.Chart || !groupsData || mode === 'all') return undefined
    const charts = []
    const fullLabels = groupsData.labels || []
    const labels = toChartLabels(fullLabels.slice(viewStart, viewEnd + 1))
    const fullLabelsWindow = fullLabels.slice(viewStart, viewEnd + 1)
    const sliceSeries = (values = []) => (values || []).slice(viewStart, viewEnd + 1)
    const baseOptions = (unit, beginZero = false, suggestedMax = undefined) => ({
      responsive: true,
      maintainAspectRatio: false,
      spanGaps: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const idx = items?.[0]?.dataIndex
              return fullLabelsWindow[idx] != null ? String(fullLabelsWindow[idx]) : ''
            },
            label: (context) => {
              const y = context.parsed?.y
              const kind = context.dataset?.pointKinds?.[context.dataIndex]
              if (kind === 'infinite') return ' ∞ L/h (conso sans heures)'
              if (y == null || !Number.isFinite(y)) return ' —'
              return ` ${y.toLocaleString('fr-FR')} ${unit}`
            },
          },
        },
      },
      scales: {
        x: {
          ticks: xAxisTicks(labels.length, chartPalette.text),
          grid: { color: chartPalette.grid },
        },
        y: {
          beginAtZero: beginZero,
          suggestedMax,
          ticks: {
            color: chartPalette.text,
            callback: (value) => `${value.toLocaleString('fr-FR')} ${unit}`,
          },
          grid: { color: chartPalette.grid },
        },
      },
    })

    const pointRadius = seriesPointRadius(labels.length)

    groupsData.group_blocks?.forEach((block) => {
      const makeChart = (elementId, data, fill, label, color, unit = 'h') => {
        const target = document.getElementById(elementId)
        if (!target) return
        const chart = createChart(target, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label,
              data: sliceSeries(data),
              borderColor: color,
              backgroundColor: `${color}20`,
              borderWidth: 2,
              tension: 0.35,
              fill,
              pointRadius,
              spanGaps: true,
            }],
          },
          options: baseOptions(unit, true),
        })
        if (chart) charts.push(chart)
      }

      makeChart(`chart-group-${block.id}-hours`, block.hours_run || [], true, block.label, block.color || '#0b3d7a', 'h')
      makeChart(`chart-group-${block.id}-consumption`, block.consumption || [], true, 'Consommation', block.color || '#0b3d7a', 'L')

      const hourlyTarget = document.getElementById(`chart-group-${block.id}-hourly-consumption`)
      if (hourlyTarget) {
        const color = block.color || '#0b3d7a'
        const hourlySeries = buildHourlyRateSeries(
          sliceSeries(block.hours_run || []),
          sliceSeries(block.consumption || []),
        )
        const slicedData = hourlySeries.data
        const slicedKinds = hourlySeries.kinds
        const pointBackgroundColor = slicedKinds.map((kind) => {
          if (kind === 'infinite') return '#b91c1c'
          if (kind === 'missing') return 'transparent'
          return color
        })
        const pointBorderColor = slicedKinds.map((kind) => {
          if (kind === 'infinite') return '#7f1d1d'
          if (kind === 'missing') return 'transparent'
          return color
        })
        const pointRadiusPts = slicedKinds.map((kind) => {
          if (kind === 'missing') return 0
          if (kind === 'infinite') return 7
          return seriesPointRadius(labels.length)
        })
        const pointStyle = slicedKinds.map((kind) => (
          kind === 'infinite' ? 'triangle' : 'circle'
        ))

        const hourlyOptions = baseOptions('L/h', true, hourlySeries.suggestedMax)
        const chart = createChart(hourlyTarget, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: 'Consommation horaire',
              data: slicedData,
              borderColor: color,
              backgroundColor: `${color}20`,
              borderWidth: 2,
              tension: 0.35,
              fill: true,
              spanGaps: true,
              pointKinds: slicedKinds,
              pointBackgroundColor,
              pointBorderColor,
              pointRadius: pointRadiusPts,
              pointHoverRadius: pointRadiusPts.map((radius) => Math.max(radius, 4) + 2),
              pointStyle,
              pointBorderWidth: 2,
            }],
          },
          options: hourlyOptions,
          plugins: [{
            id: `hourly-infinite-labels-${block.id}`,
            afterDatasetsDraw(chartInstance) {
              const { ctx } = chartInstance
              const meta = chartInstance.getDatasetMeta(0)
              if (!meta?.data) return
              ctx.save()
              ctx.font = 'bold 11px sans-serif'
              ctx.fillStyle = '#b91c1c'
              ctx.textAlign = 'center'
              meta.data.forEach((point, index) => {
                if (slicedKinds[index] !== 'infinite' || !point) return
                const { x, y } = point.getProps(['x', 'y'], true)
                if (!Number.isFinite(x) || !Number.isFinite(y)) return
                ctx.fillText('∞', x, y - 12)
              })
              ctx.restore()
            },
          }],
        })
        if (chart) charts.push(chart)
      }
    })

    const onWheel = (event) => {
      if (!canScroll) return
      event.preventDefault()
      const step = event.deltaY > 0 ? 1 : -1
      setChartPan((prev) => Math.min(maxPan, Math.max(0, prev + step)))
    }
    const chartBoxes = document.querySelectorAll('.group-card .chart-box')
    chartBoxes.forEach((box) => box.addEventListener('wheel', onWheel, { passive: false }))

    return () => {
      charts.forEach((chart) => chart.destroy())
      chartBoxes.forEach((box) => box.removeEventListener('wheel', onWheel))
    }
  }, [chartPalette, groupsData, viewStart, viewEnd, mode, canScroll, maxPan])

  const selectedSite = groupsData?.sites?.find((site) => String(site.id) === String(siteId)) ?? groupsData?.sites?.[0]

  /** Agrégats site alignés sur les 3 blocs groupe (fenêtre période). */
  const siteBlockStats = useMemo(() => {
    const filtered = (groupsData?.group_blocks || []).filter(
      (block) => !siteId || String(block.site_id) === String(siteId),
    )
    const seriesLen = (groupsData?.labels || []).length
    const hoursAgg = Array.from({ length: seriesLen }, () => 0)
    const consAgg = Array.from({ length: seriesLen }, () => 0)

    filtered.forEach((block) => {
      ;(block.hours_run || []).forEach((value, index) => {
        if (index < seriesLen) hoursAgg[index] += safeNum(value)
      })
      ;(block.consumption || []).forEach((value, index) => {
        if (index < seriesLen) consAgg[index] += safeNum(value)
      })
    })

    const hoursWindow = hoursAgg.slice(startIndex, endIndex + 1)
    const consWindow = consAgg.slice(startIndex, endIndex + 1)
    return {
      hourly: buildHourlyConsumptionStats(hoursWindow, consWindow),
      consumption: buildPeriodSeriesStats(consWindow),
      hours: buildPeriodSeriesStats(hoursWindow),
    }
  }, [groupsData, siteId, startIndex, endIndex])

  if (initialLoading || !groupsData) {
    return (
      <div className="app-shell dashboard-shell">
        <Topbar activeView="groups" onNavigate={onNavigate} />
        <PageLoader label="Analyse des groupes électrogènes…" />
      </div>
    )
  }

  return (
    <div className="app-shell dashboard-shell">
      <Topbar activeView="groups" onNavigate={onNavigate} />

      {filtering && (
        <div className="cf-filter-overlay" role="status" aria-live="polite">
          <PageLoader fullscreen={false} label="Application du filtre…" />
        </div>
      )}

      <PageEnter>
      <main className={`groups-grid ${filtering ? 'is-filtering' : ''}`}>
        <WelcomeBanner subtitle="Tous les groupes d’abord — affinez avec les filtres si besoin." />
        <form className="groups-filter-bar" onSubmit={(event) => event.preventDefault()}>
          <div className="filter-field">
            <label htmlFor="rapport_debut">Période — début</label>
            <select
              id="rapport_debut"
              value={rapportDebut}
              disabled={filtering}
              onChange={(event) => runFilters({ rapportDebut: event.target.value })}
            >
              {(groupsData.rapport_choices || []).map((choice) => (
                <option key={choice.id} value={String(choice.id)}>{choice.label}</option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="rapport_fin">Période — fin</label>
            <select
              id="rapport_fin"
              value={rapportFin}
              disabled={filtering}
              onChange={(event) => runFilters({ rapportFin: event.target.value })}
            >
              {(groupsData.rapport_choices || []).map((choice) => (
                <option key={choice.id} value={String(choice.id)}>{choice.label}</option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="site_id">Site</label>
            <select
              id="site_id"
              value={siteId}
              disabled={filtering}
              onChange={(event) => runFilters({ siteId: event.target.value })}
            >
              <option value="">Tous les sites</option>
              {(groupsData.sites || []).map((site) => (
                <option key={site.id} value={String(site.id)}>{site.nom_site}</option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="view_mode">Affichage</label>
            <select
              id="view_mode"
              value={mode}
              disabled={filtering}
              onChange={(event) => setMode(event.target.value)}
            >
              <option value="all">Vue d’ensemble</option>
              <option value="details">Détail</option>
            </select>
          </div>
        </form>

        {(mode !== 'all' && siteId) && (
          <section className="metric-section">
            <div className="section-title-wrap">
              <span className="metric-label">Synthèse du site</span>
              <h2>{selectedSite?.nom_site || 'Site'}</h2>
            </div>
            <div className="summary-strip">
              <div className="summary-chip">
                <span>Consommation horaire moyenne</span>
                <strong>{formatMetric(siteBlockStats.hourly.mean, 2)} L/h</strong>
              </div>
              <div className="summary-chip">
                <span>Consommation semaine N</span>
                <strong>{formatMetric(siteBlockStats.consumption.weekN)} L</strong>
              </div>
              <div className="summary-chip">
                <span>Consommation totale (période)</span>
                <strong>{formatMetric(siteBlockStats.consumption.total)} L</strong>
              </div>
              <div className="summary-chip">
                <span>Delta horaire moyen</span>
                <strong>{formatMetric(siteBlockStats.hours.mean)} h</strong>
              </div>
            </div>
          </section>
        )}

        <section className="groups-list">
          {mode === 'all' ? (
            <section className="site-overview">
              <div className="section-title-wrap">
                <span className="metric-label">Vue d’ensemble</span>
                <h2>Tous les groupes électrogènes</h2>
              </div>
              <div className="dashboard-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Groupe</th>
                      <th>Site</th>
                      <th>{METRIC_LABELS.hourlyConsumptionMean}</th>
                      <th>{METRIC_LABELS.consumptionWeekN}</th>
                      <th>{METRIC_LABELS.hoursDeltaMean}</th>
                      <th>{METRIC_LABELS.autonomyRemaining}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(groupsData.group_blocks || []).map((g) => {
                      const siteName = g.site_nom || g.nom_site || g.site_name || (groupsData.sites || []).find((s) => String(s.id) === String(g.site_id))?.nom_site || ''
                      const hoursWindow = (g.hours_run || []).slice(startIndex, endIndex + 1)
                      const consWindow = (g.consumption || []).slice(startIndex, endIndex + 1)
                      const hourly = buildHourlyConsumptionStats(hoursWindow, consWindow)
                      const consumption = buildPeriodSeriesStats(consWindow)
                      const hours = buildPeriodSeriesStats(hoursWindow)
                      // Même calcul d’autonomie que la vue détail (pas le flag backend 0 h)
                      const autonomyEntity = buildGroupAutonomyEntity(
                        g,
                        groupsData.group_blocks || [],
                        hourly.mean,
                      )
                      const severity = getAutonomySeverity(autonomyEntity)
                      return (
                        <tr key={g.id} className={`autonomy-row autonomy-row--${severity}`}>
                          <td>{g.label}</td>
                          <td>{siteName}</td>
                          <td>{formatMetric(hourly.mean, 2)}</td>
                          <td>{formatMetric(consumption.weekN)}</td>
                          <td>{formatMetric(hours.mean)}</td>
                          <td>
                            <div className={`autonomy-cell autonomy-cell--${severity}`} title={formatAutonomyValue(autonomyEntity)}>
                              <span className="autonomy-cell-value">{formatAutonomyValue(autonomyEntity)}</span>
                              <span className="autonomy-cell-label">{getAutonomySeverityLabel(severity)}</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            (groupsData.group_blocks || []).filter((group) => {
              if (queryGroupId) return String(group.id) === String(queryGroupId)
              if (queryGroupLabel) return String(group.label) === String(queryGroupLabel)
              return true
            }).map((group) => (
            <article key={group.id} className="group-card" style={{ borderLeft: `4px solid ${group.color || '#0b3d7a'}` }}>
              {(() => {
                const hoursWindow = (group.hours_run || []).slice(startIndex, endIndex + 1)
                const consumptionWindow = (group.consumption || []).slice(startIndex, endIndex + 1)
                const hourlyStats = buildHourlyConsumptionStats(hoursWindow, consumptionWindow)
                const autonomyEntity = buildGroupAutonomyEntity(
                  group,
                  groupsData.group_blocks || [],
                  hourlyStats.mean,
                )
                const severity = getAutonomySeverity(autonomyEntity)
                return (
                  <div className={`group-autonomy-hero group-autonomy-hero--${severity}`}>
                    <div className="group-autonomy-hero-copy">
                      <span className="group-autonomy-hero-kicker">Temps restant</span>
                      <p className="group-autonomy-hero-hint">
                        Avant rupture de stock pour ce groupe, d’après les derniers relevés.
                      </p>
                    </div>
                    <div className="group-autonomy-hero-value-wrap">
                      <AutonomyBadge entity={autonomyEntity} size="lg" />
                    </div>
                  </div>
                )
              })()}
              <div className="group-card-head">
                <span className="metric-label">Groupe</span>
                <h3>{group.label}</h3>
                { (group.site_nom || selectedSite?.nom_site) ? (
                  <p className="group-header-meta">{group.site_nom || selectedSite?.nom_site}</p>
                ) : null }

                {group.latest_main_volume != null && (
                  <p className="group-header-meta">Cuve principale : {group.latest_main_volume} litres</p>
                )}
                {group.latest_daily_volume != null && (
                  <p className="group-header-meta">Cuve journalière : {group.latest_daily_volume} litres</p>
                )}
              </div>

              <div className="group-metric-grid">
                {(() => {
                  const hoursWindow = (group.hours_run || []).slice(startIndex, endIndex + 1)
                  const consumptionWindow = (group.consumption || []).slice(startIndex, endIndex + 1)
                  const hourlyStats = buildHourlyConsumptionStats(hoursWindow, consumptionWindow)
                  const consumptionStats = buildPeriodSeriesStats(consumptionWindow)
                  const hoursStats = buildPeriodSeriesStats(hoursWindow)
                  return (
                    <>
                      <div className="metric-stat-block">
                        <span className="curve-title">Delta horaire</span>
                        <div className="group-stats">
                          <div>
                            <span>Delta horaire dernière semaine (semaine N)</span>
                            <strong>{formatMetric(hoursStats.weekN)} h</strong>
                          </div>
                          <div>
                            <span>Delta horaire avant-dernière semaine (semaine N-1)</span>
                            <strong>{formatMetric(hoursStats.weekN1)} h</strong>
                          </div>
                          <div>
                            <span>Delta horaire total sur la période de la courbe</span>
                            <strong>{formatMetric(hoursStats.total)} h</strong>
                          </div>
                          <div>
                            <span>Delta horaire moyen</span>
                            <strong>{formatMetric(hoursStats.mean)} h</strong>
                          </div>
                        </div>
                      </div>

                      <div className="metric-stat-block">
                        <span className="curve-title">Consommation</span>
                        <div className="group-stats">
                          <div>
                            <span>Consommation dernière semaine (semaine N)</span>
                            <strong>{formatMetric(consumptionStats.weekN)} L</strong>
                          </div>
                          <div>
                            <span>Consommation avant-dernière semaine (semaine N-1)</span>
                            <strong>{formatMetric(consumptionStats.weekN1)} L</strong>
                          </div>
                          <div>
                            <span>Consommation totale sur la période de la courbe</span>
                            <strong>{formatMetric(consumptionStats.total)} L</strong>
                          </div>
                          <div>
                            <span>Consommation moyenne</span>
                            <strong>{formatMetric(consumptionStats.mean)} L</strong>
                          </div>
                        </div>
                      </div>

                      <div className="metric-stat-block">
                        <span className="curve-title">Consommation horaire</span>
                        <p className="group-block-note">Sur les valeurs non nulles</p>
                        {hourlyStats.noData ? (
                          <div className="group-stats">
                            <div>
                              <span>Consommation horaire moyenne</span>
                              <strong style={{ color: 'var(--text-muted, #6b7280)' }}>-L/h</strong>
                            </div>
                            <div>
                              <span>Consommation horaire max</span>
                              <strong style={{ color: 'var(--text-muted, #6b7280)' }}>-L/h</strong>
                            </div>
                            <div>
                              <span>Consommation horaire min</span>
                              <strong style={{ color: 'var(--text-muted, #6b7280)' }}>-L/h</strong>
                            </div>
                            <div>
                              <span>Écart-type</span>
                              <strong style={{ color: 'var(--text-muted, #6b7280)' }}>-L/h</strong>
                            </div>
                          </div>
                        ) : (
                          <div className="group-stats">
                            <div>
                              <span>Consommation horaire moyenne</span>
                              <strong>{formatMetric(hourlyStats.mean, 2)} L/h</strong>
                            </div>
                            <div>
                              <span>Consommation horaire max</span>
                              <strong>{formatMetric(hourlyStats.max, 2)} L/h</strong>
                            </div>
                            <div>
                              <span>Consommation horaire min</span>
                              <strong>{formatMetric(hourlyStats.min, 2)} L/h</strong>
                            </div>
                            <div>
                              <span>Écart-type</span>
                              <strong>{formatMetric(hourlyStats.stddev, 2)} L/h</strong>
                            </div>
                          </div>
                        )}
                      </div>

                    </>
                  )
                })()}
              </div>

              <div className="group-curve-grid">
                <div className="chart-card">
                  <span className="curve-title">Courbe delta horaire</span>
                  <div className={`chart-box small-box${canScroll ? ' is-scrollable' : ''}`}><canvas id={`chart-group-${group.id}-hours`} /></div>
                </div>
                <div className="chart-card">
                  <span className="curve-title">Courbe consommation</span>
                  <div className={`chart-box small-box${canScroll ? ' is-scrollable' : ''}`}><canvas id={`chart-group-${group.id}-consumption`} /></div>
                </div>
                <div className="chart-card">
                  <span className="curve-title">Courbe consommation horaire</span>
                  {(() => {
                    const hourlySeries = buildHourlyRateSeries(
                      (group.hours_run || []).slice(startIndex, endIndex + 1),
                      (group.consumption || []).slice(startIndex, endIndex + 1),
                    )
                    if (!hourlySeries.hasInfinite) return null
                    return (
                      <div className="curve-anomaly-legend" aria-label="Légende des valeurs aberrantes">
                        <span className="curve-anomaly-legend__item curve-anomaly-legend__item--infinite">
                          ▲ ∞ L/h — conso sans heures
                        </span>
                      </div>
                    )
                  })()}
                  <div className={`chart-box small-box${canScroll ? ' is-scrollable' : ''}`}><canvas id={`chart-group-${group.id}-hourly-consumption`} /></div>
                </div>
              </div>
            </article>
            )))
          }
        </section>
      </main>
      </PageEnter>
    </div>
  )
}

export default GroupsPage