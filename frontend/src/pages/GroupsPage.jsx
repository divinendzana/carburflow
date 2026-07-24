import { useEffect, useMemo, useState } from 'react'
import Topbar from '../components/Topbar'
import PageHeader from '../components/PageHeader'
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
    return h > 0 ? Number((c / h).toFixed(2)) : 0
  })
}

function autonomyTone(hours) {
  if (hours == null) return 'unknown'
  if (hours < 24) return 'danger'
  if (hours < 72) return 'warn'
  return 'ok'
}

function formatAutonomy(hours) {
  if (hours == null) return { main: '—', sub: 'non calculée' }
  if (hours >= 48) {
    return { main: fmt(hours / 24), sub: `jours · ${fmt(hours, 'h')}` }
  }
  return { main: fmt(hours), sub: 'heures' }
}

/**
 * Tuile compacte : l’autonomie est le chiffre dominant, visible sans clic.
 */
function tileKey(group) {
  return `${group.site_id ?? 'x'}-${group.id}`
}

function AutonomyTile({ group, selected, onSelect }) {
  const tone = autonomyTone(group.autonomie_hours)
  const auto = formatAutonomy(group.autonomie_hours)
  const hours = group.hours?.total
  const conso = group.consumption_stats?.total

  return (
    <button
      type="button"
      className={`autonomy-tile autonomy-tile-${tone} ${selected ? 'selected' : ''}`}
      onClick={() => onSelect(tileKey(group))}
      aria-pressed={selected}
    >
      <span className="autonomy-tile-site">{group.site_nom || 'Site'}</span>
      <span className="autonomy-tile-name">{group.label}</span>
      <span className="autonomy-tile-value">
        <strong>{auto.main}</strong>
        <small>{auto.sub}</small>
      </span>
      <span className="autonomy-tile-meta">
        <span>{fmt(hours, 'h')}</span>
        <span>{fmt(conso, 'L')}</span>
      </span>
    </button>
  )
}

function GroupDetail({ group, labels }) {
  const color = group.color || '#0d4f5c'
  const hourlyValues = hourlyConsumptionSeries(group)
  const hourlyMetric = buildDerivedMetric(hourlyValues)
  const auto = formatAutonomy(group.autonomie_hours)

  return (
    <article className="group-detail">
      <div className="group-detail-head">
        <div>
          <span className="metric-label">{group.site_nom}</span>
          <h3>{group.label}</h3>
          <p className="group-header-meta">
            {fmt(group.rate, 'L/h')} — {group.marque || ''} {group.puissance || ''}
          </p>
        </div>
        <div className={`autonomy-callout autonomy-tile-${autonomyTone(group.autonomie_hours)}`}>
          <span>Autonomie</span>
          <strong>{auto.main}</strong>
          <small>{auto.sub}</small>
        </div>
      </div>

      <div className="group-metric-grid">
        <StatBlock title="Heures de marche" metric={group.hours} unit="h" />
        <StatBlock title="Consommation" metric={group.consumption_stats} unit="L" />
        <StatBlock title="Consommation horaire" metric={hourlyMetric} unit="L/h" />
      </div>

      <div className="group-curve-grid">
        <div className="chart-card">
          <span className="curve-title">Heures de marche</span>
          <LineChart
            labels={labels}
            datasets={[{
              label: group.label,
              data: group.hours_run || [],
              borderColor: color,
              backgroundColor: `${color}22`,
              fill: true,
            }]}
            unit="h"
            height={200}
          />
        </div>
        <div className="chart-card">
          <span className="curve-title">Consommation</span>
          <BarChart
            labels={labels}
            datasets={[{
              label: 'Consommation',
              data: group.consumption || group.consommation || [],
              backgroundColor: `${color}aa`,
              borderColor: color,
              borderWidth: 1,
            }]}
            unit="L"
            height={200}
          />
        </div>
        <div className="chart-card">
          <span className="curve-title">Consommation horaire</span>
          <LineChart
            labels={labels}
            datasets={[{
              label: 'L/h',
              data: hourlyValues,
              borderColor: color,
              backgroundColor: `${color}22`,
              fill: true,
            }]}
            unit="L/h"
            height={200}
          />
        </div>
      </div>
    </article>
  )
}

