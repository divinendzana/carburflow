import React, { useEffect, useMemo, useState } from 'react'
import Topbar from '../components/Topbar.jsx'
import WelcomeBanner from '../components/WelcomeBanner.jsx'
import { apiFetch } from '../auth.js'
import AutonomyBadge from '../components/AutonomyBadge.jsx'
import PageLoader from '../components/PageLoader.jsx'
import PageEnter from '../components/PageEnter.jsx'
import { useChartPalette } from '../hooks/useChartPalette.js'
import {
  formatAutonomyValue,
  getAutonomySeverity,
  getAutonomySeverityLabel,
  METRIC_LABELS,
} from '../utils/format.js'

const buildDerivedMetric = (values = []) => {
  const normalizedValues = (values || []).map((value) => (typeof value === 'number' ? value : 0)).filter((value) => value > 0)
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

const safeNum = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0)

const formatMetric = (value, digits = 1) => (
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—'
)

/** Stats sur une série (semaine N / N-1 / total / moyenne). */
const buildPeriodSeriesStats = (values = []) => {
  const series = (values || []).map(safeNum)
  if (!series.length) {
    return { weekN: null, weekN1: null, total: null, mean: null }
  }
  const total = series.reduce((sum, value) => sum + value, 0)
  return {
    weekN: series[series.length - 1],
    weekN1: series.length > 1 ? series[series.length - 2] : null,
    total,
    mean: total / series.length,
  }
}

/**
 * Consommation horaire (L/h) sur les périodes où les heures sont non nulles (> 0).
 */
const buildHourlyConsumptionStats = (hours = [], consumption = []) => {
  const rates = []
  const len = Math.max(hours.length, consumption.length)
  for (let index = 0; index < len; index += 1) {
    const hoursValue = safeNum(hours[index])
    if (hoursValue <= 0) continue
    rates.push(safeNum(consumption[index]) / hoursValue)
  }
  if (!rates.length) {
    return { mean: null, max: null, min: null, stddev: null }
  }
  const mean = rates.reduce((sum, value) => sum + value, 0) / rates.length
  const variance = rates.reduce((sum, value) => sum + (value - mean) ** 2, 0) / rates.length
  return {
    mean,
    max: Math.max(...rates),
    min: Math.min(...rates),
    stddev: Math.sqrt(variance),
  }
}

const renderDelta = (metric, suffix = '') => {
  if (metric?.has_previous_period === false) {
    return <small className="delta-neutral">{METRIC_LABELS.noPreviousPeriod}</small>
  }

  const deltaValue = typeof metric?.variation_pct === 'number'
    ? `${metric.variation_pct >= 0 ? '+' : ''}${metric.variation_pct.toFixed(1)} %`
    : '—'
  const deltaClass = (metric?.variation_pct ?? 0) >= 0 ? 'delta-up' : 'delta-down'
  return <small className={deltaClass}>{deltaValue}{suffix}</small>
}

const renderMeanDelta = (metric, suffix = '') => {
  if (metric?.has_previous_period === false) {
    return <small className="delta-neutral">{METRIC_LABELS.noPreviousPeriod}</small>
  }

  const deltaValue = typeof metric?.mean_variation_pct === 'number'
    ? `${metric.mean_variation_pct >= 0 ? '+' : ''}${metric.mean_variation_pct.toFixed(1)} %`
    : '—'
  const deltaClass = (metric?.mean_variation_pct ?? 0) >= 0 ? 'delta-up' : 'delta-down'
  return <small className={deltaClass}>{deltaValue}{suffix}</small>
}


