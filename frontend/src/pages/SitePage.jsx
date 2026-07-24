import { useEffect, useMemo, useState } from 'react'
import Topbar from '../components/Topbar'
import PageHeader from '../components/PageHeader'
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
      <div className="app-shell">
        <Topbar activeView="site" onNavigate={onNavigate} />
        <main className="page-stack">
          <LoadingState label="Chargement du site…" />
        </main>
      </div>
    )
  }

  const start = Math.min(startIdx, endIdx)
  const end = Math.max(startIdx, endIdx)
  const labels = dashboard.labels
  const reportChoices = labels.map((label, index) => ({ id: index, label }))

  const panels = [
    { key: 'hours', label: 'Heures de marche', title: 'Temps de fonctionnement', unit: 'h', data: hoursData, color: '#0d6e7a' },
    { key: 'consumption', label: 'Consommation', title: 'Carburant consommé', unit: 'L', data: consumptionData, color: '#e8a317' },
    { key: 'volume', label: 'Stock', title: 'Volume en cuves', unit: 'L', data: volumeData, color: '#0d4f5c' },
  ]

  return (
    <div className="app-shell">
      <Topbar activeView="site" onNavigate={onNavigate} />
      <DemoBanner visible={demo} />

      <main className="page-stack">
        <PageHeader
          eyebrow="Sites"
          title={selected?.nom_site || 'Choisir un site'}
          description="Sélectionnez un site et une période pour voir ses heures, sa consommation et son stock."
        />

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
          hint="Changez le site ou la période pour actualiser les graphiques."
        />

        <section className="site-overview">
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
