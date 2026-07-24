import { useEffect, useState } from 'react'
import Topbar from '../components/Topbar'
import PageHeader from '../components/PageHeader'
import FilterBar from '../components/FilterBar'
import StatBlock, { SummaryChip } from '../components/StatBlock'
import { LineChart } from '../components/ChartCanvas'
import { LoadingState, DemoBanner } from '../components/PageState'
import { fetchCuvesDashboard } from '../lib/api'
import { fmt } from '../lib/format'

function CuveCard({ kind, block, labels }) {
  return (
    <article className="group-card" style={{ borderLeft: `4px solid ${block.color || '#0d4f5c'}` }}>
      <div className="group-card-head">
        <span className="metric-label">{kind}</span>
        <h3>{block.label}</h3>
        <p className="group-header-meta">Capacité max : {fmt(block.capacity, 'L')}</p>
      </div>

      <StatBlock title="Volume de carburant" metric={block.stats} unit="L" columns={4} />

      <div className="chart-card">
        <span className="curve-title">Évolution du volume</span>
        <LineChart
          labels={labels}
          datasets={[{
            label: block.label,
            data: block.values || [],
            borderColor: block.color || '#0d4f5c',
            backgroundColor: `${block.color || '#0d4f5c'}20`,
            fill: true,
          }]}
          unit="L"
          beginAtZero
          height={220}
        />
      </div>
    </article>
  )
}

export default function CuvesPage({ onNavigate }) {
  const [cuves, setCuves] = useState(null)
  const [demo, setDemo] = useState(false)
  const [rapportDebut, setRapportDebut] = useState('')
  const [rapportFin, setRapportFin] = useState('')
  const [siteId, setSiteId] = useState('')

  const load = async (queryParams = '') => {
    const { data, demo: isDemo } = await fetchCuvesDashboard(queryParams)
    setCuves(data)
    setDemo(isDemo)
    setRapportDebut(String(data.selected_rapport_debut ?? ''))
    setRapportFin(String(data.selected_rapport_fin ?? ''))
    setSiteId(data.selected_site_id != null ? String(data.selected_site_id) : '')
  }

  useEffect(() => {
    load()
  }, [])

  const applyFilters = () => {
    const params = new URLSearchParams()
    if (rapportDebut) params.set('rapport_debut', rapportDebut)
    if (rapportFin) params.set('rapport_fin', rapportFin)
    if (siteId) params.set('site_id', siteId)
    load(params.toString())
  }

  if (!cuves) {
    return (
      <div className="app-shell">
        <Topbar activeView="cuves" onNavigate={onNavigate} />
        <main className="page-stack">
          <LoadingState label="Chargement des cuves…" />
        </main>
      </div>
    )
  }

  const labels = cuves.labels || []

  return (
    <div className="app-shell">
      <Topbar activeView="cuves" onNavigate={onNavigate} />
      <DemoBanner visible={demo} />

      <main className="page-stack">
        <PageHeader
          eyebrow="Cuves"
          title="Niveaux de stock"
          description="Suivez le volume de chaque cuve. Les grandes cuves stockent ; les cuves du jour alimentent les groupes."
        />

        <FilterBar
          idPrefix="cuves"
          reportChoices={cuves.rapport_choices || []}
          startValue={rapportDebut}
          endValue={rapportFin}
          onStartChange={setRapportDebut}
          onEndChange={setRapportFin}
          sites={cuves.sites || []}
          siteValue={siteId}
          onSiteChange={setSiteId}
          onSubmit={applyFilters}
          hint="Choisissez le site et la période, puis cliquez sur Afficher."
        />

        <section className="metric-section">
          <div className="section-title-wrap">
            <span className="metric-label">Période {cuves.period_label}</span>
            <h2>Grandes cuves (stockage)</h2>
            <p className="group-header-meta">Réservoirs principaux du site sélectionné.</p>
          </div>
          <div className="summary-strip">
            <SummaryChip label="Total période" value={cuves.site_principal_stats?.total} unit="L" metric={cuves.site_principal_stats} field="variation_pct" />
            <SummaryChip label="Moyenne" value={cuves.site_principal_stats?.mean} unit="L" metric={cuves.site_principal_stats} field="mean_variation_pct" />
            <SummaryChip label="Moyenne historique" value={cuves.site_principal_stats?.all_time_mean} unit="L" />
            <SummaryChip label="Écart type" value={cuves.site_principal_stats?.all_time_stddev} unit="L" />
          </div>
        </section>

        <section className="groups-list">
          {(cuves.principal_blocks || []).map((block) => (
            <CuveCard key={block.id} kind="Grande cuve" block={block} labels={labels} />
          ))}
        </section>

        <section className="metric-section">
          <div className="section-title-wrap">
            <span className="metric-label">Période {cuves.period_label}</span>
            <h2>Cuves du jour (alimentation)</h2>
            <p className="group-header-meta">Cuves qui alimentent directement les groupes électrogènes.</p>
          </div>
          <div className="summary-strip">
            <SummaryChip label="Total période" value={cuves.site_journalier_stats?.total} unit="L" metric={cuves.site_journalier_stats} field="variation_pct" />
            <SummaryChip label="Moyenne" value={cuves.site_journalier_stats?.mean} unit="L" metric={cuves.site_journalier_stats} field="mean_variation_pct" />
            <SummaryChip label="Moyenne historique" value={cuves.site_journalier_stats?.all_time_mean} unit="L" />
            <SummaryChip label="Écart type" value={cuves.site_journalier_stats?.all_time_stddev} unit="L" />
          </div>
        </section>

        <section className="groups-list">
          {(cuves.journalier_blocks || []).map((block) => (
            <CuveCard key={block.id} kind="Cuve du jour" block={block} labels={labels} />
          ))}
        </section>
      </main>
    </div>
  )
}