function GroupsPage({ onNavigate }) {
  const chartPalette = useChartPalette()
  const [groupsData, setGroupsData] = useState(null)
  const [rapportDebut, setRapportDebut] = useState('')
  const [rapportFin, setRapportFin] = useState('')
  const [draftRapportDebut, setDraftRapportDebut] = useState('')
  const [draftRapportFin, setDraftRapportFin] = useState('')
  const [siteId, setSiteId] = useState('')
  const [draftSiteId, setDraftSiteId] = useState('')
  const queryGroupId = useMemo(() => new URLSearchParams(window.location.search).get('groupId'), [])
  const queryGroupLabel = useMemo(() => new URLSearchParams(window.location.search).get('groupLabel'), [])
  const queryMode = useMemo(() => new URLSearchParams(window.location.search).get('mode'), [])
  // Par défaut : vue globale (tous les groupes, tous les sites) si on arrive sans
  // option (pas de groupId dans l'URL). Si on arrive via un lien qui cible un
  // groupe précis (queryGroupId présent, ex. depuis une alerte du Dashboard), on
  // garde le comportement existant : vue détail sur ce groupe.
  const [mode, setMode] = useState(queryMode || (queryGroupId ? 'details' : 'all'))
  const [draftMode, setDraftMode] = useState(queryMode || (queryGroupId ? 'details' : 'all'))
  const [filtering, setFiltering] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

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

  const safeValue = (value) => (typeof value === 'number' ? value : 0)

  const loadGroupsData = async (queryParams = '', options = {}) => {
    try {
      if (options.isFilter) setFiltering(true)
      const data = await apiFetch(`/api/v1/dashboard/groupes${queryParams ? `?${queryParams}` : ''}`)
      const choices = data.rapport_choices || data.report_choices || []
      const normalizedBlocks = (data.group_blocks || []).map((block) => ({
        ...block,
        hours: buildDerivedMetric(block.hours_run || []),
        consumption_stats: buildDerivedMetric(block.consumption || []),
        volume_stats: buildDerivedMetric(block.volume || []),
        rate: block.mean_hourly_consumption != null ? block.mean_hourly_consumption : null,
      }))

      setGroupsData({
        ...data,
        group_blocks: normalizedBlocks,
      })
      const nextDebut = data.selected_rapport_debut != null ? String(data.selected_rapport_debut) : String(choices[0]?.id ?? '')
      const nextFin = data.selected_rapport_fin != null ? String(data.selected_rapport_fin) : String(choices[choices.length - 1]?.id ?? '')
      setRapportDebut(nextDebut)
      setRapportFin(nextFin)
      setDraftRapportDebut(nextDebut)
      setDraftRapportFin(nextFin)
      if (!options.preserveSiteSelection) {
        const nextSite = data.selected_site_id != null ? String(data.selected_site_id) : ''
        setSiteId(nextSite)
        setDraftSiteId(nextSite)
      }
    } catch (error) {
      console.warn('Groups backend unavailable:', error)
    } finally {
      setFiltering(false)
      setInitialLoading(false)
    }
  }

  useEffect(() => {
    // Premier chargement : tous les groupes / tous les sites
    loadGroupsData()
  }, [])

  const applyFilters = async (event) => {
    event.preventDefault()
    setSiteId(draftSiteId)
    setMode(draftMode)
    setRapportDebut(draftRapportDebut)
    setRapportFin(draftRapportFin)
    const params = new URLSearchParams()
    if (draftRapportDebut) params.set('rapport_debut', draftRapportDebut)
    if (draftRapportFin) params.set('rapport_fin', draftRapportFin)
    if (draftSiteId) params.set('site_id', draftSiteId)
    if (draftMode) params.set('mode', draftMode)
    await loadGroupsData(params.toString(), { preserveSiteSelection: true, isFilter: true })
  }

  useEffect(() => {
    if (!window.Chart || !groupsData) return undefined
    const charts = []
    const labels = (groupsData.labels || []).slice(startIndex, endIndex + 1)
    const sliceSeries = (values = []) => (values || []).slice(startIndex, endIndex + 1)
    const baseOptions = (unit, beginZero = false) => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => ` ${context.parsed.y.toLocaleString('fr-FR')} ${unit}`,
          },
        },
      },
      scales: {
        x: { ticks: { color: chartPalette.text }, grid: { color: chartPalette.grid } },
        y: { beginAtZero: beginZero, ticks: { color: chartPalette.text, callback: (value) => `${value.toLocaleString('fr-FR')} ${unit}` }, grid: { color: chartPalette.grid } },
      },
    })

    groupsData.group_blocks?.forEach((block) => {
      const makeChart = (elementId, data, fill, label, color, unit = 'h') => {
        const target = document.getElementById(elementId)
        if (!target) return
        const chart = new Chart(target, {
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
              pointRadius: 4,
            }],
          },
          options: baseOptions(unit, true),
        })
        charts.push(chart)
      }

      makeChart(`chart-group-${block.id}-hours`, block.hours_run || [], true, block.label, block.color || '#0b3d7a', 'h')
      makeChart(`chart-group-${block.id}-consumption`, block.consumption || [], true, 'Consommation', block.color || '#0b3d7a', 'L')
      const hourlyValues = (block.hours_run || []).map((hours, index) => {
        const hoursValue = safeValue(hours)
        const consumptionValue = safeValue((block.consumption || [])[index])
        return hoursValue > 0 ? Number((consumptionValue / hoursValue).toFixed(2)) : 0
      })
      makeChart(`chart-group-${block.id}-hourly-consumption`, hourlyValues, true, 'Consommation horaire', block.color || '#0b3d7a', 'L/h')
    })

    return () => charts.forEach((chart) => chart.destroy())
  }, [chartPalette, groupsData, startIndex, endIndex])

  const selectedSite = groupsData?.sites?.find((site) => String(site.id) === String(siteId)) ?? groupsData?.sites?.[0]

  const siteHours = useMemo(() => {
    const filtered = (groupsData?.group_blocks || []).filter((block) => !siteId || String(block.site_id) === String(siteId))
    const values = filtered.flatMap((block) => block.hours_run || [])
    return buildDerivedMetric(values)
  }, [groupsData, siteId])

  const siteConsumption = useMemo(() => {
    const values = (groupsData?.group_blocks || []).flatMap((block) => block.consumption || [])
    return buildDerivedMetric(values)
  }, [groupsData])

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
        <form className="groups-filter-bar" onSubmit={applyFilters}>
          <div className="filter-field">
            <label htmlFor="rapport_debut">Période — début</label>
            <select id="rapport_debut" value={draftRapportDebut} onChange={(event) => setDraftRapportDebut(event.target.value)}>
              {(groupsData.rapport_choices || []).map((choice) => (
                <option key={choice.id} value={String(choice.id)}>{choice.label}</option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="rapport_fin">Période — fin</label>
            <select id="rapport_fin" value={draftRapportFin} onChange={(event) => setDraftRapportFin(event.target.value)}>
              {(groupsData.rapport_choices || []).map((choice) => (
                <option key={choice.id} value={String(choice.id)}>{choice.label}</option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="site_id">Site</label>
            <select id="site_id" value={draftSiteId} onChange={(event) => setDraftSiteId(event.target.value)}>
              <option value="">Tous les sites</option>
              {(groupsData.sites || []).map((site) => (
                <option key={site.id} value={String(site.id)}>{site.nom_site}</option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="view_mode">Affichage</label>
            <select id="view_mode" value={draftMode} onChange={(event) => setDraftMode(event.target.value)}>
              <option value="all">Vue d’ensemble</option>
              <option value="details">Détail</option>
            </select>
          </div>
          <div className="filter-actions">
            <button type="submit" className="filter-submit" disabled={filtering}>
              {filtering ? 'Filtrage…' : 'Appliquer'}
            </button>
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
                <span>Heures de marche (total)</span>
                <strong>{siteHours.total?.toFixed(1) ?? '—'} h</strong>
                {renderDelta(siteHours)}
              </div>
              <div className="summary-chip">
                <span>Heures de marche (moyenne)</span>
                <strong>{siteHours.mean?.toFixed(1) ?? '—'} h</strong>
                {renderMeanDelta(siteHours)}
              </div>
              <div className="summary-chip">
                <span>Carburant consommé (total)</span>
                <strong>{siteConsumption.total?.toFixed(1) ?? '—'} L</strong>
                {renderDelta(siteConsumption)}
              </div>
              <div className="summary-chip">
                <span>Carburant consommé (moyenne)</span>
                <strong>{siteConsumption.mean?.toFixed(1) ?? '—'} L</strong>
                {renderMeanDelta(siteConsumption)}
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
                      <th>{METRIC_LABELS.hoursMean}</th>
                      <th>{METRIC_LABELS.consumptionMean}</th>
                      <th>{METRIC_LABELS.autonomyRemaining}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(groupsData.group_blocks || []).map((g) => {
                      const siteName = g.site_nom || g.nom_site || g.site_name || (groupsData.sites || []).find((s) => String(s.id) === String(g.site_id))?.nom_site || ''
                      const severity = getAutonomySeverity(g)
                      return (
                        <tr key={g.id} className={`autonomy-row autonomy-row--${severity}`}>
                          <td>{g.label}</td>
                          <td>{siteName}</td>
                          <td>{g.hours?.mean?.toFixed(1) ?? '—'} h</td>
                          <td>{g.consumption_stats?.mean?.toFixed(1) ?? '—'} L</td>
                          <td>
                            <div className={`autonomy-cell autonomy-cell--${severity}`} title={formatAutonomyValue(g)}>
                              <span className="autonomy-cell-value">{formatAutonomyValue(g)}</span>
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
                const severity = getAutonomySeverity(group)
                return (
                  <div className={`group-autonomy-hero group-autonomy-hero--${severity}`}>
                    <div className="group-autonomy-hero-copy">
                      <span className="group-autonomy-hero-kicker">Temps restant estimé</span>
                      <p className="group-autonomy-hero-hint">
                        Avant rupture de stock pour ce groupe, d’après les derniers relevés.
                      </p>
                    </div>
                    <div className="group-autonomy-hero-value-wrap">
                      <AutonomyBadge entity={group} size="lg" />
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
                        <span className="curve-title">Consommation horaire</span>
                        <p className="group-block-note">Sur les valeurs non nulles</p>
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
                    </>
                  )
                })()}
              </div>

              <div className="group-curve-grid">
                <div className="chart-card">
                  <span className="curve-title">Courbe heures de fonctionnement</span>
                  <div className="chart-box small-box"><canvas id={`chart-group-${group.id}-hours`} /></div>
                </div>
                <div className="chart-card">
                  <span className="curve-title">Courbe consommation</span>
                  <div className="chart-box small-box"><canvas id={`chart-group-${group.id}-consumption`} /></div>
                </div>
                <div className="chart-card">
                  <span className="curve-title">Courbe consommation horaire</span>
                  <div className="chart-box small-box"><canvas id={`chart-group-${group.id}-hourly-consumption`} /></div>
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