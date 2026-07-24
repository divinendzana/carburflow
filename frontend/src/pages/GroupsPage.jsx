import { useEffect, useState } from 'react'
import Topbar from '../components/Topbar'
import FilterBar from '../components/FilterBar'
import StatBlock, { SummaryChip } from '../components/StatBlock'
import { LineChart, BarChart } from '../components/ChartCanvas'
import { LoadingState, DemoBanner } from '../components/PageState'
import { fetchGroupesDashboard } from '../lib/api'
import { buildDerivedMetric, safeValue } from '../lib/stats'
import { fmt } from '../lib/format'

function hourlyConsumptionSeries(group) {
  const consumption = group.consumption || group.consommation || []
  return (group.hours_run || []).map((hours, index) => {
    const h = safeValue(hours)
    const c = safeValue(consumption[index])
    // Consommation horaire = consommation / heures de fonctionnement ; 0 si aucune heure.
    return h > 0 ? Number((c / h).toFixed(2)) : 0
  })
}

function GroupCard({ group, labels }) {
  const color = group.color || '#0b3d7a'
  const hourlyValues = hourlyConsumptionSeries(group)
  const hourlyMetric = buildDerivedMetric(hourlyValues)

  return (
    <article className="group-card" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="autonomy-badge" title="Autonomie estimée avec le stock actuel">
        ⛽ Autonomie {group.autonomie_hours != null ? fmt(group.autonomie_hours, 'h') : '—'}
      </div>

      <div className="group-card-head">
        <span className="metric-label">Groupe</span>
        <h3>{group.label}</h3>
        <p className="group-header-meta">
          {fmt(group.rate, 'L/h')} — {group.marque || ''} {group.puissance || ''}
        </p>
      </div>

      <div className="group-metric-grid">
        <StatBlock title="Variations horaires" metric={group.hours} unit="h" />
        <StatBlock title="Consommation" metric={group.consumption_stats} unit="L" />
        <StatBlock title="Consommation horaire" metric={hourlyMetric} unit="L/h" />
      </div>

      <div className="group-curve-grid">
        <div className="chart-card">
          <span className="curve-title">Heures de fonctionnement</span>
          <LineChart
            labels={labels}
            datasets={[{
              label: group.label,
              data: group.hours_run || [],
              borderColor: color,
              backgroundColor: `${color}20`,
              fill: true,
            }]}
            unit="h"
            height={220}
          />
        </div>
        <div className="chart-card">
          <span className="curve-title">Consommation</span>
          <BarChart
            labels={labels}
            datasets={[{
              label: 'Consommation',
              data: group.consumption || group.consommation || [],
              backgroundColor: `${color}99`,
              borderColor: color,
              borderWidth: 1,
            }]}
            unit="L"
            height={220}
          />
        </div>
        <div className="chart-card">
          <span className="curve-title">Consommation horaire</span>
          <LineChart
            labels={labels}
            datasets={[{
              label: 'Consommation horaire',
              data: hourlyValues,
              borderColor: color,
              backgroundColor: `${color}20`,
              fill: true,
            }]}
            unit="L/h"
            height={220}
          />
        </div>
      </div>
    </article>
  )
}

export default function GroupsPage({ onNavigate }) {
  const [groups, setGroups] = useState(null)
  const [demo, setDemo] = useState(false)
  const [rapportDebut, setRapportDebut] = useState('')
  const [rapportFin, setRapportFin] = useState('')
  const [siteId, setSiteId] = useState('')

  const load = async (queryParams = '') => {
    const { data, demo: isDemo } = await fetchGroupesDashboard(queryParams)
    const reportChoices = data.rapport_choices || []
    setGroups(data)
    setDemo(isDemo)
    setRapportDebut(data.selected_rapport_debut != null ? String(data.selected_rapport_debut) : String(reportChoices[0]?.id ?? ''))
    setRapportFin(data.selected_rapport_fin != null ? String(data.selected_rapport_fin) : String(reportChoices.at(-1)?.id ?? ''))
    setSiteId(data.selected_site_id != null ? String(data.selected_site_id) : String(data.sites?.[0]?.id ?? ''))
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

  if (!groups) {
    return (
      <div className="app-shell dashboard-shell">
        <Topbar activeView="groups" onNavigate={onNavigate} />
        <main className="groups-grid">
          <LoadingState label="Chargement des groupes électrogènes…" />
        </main>
      </div>
    )
  }

  const selectedSite = groups.sites?.find((site) => String(site.id) === String(siteId)) ?? groups.sites?.[0]
  const labels = groups.labels || []

  return (
    <div className="app-shell dashboard-shell">
      <Topbar activeView="groups" onNavigate={onNavigate} />
      <DemoBanner visible={demo} />

      <main className="groups-grid">
        <FilterBar
          idPrefix="groups"
          reportChoices={groups.rapport_choices || []}
          startValue={rapportDebut}
          endValue={rapportFin}
          onStartChange={setRapportDebut}
          onEndChange={setRapportFin}
          sites={groups.sites || []}
          siteValue={siteId}
          onSiteChange={setSiteId}
          onSubmit={applyFilters}
        />

        <section className="metric-section">
          <div className="section-title-wrap">
            <span className="metric-label">Métriques globales — {groups.period_label}</span>
            <h2>{selectedSite?.nom_site || 'Site'}</h2>
          </div>
          <div className="summary-strip">
            <SummaryChip label="Variation horaire sur la période" value={groups.site_hours?.total} unit="h" metric={groups.site_hours} field="variation_pct" />
            <SummaryChip label="Variation horaire moyenne" value={groups.site_hours?.mean} unit="h" metric={groups.site_hours} field="mean_variation_pct" />
            <SummaryChip label="Consommation sur la période" value={groups.site_consumption?.total} unit="L" metric={groups.site_consumption} field="variation_pct" />
            <SummaryChip label="Consommation moyenne" value={groups.site_consumption?.mean} unit="L" metric={groups.site_consumption} field="mean_variation_pct" />
          </div>
        </section>

        <section className="groups-list">
          {groups.group_blocks?.map((group) => (
            <GroupCard key={group.id} group={group} labels={labels} />
          ))}
        </section>
      </main>
    </div>
  )
}
