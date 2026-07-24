import { useEffect, useMemo, useState } from 'react'
import Topbar from '../components/Topbar'
import FilterBar from '../components/FilterBar'
import StatBlock from '../components/StatBlock'
import { LineChart } from '../components/ChartCanvas'
import { LoadingState, DemoBanner } from '../components/PageState'
import { fetchSiteMetrics } from '../lib/api'
import { windowStats } from '../lib/stats'

export default function SitePage({ onNavigate }) {
  const [dashboard, setDashboard] = useState(null)
  const [demo, setDemo] = useState(false)
  const [startIdx, setStartIdx] = useState(0)
  const [endIdx, setEndIdx] = useState(0)
  const [siteId, setSiteId] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchSiteMetrics().then(({ data, demo: isDemo }) => {
      if (cancelled) return

      const hoursSeries = Object.entries(data.horairesGroupes.sites_data || {}).map(([key, site]) => ({
        id: Number(key) || site.id,
        nom_site: site.nom_site,
        datasets: site.datasets,
      }))

      setDashboard({
        labels: data.evolutionVolumes.labels || [],
        volumeSeries: data.evolutionVolumes.sites_series || [],
        hoursSeries,
        consumptionSeries: data.consommation.sites_series || [],
        defaultSiteId: data.horairesGroupes.default_site_id,
      })
      setDemo(isDemo)
      setStartIdx(0)
      setEndIdx(Math.max((data.evolutionVolumes.labels?.length || 1) - 1, 0))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const siteOptions = useMemo(() => {
    if (!dashboard) return []
    const byId = new Map()
    ;[...dashboard.volumeSeries, ...dashboard.consumptionSeries, ...dashboard.hoursSeries].forEach((site) =>
      byId.set(String(site.id), { id: site.id, nom_site: site.nom_site }),
    )
    return [...byId.values()]
  }, [dashboard])

  useEffect(() => {
    if (!dashboard || siteId) return
    const fallback = String(dashboard.defaultSiteId ?? siteOptions[0]?.id ?? '')
    if (fallback) setSiteId(fallback)
  }, [dashboard, siteOptions, siteId])

  const selected = useMemo(() => {
    if (!dashboard) return null
    const candidates = [...dashboard.volumeSeries, ...dashboard.consumptionSeries, ...dashboard.hoursSeries]
    return candidates.find((entry) => String(entry.id) === String(siteId)) || candidates[0] || null
  }, [dashboard, siteId])

  const volumeData = useMemo(
    () => dashboard?.volumeSeries.find((entry) => String(entry.id) === String(selected?.id))?.data || [],
    [dashboard, selected],
  )
  const consumptionData = useMemo(
    () => dashboard?.consumptionSeries.find((entry) => String(entry.id) === String(selected?.id))?.data || [],
    [dashboard, selected],
  )
  const hoursData = useMemo(() => {
    const candidate = dashboard?.hoursSeries.find((entry) => String(entry.id) === String(selected?.id))
    return (candidate?.datasets || []).flatMap((dataset) => dataset.data || [])
  }, [dashboard, selected])

  if (!dashboard) {
    return (
      <div className="app-shell dashboard-shell">
        <Topbar activeView="site" onNavigate={onNavigate} />
        <main className="groups-grid">
          <LoadingState label="Chargement des données du site…" />
        </main>
      </div>
    )
  }

  const start = Math.min(startIdx, endIdx)
  const end = Math.max(startIdx, endIdx)
  const labels = dashboard.labels
  const reportChoices = labels.map((label, index) => ({ id: index, label }))

  const panels = [
    { key: 'hours', label: 'Variation horaire', title: 'Écart / période', unit: 'h', data: hoursData, color: '#3b82f6' },
    { key: 'consumption', label: 'Consommation', title: 'Carburant / période', unit: 'L', data: consumptionData, color: '#60a5fa' },
    { key: 'volume', label: 'Volume carburant', title: 'Volume total / période', unit: 'L', data: volumeData, color: '#0b3d7a' },
  ]

  return (
    <div className="app-shell dashboard-shell">
      <Topbar activeView="site" onNavigate={onNavigate} />
      <DemoBanner visible={demo} />

      <main className="groups-grid">
        <FilterBar
          idPrefix="site"
          reportChoices={reportChoices}
          startValue={String(startIdx)}
          endValue={String(endIdx)}
          onStartChange={(value) => setStartIdx(Number(value))}
          onEndChange={(value) => setEndIdx(Number(value))}
          sites={siteOptions}
          siteValue={siteId}
          onSiteChange={setSiteId}
        />

        <section className="site-overview">
          <div className="section-title-wrap">
            <span className="metric-label">Sites</span>
            <h2>{selected?.nom_site || 'Sites'}</h2>
          </div>

          <div className="site-metric-grid">
            {panels.map((panel) => (
              <article key={panel.key} className="metric-panel site-metric-card">
                <span className="metric-label">{panel.label}</span>
                <h3>{panel.title}</h3>
                <StatBlock metric={windowStats(panel.data, start, end)} unit={panel.unit} columns={2} />
                <LineChart
                  labels={labels.slice(start, end + 1)}
                  datasets={[{
                    label: panel.label,
                    data: panel.data.slice(start, end + 1),
                    borderColor: panel.color,
                    backgroundColor: `${panel.color}22`,
                    fill: true,
                  }]}
                  unit={panel.unit}
                  height={220}
                />
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
