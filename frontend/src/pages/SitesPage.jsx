import React, { useEffect, useMemo, useState } from 'react'
import Topbar from '../components/Topbar.jsx'

function SitesPage({ onNavigate }) {
  const chartPalette = useMemo(() => ({ axis: '#123d6d', grid: 'rgba(11, 61, 122, 0.08)', text: '#23466d' }), [])
  const [sitesDashboard, setsitesDashboard] = useState(null)
  const [startIdx, setStartIdx] = useState(0)
  const [endIdx, setEndIdx] = useState(0)
  const [siteId, setSiteId] = useState(null)
  const querySiteId = useMemo(() => new URLSearchParams(window.location.search).get('siteId'), [])
  const querySiteName = useMemo(() => new URLSearchParams(window.location.search).get('siteName'), [])

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

    return {
      total: Number(total.toFixed(1)),
      mean: Number(mean.toFixed(1)),
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
      return <small className="delta-neutral">— pas de période précédente</small>
    }

    const deltaValue = typeof metric?.variation_pct === 'number'
      ? `${metric.variation_pct >= 0 ? '+' : ''}${metric.variation_pct.toFixed(1)} %`
      : '—'
    const deltaClass = (metric?.variation_pct ?? 0) >= 0 ? 'delta-up' : 'delta-down'
    return <small className={deltaClass}>{deltaValue}{suffix}</small>
  }

  const renderMeanDelta = (metric, suffix = '') => {
    if (metric?.has_previous_period === false) {
      return <small className="delta-neutral">— pas de période précédente</small>
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
        const [metric2, metric3, metric4] = await Promise.all([
          fetch('/api/v1/dashboard/evolution_volumes').then((response) => response.json()),
          fetch('/api/v1/dashboard/horaires_groupes').then((response) => response.json()),
          fetch('/api/v1/dashboard/consommation').then((response) => response.json()),
        ])

        setsitesDashboard({
          labels: metric2.labels,
          volumeSeries: metric2.sites_series,
          hoursSeries: Object.entries(metric3.sites_data || {}).map(([siteKey, site]) => ({ id: Number(siteKey) || site.id, nom_site: site.nom_site, datasets: site.datasets })),
          consumptionSeries: metric4.sites_series,
          defaultSiteId: metric3.default_site_id,
        })
      } catch (error) {
        console.warn('Site backend unavailable, using demo fallback data.', error)
        setsitesDashboard({
          labels: ['01/01 au 07/01', '08/01 au 14/01', '15/01 au 21/01'],
          volumeSeries: [
            { id: 1, nom_site: 'BUF Bepanda', data: [400, 470, 510], color: '#0b3d7a' },
            { id: 2, nom_site: 'BUF Bonaberi', data: [320, 360, 390], color: '#3b82f6' },
          ],
          hoursSeries: [
            { id: 1, nom_site: 'BUF Bepanda', datasets: [{ label: 'G#100 (Perkins 250kVA)', data: [12, 14, 16] }] },
            { id: 2, nom_site: 'BUF Bonaberi', datasets: [{ label: 'G#200 (Cummins 150kVA)', data: [8, 9, 10] }] },
          ],
          consumptionSeries: [
            { id: 1, nom_site: 'BUF Bepanda', data: [230, 250, 270], color: '#0b3d7a' },
            { id: 2, nom_site: 'BUF Bonaberi', data: [190, 210, 215], color: '#3b82f6' },
          ],
          defaultSiteId: 1,
        })
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

    const fallbackId = String(sitesDashboard.defaultSiteId ?? sitesDashboard.volumeSeries?.[0]?.id ?? '')
    const selectedId = querySiteId || fallbackId
    if ((siteId === null || siteId === '') && selectedId) {
      setSiteId(selectedId)
    }

    if (querySiteId && querySiteName && sitesDashboard) {
      const matchingSite = siteOptions.find((site) => String(site.id) === querySiteId || site.nom_site === querySiteName)
      if (matchingSite) {
        setSiteId(String(matchingSite.id))
      }
    }

    if (sitesDashboard.labels?.length) {
      setStartIdx(0)
      setEndIdx(sitesDashboard.labels.length - 1)
    }
  }, [sitesDashboard, siteId, querySiteId, querySiteName, siteOptions])

  const selectedSite = useMemo(() => {
    if (!sitesDashboard) return null
    return [...(sitesDashboard.volumeSeries || []), ...(sitesDashboard.consumptionSeries || []), ...(sitesDashboard.hoursSeries || [])].find((entry) => String(entry.id) === String(siteId)) || null
  }, [sitesDashboard, siteId])

  const siteVolumeData = useMemo(() => {
    if (!selectedSite || !sitesDashboard?.volumeSeries?.length) return []
    return sitesDashboard.volumeSeries.find((entry) => String(entry.id) === String(selectedSite.id))?.data || []
  }, [selectedSite, sitesDashboard])

  const siteConsumptionData = useMemo(() => {
    if (!selectedSite || !sitesDashboard?.consumptionSeries?.length) return []
    return sitesDashboard.consumptionSeries.find((entry) => String(entry.id) === String(selectedSite.id))?.data || []
  }, [selectedSite, sitesDashboard])

  const siteHoursData = useMemo(() => {
    if (!selectedSite || !sitesDashboard?.hoursSeries?.length) return []
    return sitesDashboard.hoursSeries.find((entry) => String(entry.id) === String(selectedSite.id))?.datasets.flatMap((dataset) => dataset.data || []) || []
  }, [selectedSite, sitesDashboard])

  const siteVolumeStats = windowStats(siteVolumeData, startIdx, endIdx)
  const siteConsumptionStats = windowStats(siteConsumptionData, startIdx, endIdx)
  const siteHoursStats = windowStats(siteHoursData, startIdx, endIdx, { ignoreZeros: true })

  useEffect(() => {
    if (!window.Chart || !sitesDashboard || !selectedSite) return undefined
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
  }, [chartPalette, sitesDashboard, selectedSite, siteVolumeData, siteHoursData, siteConsumptionData, startIdx, endIdx])

  const applyFilters = (event) => {
    event.preventDefault()
    const normalizedStart = Math.min(startIdx, endIdx)
    const normalizedEnd = Math.max(startIdx, endIdx)
    setStartIdx(normalizedStart)
    setEndIdx(normalizedEnd)
  }

  if (!sitesDashboard) {
    return (
      <div className="app-shell dashboard-shell">
        <Topbar activeView="site" onNavigate={onNavigate} />
        <main className="groups-grid"><div className="loading-state">Chargement des données du site...</div></main>
      </div>
    )
  }

  return (
    <div className="app-shell dashboard-shell">
      <Topbar activeView="site" onNavigate={onNavigate} />

      <main className="groups-grid">
        <form className="groups-filter-bar" onSubmit={applyFilters}>
          <div className="filter-field">
            <label htmlFor="site-start">Rapport début</label>
            <select id="site-start" value={startIdx} onChange={(event) => setStartIdx(Number(event.target.value))}>
              {sitesDashboard.labels.map((label, index) => (<option key={`${label}-${index}`} value={index}>{label}</option>))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="site-end">Rapport fin</label>
            <select id="site-end" value={endIdx} onChange={(event) => setEndIdx(Number(event.target.value))}>
              {sitesDashboard.labels.map((label, index) => (<option key={`${label}-${index}`} value={index}>{label}</option>))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="site-select">Site</label>
            <select id="site-select" value={siteId ?? ''} onChange={(event) => setSiteId(event.target.value)}>
              {siteOptions.map((site) => (<option key={site.id} value={site.id}>{site.nom_site}</option>))}
            </select>
          </div>
          <button type="submit" className="filter-submit">Appliquer</button>
        </form>

        <section className="site-overview">
          <div className="section-title-wrap">
            <span className="metric-label">Sites</span>
            <h2>{selectedSite?.nom_site || 'Sites'}</h2>
          </div>

          <div className="site-metric-grid">
            <article className="metric-panel site-metric-card">
              <span className="metric-label">Durée de fonctionnement</span>
              <h3>Durée / période</h3>
              <div className="site-metric-stack">
                <div><span>Total période</span><strong>{siteHoursStats.total.toFixed(1)} h</strong>{renderDelta(siteHoursStats)}</div>
                <div><span>Moyenne / semaine</span><strong>{siteHoursStats.mean.toFixed(1)} h</strong>{renderMeanDelta(siteHoursStats)}</div>
                <div><span>Moy. absolue</span><strong>{siteHoursStats.all_time_mean.toFixed(1)} h</strong></div>
                <div><span>Écart type absolu</span><strong>{siteHoursStats.all_time_stddev.toFixed(1)} h</strong></div>
              </div>
              <div className="chart-box secondary-box"><canvas id="chart-site-hours" /></div>
            </article>

            <article className="metric-panel site-metric-card">
              <span className="metric-label">Consommation</span>
              <h3>Carburant / période</h3>
              <div className="site-metric-stack">
                <div><span>Total période</span><strong>{siteConsumptionStats.total.toFixed(1)} L</strong>{renderDelta(siteConsumptionStats)}</div>
                <div><span>Moyenne</span><strong>{siteConsumptionStats.mean.toFixed(1)} L</strong>{renderMeanDelta(siteConsumptionStats)}</div>
                <div><span>Moy. absolue</span><strong>{siteConsumptionStats.all_time_mean.toFixed(1)} L</strong></div>
                <div><span>Écart type absolu</span><strong>{siteConsumptionStats.all_time_stddev.toFixed(1)} L</strong></div>
              </div>
              <div className="chart-box secondary-box"><canvas id="chart-site-consumption" /></div>
            </article>

            <article className="metric-panel site-metric-card">
              <span className="metric-label">Volume carburant</span>
              <h3>Volume total / période</h3>
              <div className="site-metric-stack">
                <div><span>Total période</span><strong>{siteVolumeStats.total.toFixed(1)} L</strong>{renderDelta(siteVolumeStats)}</div>
                <div><span>Moyenne</span><strong>{siteVolumeStats.mean.toFixed(1)} L</strong>{renderMeanDelta(siteVolumeStats)}</div>
                <div><span>Moy. absolue</span><strong>{siteVolumeStats.all_time_mean.toFixed(1)} L</strong></div>
                <div><span>Écart type absolu</span><strong>{siteVolumeStats.all_time_stddev.toFixed(1)} L</strong></div>
              </div>
              <div className="chart-box secondary-box"><canvas id="chart-site-volume" /></div>
            </article>
          </div>
        </section>
      </main>
    </div>
  )
}

export default SitesPage
