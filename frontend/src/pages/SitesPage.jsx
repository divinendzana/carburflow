import React, { useEffect, useMemo, useState } from 'react'
import Topbar from '../components/Topbar.jsx'
import WelcomeBanner from '../components/WelcomeBanner.jsx'
import { apiFetch } from '../auth.js'
import AutonomyBadge from '../components/AutonomyBadge.jsx'
import PageLoader from '../components/PageLoader.jsx'
import PageEnter from '../components/PageEnter.jsx'
import { useChartPalette } from '../hooks/useChartPalette.js'
import { formatAutonomyValue, getAutonomySeverity } from '../utils/format.js'

function SitesPage({ onNavigate }) {
  const chartPalette = useChartPalette()
  const [sitesDashboard, setsitesDashboard] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [startIdx, setStartIdx] = useState(0)
  const [endIdx, setEndIdx] = useState(0)
  const [siteId, setSiteId] = useState('')
  const [draftStartIdx, setDraftStartIdx] = useState(0)
  const [draftEndIdx, setDraftEndIdx] = useState(0)
  const [draftSiteId, setDraftSiteId] = useState('')
  const querySiteId = useMemo(() => new URLSearchParams(window.location.search).get('siteId'), [])
  const querySiteName = useMemo(() => new URLSearchParams(window.location.search).get('siteName'), [])
  const queryMode = useMemo(() => new URLSearchParams(window.location.search).get('mode'), [])
  // Par défaut : vue globale (tous les sites) si on arrive sans option (pas de
  // siteId dans l'URL). Si on arrive via un lien qui cible un site précis
  // (querySiteId présent, ex. depuis une alerte du Dashboard), on garde le
  // comportement existant : vue détail sur ce site.
  const [mode, setMode] = useState(queryMode || (querySiteId ? 'details' : 'all'))
  const [draftMode, setDraftMode] = useState(queryMode || (querySiteId ? 'details' : 'all'))
  const [filtering, setFiltering] = useState(false)

  const safeValue = (value) => (typeof value === 'number' ? value : 0)

  const windowStats = (values = [], start, end, options = {}) => {
    const ignoreZeros = options.ignoreZeros ?? false
    const normalizedValues = (values || []).map((value) => safeValue(value))
    const meaningfulValues = ignoreZeros ? normalizedValues.filter((value) => value > 0) : normalizedValues

    const window = normalizedValues.slice(start, end + 1)
    const meaningfulWindow = ignoreZeros ? window.filter((value) => value > 0) : window
    const total = meaningfulWindow.reduce((sum, value) => sum + value, 0)
    const mean = meaningfulWindow.length ? total / meaningfulWindow.length : 0

    const prevWindowLength = end - start + 1
    const prevStart = start - prevWindowLength
    const prevEnd = start - 1
    const prevWindow = prevStart >= 0 ? normalizedValues.slice(prevStart, prevEnd + 1) : []
    const meaningfulPrevWindow = ignoreZeros ? prevWindow.filter((value) => value > 0) : prevWindow
    const prevTotal = meaningfulPrevWindow.reduce((sum, value) => sum + value, 0)
    const prevMean = meaningfulPrevWindow.length ? prevTotal / meaningfulPrevWindow.length : 0

    const allTimeMean = meaningfulValues.length ? meaningfulValues.reduce((sum, value) => sum + value, 0) / meaningfulValues.length : 0
    const variance = meaningfulValues.length
      ? meaningfulValues.reduce((sum, value) => sum + (value - allTimeMean) ** 2, 0) / meaningfulValues.length
      : 0
    const allTimeStddev = Math.sqrt(variance)

    const variationPct = prevTotal === 0 ? null : ((total - prevTotal) / prevTotal) * 100
    const meanVariationPct = prevMean === 0 ? null : ((mean - prevMean) / prevMean) * 100

    const latest = window.length ? window[window.length - 1] : 0

    return {
      total: Number(total.toFixed(1)),
      mean: Number(mean.toFixed(1)),
      latest: Number(latest.toFixed(1)),
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
        const id = String(matchingSite.id)
        setSiteId(id)
        setDraftSiteId(id)
      }
    }

    if (sitesDashboard.labels?.length) {
      const last = sitesDashboard.labels.length - 1
      setStartIdx(0)
      setEndIdx(last)
      setDraftStartIdx(0)
      setDraftEndIdx(last)
    }
  }, [sitesDashboard, querySiteId, querySiteName, siteOptions])

  const applyFilters = async (event) => {
    event.preventDefault()
    setFiltering(true)
    await new Promise((resolve) => setTimeout(resolve, 320))
    setStartIdx(draftStartIdx)
    setEndIdx(draftEndIdx)
    setSiteId(draftSiteId)
    setMode(draftMode)
    setFiltering(false)
  }

  const selectedSite = useMemo(() => {
    if (!sitesDashboard || mode === 'all' || !siteId) return null
    return [...(sitesDashboard.volumeSeries || []), ...(sitesDashboard.consumptionSeries || []), ...(sitesDashboard.hoursSeries || [])].find((entry) => String(entry.id) === String(siteId)) || null
  }, [sitesDashboard, siteId, mode])

  const aggregateSeries = (series = []) => {
    if (!series.length) return []
    const maxLength = Math.max(...series.map((entry) => (entry?.data || []).length))
    return Array.from({ length: maxLength }, (_, index) => {
      return series.reduce((sum, entry) => sum + Number(entry?.data?.[index] ?? 0), 0)
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
      return entries.reduce((sum, entry) => {
        const entrySum = (entry?.datasets || []).reduce((dSum, dataset) => {
          return dSum + Number(dataset?.data?.[i] ?? 0)
        }, 0)
        return sum + entrySum
      }, 0)
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

  const siteVolumeStats = windowStats(siteVolumeData, startIdx, endIdx)
  const siteConsumptionStats = windowStats(siteConsumptionData, startIdx, endIdx, { ignoreZeros: true })
  const siteHoursStats = windowStats(siteHoursData, startIdx, endIdx, { ignoreZeros: true })

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
        volume: windowStats(volumeSeries, startIdx, endIdx),
        consumption: windowStats(consumptionSeries, startIdx, endIdx, { ignoreZeros: true }),
        hours: windowStats(hoursSeries, startIdx, endIdx, { ignoreZeros: true }),
      }
    })
  }, [sitesDashboard, startIdx, endIdx, siteId])

  useEffect(() => {
    if (!window.Chart || !sitesDashboard || mode === 'all') return undefined
    const charts = []
    const labels = (sitesDashboard.labels || []).slice(startIdx, endIdx + 1)
    const sliceSeries = (values = []) => values.slice(startIdx, endIdx + 1)
    const createLineChart = (id, data, color, fill = false) => {
      const ctx = document.getElementById(id)
      if (!ctx) return
      const chart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ label: id, data: sliceSeries(data), borderColor: color, backgroundColor: fill ? `${color}22` : 'transparent', borderWidth: 3, tension: 0.35, fill, pointRadius: 4 }] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { ticks: { color: chartPalette.text }, grid: { color: chartPalette.grid } }, y: { ticks: { color: chartPalette.text }, grid: { color: chartPalette.grid } } },
        },
      })
      charts.push(chart)
    }

    createLineChart('chart-site-volume', siteVolumeData, '#0b3d7a', true)
    createLineChart('chart-site-hours', siteHoursData, '#3b82f6', true)
    createLineChart('chart-site-consumption', siteConsumptionData, '#60a5fa', true)
    return () => charts.forEach((chart) => chart.destroy())
  }, [chartPalette, sitesDashboard, selectedSite, siteVolumeData, siteHoursData, siteConsumptionData, startIdx, endIdx, mode])

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

      {filtering && (
        <div className="cf-filter-overlay" role="status" aria-live="polite">
          <PageLoader fullscreen={false} label="Application du filtre…" />
        </div>
      )}

      <PageEnter>
      <main className={`groups-grid ${filtering ? 'is-filtering' : ''}`}>
        <WelcomeBanner subtitle="Tous les sites d’abord — affinez avec les filtres si besoin." />
        <form className="groups-filter-bar" onSubmit={applyFilters}>
          <div className="filter-field">
            <label htmlFor="site-start">Période — début</label>
            <select id="site-start" value={String(draftStartIdx)} onChange={(event) => setDraftStartIdx(Number(event.target.value))}>
              {(sitesDashboard?.labels || []).map((label, index) => (<option key={`${label}-${index}`} value={String(index)}>{label}</option>))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="site-end">Période — fin</label>
            <select id="site-end" value={String(draftEndIdx)} onChange={(event) => setDraftEndIdx(Number(event.target.value))}>
              {(sitesDashboard?.labels || []).map((label, index) => (<option key={`${label}-${index}`} value={String(index)}>{label}</option>))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="site-select">Site</label>
            <select id="site-select" value={draftSiteId ?? ''} onChange={(event) => setDraftSiteId(event.target.value)}>
              <option value="">Tous les sites</option>
              {siteOptions.map((site) => (<option key={site.id} value={site.id}>{site.nom_site}</option>))}
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
            <button
              type="submit"
              className={`filter-submit${(
                Number(draftStartIdx) !== Number(startIdx)
                || Number(draftEndIdx) !== Number(endIdx)
                || String(draftSiteId) !== String(siteId)
                || String(draftMode) !== String(mode)
              ) ? ' is-dirty' : ''}`}
              disabled={filtering}
              aria-live="polite"
            >
              {filtering ? 'Filtrage…' : 'Appliquer'}
            </button>
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
                  <div className="chart-box secondary-box"><canvas id="chart-site-hours" /></div>
                </article>

                <article className="metric-panel site-metric-card">
                  <span className="metric-label">Consommation</span>
                  <h3>{selectedSite ? 'Consommation' : 'Consommation cumulée'}</h3>
                  <div className="site-metric-stack">
                    <div><span>Total sur la période de la courbe</span><strong>{siteConsumptionStats.total.toFixed(1)} L</strong>{renderDelta(siteConsumptionStats)}</div>
                    <div><span>Consommation moyenne</span><strong>{siteConsumptionStats.mean.toFixed(1)} L</strong>{renderMeanDelta(siteConsumptionStats)}</div>
                  </div>
                  <div className="chart-box secondary-box"><canvas id="chart-site-consumption" /></div>
                </article>

                <article className="metric-panel site-metric-card">
                  <span className="metric-label">Stock</span>
                  <h3>{selectedSite ? 'Volume stock' : 'Volume stock cumulé'}</h3>
                  <div className="site-metric-stack">
                    <div><span>Stock semaine N (dernière valeur)</span><strong>{siteVolumeStats.latest.toFixed(1)} L</strong>{renderDelta(siteVolumeStats)}</div>
                    <div><span>Volume moyen</span><strong>{siteVolumeStats.mean.toFixed(1)} L</strong>{renderMeanDelta(siteVolumeStats)}</div>
                  </div>
                  <div className="chart-box secondary-box"><canvas id="chart-site-volume" /></div>
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