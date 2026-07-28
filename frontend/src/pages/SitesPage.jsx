import React, { useEffect, useMemo, useState } from 'react'
import Topbar from '../components/Topbar.jsx'
import WelcomeBanner from '../components/WelcomeBanner.jsx'
import { apiFetch } from '../auth.js'
import AutonomyBadge from '../components/AutonomyBadge.jsx'
import PageLoader from '../components/PageLoader.jsx'
import PageEnter from '../components/PageEnter.jsx'
import { useChartPalette } from '../hooks/useChartPalette.js'
import { createChart, defaultPeriodIndices, MAX_CHART_WEEKS, seriesPointRadius, toChartLabels, visibleChartRange, xAxisTicks } from '../utils/chartAxis.js'
import { formatAutonomyValue, getAutonomySeverity } from '../utils/format.js'

function SitesPage({ onNavigate }) {
  const chartPalette = useChartPalette()
  const [sitesDashboard, setsitesDashboard] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [startIdx, setStartIdx] = useState(0)
  const [endIdx, setEndIdx] = useState(0)
  const [siteId, setSiteId] = useState('')
  const [chartPan, setChartPan] = useState(0)
  const querySiteId = useMemo(() => new URLSearchParams(window.location.search).get('siteId'), [])
  const querySiteName = useMemo(() => new URLSearchParams(window.location.search).get('siteName'), [])
  const queryMode = useMemo(() => new URLSearchParams(window.location.search).get('mode'), [])
  // Par défaut : vue globale (tous les sites) si on arrive sans option (pas de
  // siteId dans l'URL). Si on arrive via un lien qui cible un site précis
  // (querySiteId présent, ex. depuis une alerte du Dashboard), on garde le
  // comportement existant : vue détail sur ce site.
  const [mode, setMode] = useState(queryMode || (querySiteId ? 'details' : 'all'))

  const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value)

  const windowStats = (values = [], start, end, options = {}) => {
    const ignoreZeros = options.ignoreZeros ?? false
    // Conserve null (pas de relevé) — ne convertit pas en 0
    const series = values || []
    const finiteOf = (arr) => arr.filter(isFiniteNumber)
    const meaningfulOf = (arr) => {
      const finite = finiteOf(arr)
      return ignoreZeros ? finite.filter((value) => value > 0) : finite
    }

    const window = series.slice(start, end + 1)
    const meaningfulWindow = meaningfulOf(window)
    const total = meaningfulWindow.reduce((sum, value) => sum + value, 0)
    const mean = meaningfulWindow.length ? total / meaningfulWindow.length : 0

    const prevWindowLength = end - start + 1
    const prevStart = start - prevWindowLength
    const prevEnd = start - 1
    const prevWindow = prevStart >= 0 ? series.slice(prevStart, prevEnd + 1) : []
    const meaningfulPrevWindow = meaningfulOf(prevWindow)
    const prevTotal = meaningfulPrevWindow.reduce((sum, value) => sum + value, 0)
    const prevMean = meaningfulPrevWindow.length ? prevTotal / meaningfulPrevWindow.length : 0

    const meaningfulValues = meaningfulOf(series)
    const allTimeMean = meaningfulValues.length ? meaningfulValues.reduce((sum, value) => sum + value, 0) / meaningfulValues.length : 0
    const variance = meaningfulValues.length
      ? meaningfulValues.reduce((sum, value) => sum + (value - allTimeMean) ** 2, 0) / meaningfulValues.length
      : 0
    const allTimeStddev = Math.sqrt(variance)

    const variationPct = prevTotal === 0 ? null : ((total - prevTotal) / prevTotal) * 100
    const meanVariationPct = prevMean === 0 ? null : ((mean - prevMean) / prevMean) * 100

    let latest = null
    for (let i = window.length - 1; i >= 0; i -= 1) {
      if (isFiniteNumber(window[i])) {
        latest = window[i]
        break
      }
    }

    return {
      total: Number(total.toFixed(1)),
      mean: Number(mean.toFixed(1)),
      latest: latest == null ? 0 : Number(latest.toFixed(1)),
      previous_total: meaningfulPrevWindow.length ? Number(prevTotal.toFixed(1)) : null,
      previous_mean: meaningfulPrevWindow.length ? Number(prevMean.toFixed(1)) : null,
      variation_pct: variationPct === null ? null : Number(variationPct.toFixed(1)),
      mean_variation_pct: meanVariationPct === null ? null : Number(meanVariationPct.toFixed(1)),
      all_time_mean: Number(allTimeMean.toFixed(1)),
      all_time_stddev: Number(allTimeStddev.toFixed(1)),
      has_previous_period: meaningfulPrevWindow.length > 0,
    }
  }

  const renderDelta = (metric, suffix = '') => {
    if (metric?.has_previous_period === false) {
      return <small className="delta-neutral"></small>
    }

    const deltaValue = typeof metric?.variation_pct === 'number'
      ? `${metric.variation_pct >= 0 ? '+' : ''}${metric.variation_pct.toFixed(1)} %`
      : '—'
    const deltaClass = (metric?.variation_pct ?? 0) >= 0 ? 'delta-up' : 'delta-down'
    return <small className={deltaClass}>{deltaValue}{suffix}</small>
  }

  const renderMeanDelta = (metric, suffix = '') => {
    if (metric?.has_previous_period === false) {
      return <small className="delta-neutral"></small>
    }

    const deltaValue = typeof metric?.mean_variation_pct === 'number'
      ? `${metric.mean_variation_pct >= 0 ? '+' : ''}${metric.mean_variation_pct.toFixed(1)} %`
      : '—'
    const deltaClass = (metric?.mean_variation_pct ?? 0) >= 0 ? 'delta-up' : 'delta-down'
    return <small className={deltaClass}>{deltaValue}{suffix}</small>
  }

  useEffect(() => {
    const loadSitesData = async () => {
      try {
        setLoadError('')
        const data = await apiFetch('/api/v1/dashboard/sites');
        if (!data?.labels || !Array.isArray(data.labels)) {
          throw new Error('Labels non valides dans les données de l\'API site')
        }
        const rawHours = data.hoursSeries || [];
        const hoursList = Array.isArray(rawHours) ? rawHours : Object.values(rawHours);
        setsitesDashboard({
          labels: data.labels,
          volumeSeries: data.volumeSeries || [],
          hoursSeries: hoursList.map((site) => ({
            id: site.id,
            nom_site: site.nom_site,
            datasets: site.datasets || [],
          })),
          consumptionSeries: data.consumptionSeries || [],
          autonomyBySite: data.autonomyBySite || {},
          defaultSiteId: data.defaultSiteId,
        });
      } catch (error) {
        console.warn('Site backend unavailable.', error);
        setsitesDashboard(null)
        setLoadError(error.message || 'Impossible de charger les sites.')
      }
    }

    loadSitesData()
  }, [])

  const siteOptions = useMemo(() => {
    if (!sitesDashboard) return []
    const byId = new Map()
    ;[...(sitesDashboard.volumeSeries || []), ...(sitesDashboard.consumptionSeries || []), ...(sitesDashboard.hoursSeries || [])].forEach((site) => {
      byId.set(String(site.id), site)
    })
    return [...byId.values()]
  }, [sitesDashboard])

  useEffect(() => {
    if (!sitesDashboard) return

    if (querySiteId && sitesDashboard) {
      const matchingSite = siteOptions.find((site) => String(site.id) === querySiteId || site.nom_site === querySiteName)
      if (matchingSite) {
        setSiteId(String(matchingSite.id))
      }
    }

    if (sitesDashboard.labels?.length) {
      const { first, last } = defaultPeriodIndices(sitesDashboard.labels.length)
      setStartIdx(first)
      setEndIdx(last)
    }
  }, [sitesDashboard, querySiteId, querySiteName, siteOptions])

  const periodStart = Math.min(startIdx, endIdx)
  const periodEnd = Math.max(startIdx, endIdx)
  const chartWindow = useMemo(
    () => visibleChartRange(periodStart, periodEnd, chartPan),
    [periodStart, periodEnd, chartPan],
  )
  const { viewStart, viewEnd, maxPan, canScroll } = chartWindow

  useEffect(() => {
    setChartPan(Math.max(0, periodEnd - periodStart + 1 - MAX_CHART_WEEKS))
  }, [periodStart, periodEnd])

  const selectedSite = useMemo(() => {
    if (!sitesDashboard || mode === 'all' || !siteId) return null
    return [...(sitesDashboard.volumeSeries || []), ...(sitesDashboard.consumptionSeries || []), ...(sitesDashboard.hoursSeries || [])].find((entry) => String(entry.id) === String(siteId)) || null
  }, [sitesDashboard, siteId, mode])

  const aggregateSeries = (series = []) => {
    if (!series.length) return []
    const maxLength = Math.max(...series.map((entry) => (entry?.data || []).length))
    return Array.from({ length: maxLength }, (_, index) => {
      let hasValue = false
      const sum = series.reduce((acc, entry) => {
        const raw = entry?.data?.[index]
        if (typeof raw === 'number' && Number.isFinite(raw)) {
          hasValue = true
          return acc + raw
        }
        return acc
      }, 0)
      return hasValue ? sum : null
    })
  }

  const aggregateHoursSeries = (entries = []) => {
    if (!entries.length) return []
    let maxLength = 0
    entries.forEach((entry) => {
      ;(entry?.datasets || []).forEach((dataset) => {
        if (dataset?.data?.length > maxLength) maxLength = dataset.data.length
      })
    })
    return Array.from({ length: maxLength }, (_, i) => {
      let hasValue = false
      const sum = entries.reduce((acc, entry) => {
        const entrySum = (entry?.datasets || []).reduce((dSum, dataset) => {
          const raw = dataset?.data?.[i]
          if (typeof raw === 'number' && Number.isFinite(raw)) {
            hasValue = true
            return dSum + raw
          }
          return dSum
        }, 0)
        return acc + entrySum
      }, 0)
      return hasValue ? sum : null
    })
  }

  const siteVolumeData = useMemo(() => {
    if (!sitesDashboard?.volumeSeries?.length) return []
    if (mode === 'all' || !siteId) return aggregateSeries(sitesDashboard.volumeSeries)
    return sitesDashboard.volumeSeries.find((entry) => String(entry.id) === String(selectedSite?.id))?.data || []
  }, [selectedSite, sitesDashboard, siteId, mode])

  const siteConsumptionData = useMemo(() => {
    if (!sitesDashboard?.consumptionSeries?.length) return []
    if (mode === 'all' || !siteId) return aggregateSeries(sitesDashboard.consumptionSeries)
    return sitesDashboard.consumptionSeries.find((entry) => String(entry.id) === String(selectedSite?.id))?.data || []
  }, [selectedSite, sitesDashboard, siteId, mode])

  const siteHoursData = useMemo(() => {
    if (!sitesDashboard?.hoursSeries?.length) return []
    if (mode === 'all' || !siteId) {
      return aggregateHoursSeries(sitesDashboard.hoursSeries)
    }
    const matchingEntry = sitesDashboard.hoursSeries.find((entry) => String(entry.id) === String(selectedSite?.id))
    return matchingEntry ? aggregateHoursSeries([matchingEntry]) : []
  }, [selectedSite, sitesDashboard, siteId, mode])

  const siteVolumeStats = windowStats(siteVolumeData, periodStart, periodEnd)
  const siteConsumptionStats = windowStats(siteConsumptionData, periodStart, periodEnd, { ignoreZeros: true })
  const siteHoursStats = windowStats(siteHoursData, periodStart, periodEnd, { ignoreZeros: true })

  const siteAutonomy = useMemo(() => {
    if (!sitesDashboard?.autonomyBySite || !siteId) return null
    return sitesDashboard.autonomyBySite[String(siteId)] || null
  }, [sitesDashboard, siteId])

  const siteTableRows = useMemo(() => {
    if (!sitesDashboard?.volumeSeries?.length) return []

    const filteredSites = siteId
      ? (sitesDashboard.volumeSeries || []).filter((site) => String(site.id) === String(siteId))
      : (sitesDashboard.volumeSeries || [])

    return filteredSites.map((site) => {
      const volumeSeries = site?.data || []
      const consumptionSeries = (sitesDashboard.consumptionSeries || []).find((entry) => String(entry.id) === String(site.id))?.data || []
      const matchingHours = (sitesDashboard.hoursSeries || []).find((entry) => String(entry.id) === String(site.id))
      const hoursSeries = matchingHours ? aggregateHoursSeries([matchingHours]) : []

      return {
        id: site.id,
        nom_site: site.nom_site,
        volume: windowStats(volumeSeries, periodStart, periodEnd),
        consumption: windowStats(consumptionSeries, periodStart, periodEnd, { ignoreZeros: true }),
        hours: windowStats(hoursSeries, periodStart, periodEnd, { ignoreZeros: true }),
      }
    })
  }, [sitesDashboard, periodStart, periodEnd, siteId])

  useEffect(() => {
    if (!window.Chart || !sitesDashboard || mode === 'all') return undefined
    const charts = []
    const fullLabels = sitesDashboard.labels || []
    const labels = toChartLabels(fullLabels.slice(viewStart, viewEnd + 1))
    const fullLabelsWindow = fullLabels.slice(viewStart, viewEnd + 1)
    const sliceSeries = (values = []) => values.slice(viewStart, viewEnd + 1)
    const pointRadius = seriesPointRadius(labels.length)
    const createLineChart = (id, data, color, fill = false) => {
      const ctx = document.getElementById(id)
      if (!ctx) return
      const chart = createChart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: id,
            data: sliceSeries(data),
            borderColor: color,
            backgroundColor: fill ? `${color}22` : 'transparent',
            borderWidth: 3,
            tension: 0.35,
            fill,
            pointRadius,
            spanGaps: true,
          }],
        },
        options: {
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
              },
            },
          },
          scales: {
            x: {
              ticks: xAxisTicks(labels.length, chartPalette.text),
              grid: { color: chartPalette.grid },
            },
            y: {
              ticks: { color: chartPalette.text },
              grid: { color: chartPalette.grid },
            },
          },
        },
      })
      if (chart) charts.push(chart)
    }

    createLineChart('chart-site-volume', siteVolumeData, '#0b3d7a', true)
    createLineChart('chart-site-hours', siteHoursData, '#3b82f6', true)
    createLineChart('chart-site-consumption', siteConsumptionData, '#60a5fa', true)

    const onWheel = (event) => {
      if (!canScroll) return
      event.preventDefault()
      const step = event.deltaY > 0 ? 1 : -1
      setChartPan((prev) => Math.min(maxPan, Math.max(0, prev + step)))
    }
    const chartBoxes = document.querySelectorAll('.chart-box')
    chartBoxes.forEach((box) => box.addEventListener('wheel', onWheel, { passive: false }))

    return () => {
      charts.forEach((chart) => chart.destroy())
      chartBoxes.forEach((box) => box.removeEventListener('wheel', onWheel))
    }
  }, [chartPalette, sitesDashboard, selectedSite, siteVolumeData, siteHoursData, siteConsumptionData, viewStart, viewEnd, mode, canScroll, maxPan])

  if (!sitesDashboard) {
    return (
      <div className="app-shell dashboard-shell">
        <Topbar activeView="sites" onNavigate={onNavigate} />
        {loadError ? (
          <div className="loading-state" style={{ marginTop: 24 }}>
            {loadError}
            <div style={{ marginTop: 12 }}>
              <button type="button" className="filter-submit" onClick={() => window.location.reload()}>
                Réessayer
              </button>
            </div>
          </div>
        ) : (
          <PageLoader label="Chargement des sites…" />
        )}
      </div>
    )
  }

  return (
    <div className="app-shell dashboard-shell">
      <Topbar activeView="sites" onNavigate={onNavigate} />

      <PageEnter>
      <main className="groups-grid">
        <WelcomeBanner subtitle="Tous les sites d’abord — affinez avec les filtres si besoin." />
        <form className="groups-filter-bar" onSubmit={(event) => event.preventDefault()}>
          <div className="filter-field">
            <label htmlFor="site-start">Période — début</label>
            <select id="site-start" value={String(startIdx)} onChange={(event) => setStartIdx(Number(event.target.value))}>
              {(sitesDashboard?.labels || []).map((label, index) => (<option key={`${label}-${index}`} value={String(index)}>{label}</option>))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="site-end">Période — fin</label>
            <select id="site-end" value={String(endIdx)} onChange={(event) => setEndIdx(Number(event.target.value))}>
              {(sitesDashboard?.labels || []).map((label, index) => (<option key={`${label}-${index}`} value={String(index)}>{label}</option>))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="site-select">Site</label>
            <select id="site-select" value={siteId ?? ''} onChange={(event) => setSiteId(event.target.value)}>
              <option value="">Tous les sites</option>
              {siteOptions.map((site) => (<option key={site.id} value={site.id}>{site.nom_site}</option>))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="view_mode">Affichage</label>
            <select id="view_mode" value={mode} onChange={(event) => setMode(event.target.value)}>
              <option value="all">Vue d’ensemble</option>
              <option value="details">Détail</option>
            </select>
          </div>
        </form>

        {mode === 'all' ? (
          <section className="site-overview">
            <div className="section-title-wrap">
              <span className="metric-label">Sites</span>
              <h2>{selectedSite?.nom_site || (siteId ? 'Site sélectionné' : 'Tous les sites')}</h2>
            </div>

            <div className="dashboard-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Site</th>
                    <th>Delta horaire (période)</th>
                    <th>Delta horaire moyen</th>
                    <th>Consommation (période, L)</th>
                    <th>Consommation moyenne (L)</th>
                    <th>Stock semaine N (L)</th>
                    <th>Stock moyen (L)</th>
                    <th>Temps restant</th>
                  </tr>
                </thead>
                  <tbody>
                  {siteTableRows.map((site) => {
                    const siteAut = sitesDashboard?.autonomyBySite?.[String(site.id)] || {}
                    const severity = getAutonomySeverity(siteAut)
                    return (
                      <tr key={site.id} className={`autonomy-row autonomy-row--${severity}`}>
                        <td>{site.nom_site}</td>
                        <td>{site.hours.total.toFixed(1)}</td>
                        <td>{site.hours.mean.toFixed(1)}</td>
                        <td>{site.consumption.total.toFixed(1)}</td>
                        <td>{site.consumption.mean.toFixed(1)}</td>
                        <td>{site.volume.latest.toFixed(1)}</td>
                        <td>{site.volume.mean.toFixed(1)}</td>
                        <td>
                          <AutonomyBadge entity={siteAut} size="sm" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <article 
            key={selectedSite?.id || 'site-details'} 
            className="group-card" 
            style={{ 
              position: 'relative', 
              borderLeft: `4px solid ${selectedSite?.color || '#0b3d7a'}`,
              padding: '1.5rem'
            }}
          >
            <section className="site-overview">
              {/* Badge d'autonomie en haut à droite comme dans GroupsPage */}
              {selectedSite && siteAutonomy && (
                <div className="site-autonomy-float" aria-label={`Temps restant : ${formatAutonomyValue(siteAutonomy)}`}>
                  <AutonomyBadge entity={siteAutonomy} size="lg" />
                </div>
              )}

              <div className="section-title-wrap">
                <span className="metric-label">Sites</span>
                <h2>{selectedSite?.nom_site || 'Tous les sites'}</h2>
              </div>

              {/* 3 graphiques côte à côte */}
              <div className="site-metrics-grid" style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(3, 1fr)', 
                gap: '1.5rem',
                marginBottom: '2rem'
              }}>
                <article className="metric-panel site-metric-card">
                  <span className="metric-label">Delta horaire</span>
                  <h3>{selectedSite ? 'Delta horaire' : 'Delta horaire cumulé'}</h3>
                  <div className="site-metric-stack">
                    <div><span>Total sur la période de la courbe</span><strong>{siteHoursStats.total.toFixed(1)} h</strong>{renderDelta(siteHoursStats)}</div>
                    <div><span>Delta horaire moyen</span><strong>{siteHoursStats.mean.toFixed(1)} h</strong>{renderMeanDelta(siteHoursStats)}</div>
                  </div>
                  <div className={`chart-box secondary-box${canScroll ? ' is-scrollable' : ''}`}><canvas id="chart-site-hours" /></div>
                </article>

                <article className="metric-panel site-metric-card">
                  <span className="metric-label">Consommation</span>
                  <h3>{selectedSite ? 'Consommation' : 'Consommation cumulée'}</h3>
                  <div className="site-metric-stack">
                    <div><span>Total sur la période de la courbe</span><strong>{siteConsumptionStats.total.toFixed(1)} L</strong>{renderDelta(siteConsumptionStats)}</div>
                    <div><span>Consommation moyenne</span><strong>{siteConsumptionStats.mean.toFixed(1)} L</strong>{renderMeanDelta(siteConsumptionStats)}</div>
                  </div>
                  <div className={`chart-box secondary-box${canScroll ? ' is-scrollable' : ''}`}><canvas id="chart-site-consumption" /></div>
                </article>

                <article className="metric-panel site-metric-card">
                  <span className="metric-label">Stock</span>
                  <h3>{selectedSite ? 'Volume stock' : 'Volume stock cumulé'}</h3>
                  <div className="site-metric-stack">
                    <div><span>Stock semaine N (dernière valeur)</span><strong>{siteVolumeStats.latest.toFixed(1)} L</strong>{renderDelta(siteVolumeStats)}</div>
                    <div><span>Volume moyen</span><strong>{siteVolumeStats.mean.toFixed(1)} L</strong>{renderMeanDelta(siteVolumeStats)}</div>
                  </div>
                  <div className={`chart-box secondary-box${canScroll ? ' is-scrollable' : ''}`}><canvas id="chart-site-volume" /></div>
                </article>
              </div>
            </section>
          </article>
        )}
      </main>
      </PageEnter>
    </div>
  )
}

export default SitesPage