export default function GroupsPage({ onNavigate }) {
  const [groups, setGroups] = useState(null)
  const [allTiles, setAllTiles] = useState([])
  const [demo, setDemo] = useState(false)
  const [rapportDebut, setRapportDebut] = useState('')
  const [rapportFin, setRapportFin] = useState('')
  const [siteId, setSiteId] = useState('all')
  const [selectedKey, setSelectedKey] = useState(null)
  const [loadingFleet, setLoadingFleet] = useState(false)

  const load = async (queryParams = '', preferAll = true) => {
    setLoadingFleet(true)
    try {
      const { data, demo: isDemo } = await fetchGroupesDashboard(queryParams)
      const reportChoices = data.rapport_choices || []
      const debut = data.selected_rapport_debut != null ? String(data.selected_rapport_debut) : String(reportChoices[0]?.id ?? '')
      const fin = data.selected_rapport_fin != null ? String(data.selected_rapport_fin) : String(reportChoices.at(-1)?.id ?? '')
      setGroups(data)
      setDemo(isDemo)
      setRapportDebut(debut)
      setRapportFin(fin)

      // Flotte entière : une tuile par groupe, autonomie visible sans scroll de cartes longues.
      if (preferAll && data.sites?.length) {
        const results = await Promise.all(
          data.sites.map(async (site) => {
            const params = new URLSearchParams()
            if (debut) params.set('rapport_debut', debut)
            if (fin) params.set('rapport_fin', fin)
            params.set('site_id', String(site.id))
            const { data: siteData } = await fetchGroupesDashboard(params.toString())
            return (siteData.group_blocks || []).map((block) => ({
              ...block,
              site_id: site.id,
              site_nom: site.nom_site,
            }))
          }),
        )
        const merged = results.flat().sort((a, b) => {
          const ah = a.autonomie_hours
          const bh = b.autonomie_hours
          if (ah == null && bh == null) return 0
          if (ah == null) return 1
          if (bh == null) return -1
          return ah - bh
        })
        setAllTiles(merged)
        setSelectedKey(merged[0] ? tileKey(merged[0]) : null)
      } else {
        const blocks = (data.group_blocks || []).map((block) => ({
          ...block,
          site_id: data.selected_site_id,
          site_nom: data.sites?.find((s) => String(s.id) === String(data.selected_site_id))?.nom_site,
        }))
        const sorted = blocks.sort((a, b) => (a.autonomie_hours ?? 1e9) - (b.autonomie_hours ?? 1e9))
        setAllTiles(sorted)
        setSelectedKey(sorted[0] ? tileKey(sorted[0]) : null)
      }
    } finally {
      setLoadingFleet(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyFilters = () => {
    const params = new URLSearchParams()
    if (rapportDebut) params.set('rapport_debut', rapportDebut)
    if (rapportFin) params.set('rapport_fin', rapportFin)
    const all = siteId === 'all'
    if (!all && siteId) params.set('site_id', siteId)
    setSelectedKey(null)
    load(params.toString(), all)
  }

  const visibleTiles = useMemo(() => {
    if (siteId === 'all') return allTiles
    return allTiles.filter((tile) => String(tile.site_id) === String(siteId))
  }, [allTiles, siteId])

  const selected = visibleTiles.find((tile) => tileKey(tile) === selectedKey) || visibleTiles[0]
  const labels = groups?.labels || []

  const siteOptions = useMemo(() => {
    const sites = groups?.sites || []
    return [{ id: 'all', nom_site: 'Tous les sites' }, ...sites]
  }, [groups])

  const lowest = visibleTiles.filter((t) => t.autonomie_hours != null).slice(0, 3)

  if (!groups) {
    return (
      <div className="app-shell">
        <Topbar activeView="groups" onNavigate={onNavigate} />
        <main className="page-stack">
          <LoadingState label="Chargement des groupes…" />
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Topbar activeView="groups" onNavigate={onNavigate} />
      <DemoBanner visible={demo} />

      <main className="page-stack">
        <PageHeader
          eyebrow="Groupes électrogènes"
          title="Autonomie en un coup d’œil"
          description="Chaque tuile montre l’autonomie. Les plus urgentes (rouge) apparaissent en premier. Cliquez une tuile seulement pour le détail."
        />

        <FilterBar
          idPrefix="groups"
          reportChoices={groups.rapport_choices || []}
          startValue={rapportDebut}
          endValue={rapportFin}
          onStartChange={setRapportDebut}
          onEndChange={setRapportFin}
          sites={siteOptions}
          siteValue={siteId}
          onSiteChange={setSiteId}
          onSubmit={applyFilters}
          hint="Par défaut : tous les sites. Afficher met à jour le mur d’autonomie."
        />

        <section className="summary-strip">
          <SummaryChip label="Groupes visibles" value={visibleTiles.length} unit="" />
          <SummaryChip label="Heures (site actif)" value={groups.site_hours?.total} unit="h" metric={groups.site_hours} field="variation_pct" />
          <SummaryChip label="Consommation (site actif)" value={groups.site_consumption?.total} unit="L" metric={groups.site_consumption} field="variation_pct" />
          <div className="summary-chip">
            <span>Autonomie la plus faible</span>
            <strong>
              {lowest[0] ? formatAutonomy(lowest[0].autonomie_hours).main : '—'}
              {lowest[0] && lowest[0].autonomie_hours >= 48 ? ' j' : lowest[0] ? ' h' : ''}
            </strong>
            <small className="delta-neutral">{lowest[0]?.label || '—'}</small>
          </div>
        </section>

        {loadingFleet && <p className="fleet-loading">Mise à jour du mur d’autonomie…</p>}

        <section className="autonomy-board" aria-label="Mur d’autonomie des groupes">
          <div className="autonomy-legend">
            <span className="help-chip help-danger">Rouge &lt; 24 h</span>
            <span className="help-chip help-warn">Orange &lt; 72 h</span>
            <span className="help-chip help-ok">Vert ≥ 72 h</span>
            <span className="autonomy-board-hint">Trié du plus urgent au plus confortable</span>
          </div>

          <div className="autonomy-grid">
            {visibleTiles.map((group) => (
              <AutonomyTile
                key={tileKey(group)}
                group={group}
                selected={selected && tileKey(selected) === tileKey(group)}
                onSelect={setSelectedKey}
              />
            ))}
            {!visibleTiles.length && !loadingFleet && (
              <p className="strategic-empty">Aucun groupe pour ce filtre.</p>
            )}
          </div>
        </section>

        {selected && (
          <section>
            <div className="section-title-wrap">
              <span className="metric-label">Détail (optionnel)</span>
              <h2>Courbes du groupe sélectionné</h2>
            </div>
            <GroupDetail group={selected} labels={labels} />
          </section>
        )}
      </main>
    </div>
  )
}
