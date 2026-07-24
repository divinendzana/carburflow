import { useEffect, useMemo, useState } from 'react'
import Topbar from '../components/Topbar'
import PageHeader from '../components/PageHeader'
import FilterBar from '../components/FilterBar'
import { LineChart, BarChart, MixedChart } from '../components/ChartCanvas'
import { LoadingState, DemoBanner } from '../components/PageState'
import { fetchDashboardMetrics, fetchAlertes } from '../lib/api'
import { fmt, fmtInt } from '../lib/format'

const FILL_COLORS = {
  ok: '#1f7a4d',
  warn: '#c9891a',
  danger: '#c23b3b',
}

const TABS = [
  { id: 'niveaux', label: 'Niveaux des cuves', help: 'Où en est le stock aujourd’hui ?' },
  { id: 'conso', label: 'Consommation', help: 'Combien a-t-on consommé ?' },
  { id: 'heures', label: 'Heures de marche', help: 'Combien d’heures les groupes ont tourné ?' },
  { id: 'stock', label: 'Évolution du stock', help: 'Comment le stock évolue dans le temps ?' },
]

function fillTone(pct) {
  if (pct >= 50) return 'ok'
  if (pct >= 20) return 'warn'
  return 'danger'
}

function ModeToggle({ value, onChange, options }) {
  return (
    <div className="mode-toggle" role="group">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={value === option.id ? 'active' : ''}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function StatusDot({ tone }) {
  return <span className={`status-dot status-${tone}`} aria-hidden="true" />
}

export default function DashboardPage({ onNavigate }) {
  const [payload, setPayload] = useState(null)
  const [alertes, setAlertes] = useState(null)
  const [demo, setDemo] = useState(false)
  const [periodStart, setPeriodStart] = useState(0)
  const [periodEnd, setPeriodEnd] = useState(0)
  const [tab, setTab] = useState('niveaux')
  const [volumeMode, setVolumeMode] = useState('raw')
  const [consoMode, setConsoMode] = useState('week')

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchDashboardMetrics(), fetchAlertes()]).then(([metrics, alerts]) => {
      if (cancelled) return
      setPayload(metrics.data)
      setAlertes(alerts.data)
      setDemo(metrics.demo || alerts.demo)
      setPeriodStart(0)
      setPeriodEnd(Math.max((metrics.data.consommation.labels?.length || 1) - 1, 0))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const range = useMemo(() => {
    const start = Math.min(periodStart, periodEnd)
    const end = Math.max(periodStart, periodEnd)
    return (items = []) => items.slice(start, end + 1)
  }, [periodStart, periodEnd])

  if (!payload) {
    return (
      <div className="app-shell">
        <Topbar activeView="dashboard" onNavigate={onNavigate} />
        <main className="page-stack">
          <LoadingState label="Chargement de la vue d’ensemble…" />
        </main>
      </div>
    )
  }

  const { etatCuves, evolutionVolumes, horairesGroupes, consommation } = payload
  const labels = range(consommation.labels || [])
  const periodDays = range(evolutionVolumes.period_days || [])
  const reportChoices = (consommation.labels || []).map((label, index) => ({ id: index, label }))
  const capacity = evolutionVolumes.total_capacity || etatCuves.total_capacity_global || 0
  const autonomy = alertes?.global_autonomy_days
  const criticalCount = alertes?.critical?.length ?? 0
  const significantCount = alertes?.significant?.length ?? 0

  const cpColors = (etatCuves.cp_chart_pcts || []).map((pct) => FILL_COLORS[fillTone(pct)])
  const dailySeries = Object.entries(etatCuves.sites_cj_chart_data || {}).flatMap(([siteId, series]) =>
    (series.labels || []).map((label, index) => {
      const value = series.percentages?.[index] ?? 0
      return {
        label: `${label} · site ${siteId}`,
        value,
        color: FILL_COLORS[fillTone(value)],
      }
    }),
  )

  const weeklyConsumption = range(consommation.global_consumption || [])
  const dailyConsumption = weeklyConsumption.map((value, index) => {
    const days = periodDays[index] || 7
    return days > 0 ? Number((value / days).toFixed(1)) : 0
  })
  const consumptionSeries = consoMode === 'day' ? dailyConsumption : weeklyConsumption
  const consumptionUnit = consoMode === 'day' ? 'L/j' : 'L/semaine'

  const globalVolumes = range(evolutionVolumes.global_volumes || [])
  const cpVolumes = range(evolutionVolumes.cp_volumes || evolutionVolumes.global_volumes || [])
  const relativeVolumes = globalVolumes.map((value) => (
    capacity > 0 ? Number(((value / capacity) * 100).toFixed(1)) : 0
  ))
  const capacityLine = labels.map(() => capacity)

  const volumeDatasets = []
  if (volumeMode === 'raw' || volumeMode === 'both') {
    volumeDatasets.push({
      label: 'Stock (litres)',
      data: globalVolumes,
      borderColor: '#0d6e7a',
      backgroundColor: '#0d6e7a22',
      fill: volumeMode === 'raw',
      yAxisID: 'y',
      type: 'line',
    })
    volumeDatasets.push({
      label: 'Capacité max',
      data: capacityLine,
      borderColor: '#8aa0a8',
      borderDash: [6, 6],
      borderWidth: 2,
      pointRadius: 0,
      fill: false,
      yAxisID: 'y',
      type: 'line',
    })
  }
  if (volumeMode === 'relative' || volumeMode === 'both') {
    volumeDatasets.push({
      label: 'Remplissage (%)',
      data: relativeVolumes,
      borderColor: '#1f7a4d',
      backgroundColor: '#1f7a4d22',
      fill: volumeMode === 'relative',
      yAxisID: volumeMode === 'both' ? 'y1' : 'y',
      type: 'line',
    })
  }

  const topSitesByConsumption = [...(consommation.sites_series || [])]
    .map((site) => ({
      ...site,
      total: range(site.data || []).reduce((sum, value) => sum + (value || 0), 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)

  const activeTab = TABS.find((item) => item.id === tab) || TABS[0]

  return (
    <div className="app-shell">
      <Topbar activeView="dashboard" onNavigate={onNavigate} />
      <DemoBanner visible={demo} />

      <main className="page-stack">
        <PageHeader
          eyebrow="Vue d’ensemble"
          title="Analyses & tendances"
          description="L’accueil montre le capital (autonomie, alertes). Ici, vous creusez les courbes et les comparaisons."
        />

        {(criticalCount > 0 || significantCount > 0) && (
          <section className="attention-banner" role="region" aria-label="Points d’attention">
            <div>
              <strong>À regarder en priorité</strong>
              <p>
                {criticalCount > 0 && <>{fmtInt(criticalCount)} cuve{criticalCount > 1 ? 's' : ''} presque vide{criticalCount > 1 ? 's' : ''}</>}
                {criticalCount > 0 && significantCount > 0 && ' · '}
                {significantCount > 0 && <>{fmtInt(significantCount)} niveau{significantCount > 1 ? 'x' : ''} à surveiller</>}
              </p>
            </div>
            <div className="attention-actions">
              <button type="button" className="btn-primary" onClick={() => onNavigate('alertes')}>
                Ouvrir les alertes
              </button>
              <button type="button" className="btn-ghost" onClick={() => onNavigate('presentation')}>
                Retour à l’accueil
              </button>
            </div>
          </section>
        )}

        <section className="kpi-strip kpi-strip-4" aria-label="Indicateurs clés">
          <div className={`kpi-card kpi-featured ${autonomy != null && autonomy < 30 ? 'kpi-danger' : autonomy != null && autonomy < 60 ? 'kpi-warn' : 'kpi-ok'}`}>
            <span className="kpi-label">Autonomie restante</span>
            <strong className="kpi-value">{autonomy != null ? fmt(autonomy, 'jours') : '∞'}</strong>
            <span className="kpi-sub">Au rythme actuel, tous sites confondus</span>
          </div>
          <div className={`kpi-card kpi-${fillTone(etatCuves?.global_pct ?? 100)}`}>
            <span className="kpi-label">Stock disponible</span>
            <strong className="kpi-value">{fmt(etatCuves?.total_volume_global, 'L')}</strong>
            <span className="kpi-sub">
              <StatusDot tone={fillTone(etatCuves?.global_pct ?? 100)} />
              Rempli à {fmt(etatCuves?.global_pct, '%')}
            </span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Consommé (dernier relevé)</span>
            <strong className="kpi-value">{fmt(consommation?.latest_total_liters ?? consommation?.global_consumption?.at(-1), 'L')}</strong>
            <span className="kpi-sub">Sur la dernière période de rapport</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Heures de marche</span>
            <strong className="kpi-value">{fmt(horairesGroupes?.latest_total_hours ?? horairesGroupes?.global_hours?.at(-1), 'h')}</strong>
            <span className="kpi-sub">Tous les groupes, dernier relevé</span>
          </div>
        </section>

        <FilterBar
          idPrefix="dashboard"
          reportChoices={reportChoices}
          startValue={String(periodStart)}
          endValue={String(periodEnd)}
          onStartChange={(value) => setPeriodStart(Number(value))}
          onEndChange={(value) => setPeriodEnd(Number(value))}
          hint="Les graphiques ci-dessous suivent la période choisie."
        />

        <div className="section-tabs" role="tablist" aria-label="Thèmes de la vue d’ensemble">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={`section-tab ${tab === item.id ? 'active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <section className="tab-panel" role="tabpanel">
          <div className="tab-panel-intro">
            <h2>{activeTab.label}</h2>
            <p>{activeTab.help}</p>
          </div>

          {tab === 'niveaux' && (
            <>
              <div className="help-chips">
                <span className="help-chip help-ok">Vert = OK (≥ 50 %)</span>
                <span className="help-chip help-warn">Orange = à surveiller (20–50 %)</span>
                <span className="help-chip help-danger">Rouge = critique (&lt; 20 %)</span>
              </div>
              <div className="metric-split-grid">
                <div className="chart-panel">
                  <h3>Grandes cuves (stockage)</h3>
                  <p className="chart-hint">Les réservoirs principaux de chaque site.</p>
                  <BarChart
                    labels={etatCuves.cp_chart_labels}
                    datasets={[{ label: 'Remplissage', data: etatCuves.cp_chart_pcts, backgroundColor: cpColors }]}
                    unit="%"
                    horizontal={(etatCuves.cp_chart_labels || []).length > 4}
                    height={Math.max(280, (etatCuves.cp_chart_labels || []).length * 36)}
                    tooltipLabel={(ctx) => {
                      const value = ctx.parsed.x ?? ctx.parsed.y
                      const quantity = etatCuves.cp_chart_quantities?.[ctx.dataIndex] ?? 0
                      const tone = fillTone(value)
                      const label = tone === 'ok' ? 'OK' : tone === 'warn' ? 'À surveiller' : 'Critique'
                      return ` ${Number(value).toLocaleString('fr-FR')} % (${label}) · ${quantity.toLocaleString('fr-FR')} L`
                    }}
                  />
                </div>
                <div className="chart-panel">
                  <h3>Cuves du jour (alimentation groupes)</h3>
                  <p className="chart-hint">Les petites cuves qui alimentent les groupes électrogènes.</p>
                  <BarChart
                    labels={dailySeries.map((item) => item.label)}
                    datasets={[{
                      label: 'Remplissage',
                      data: dailySeries.map((item) => item.value),
                      backgroundColor: dailySeries.map((item) => item.color),
                    }]}
                    unit="%"
                    horizontal={dailySeries.length > 4}
                    height={Math.max(280, dailySeries.length * 36)}
                  />
                </div>
              </div>
              <div className="chart-panel chart-panel-wide">
                <h3>Consommation et stock des grandes cuves</h3>
                <p className="chart-hint">Barres = carburant consommé. Courbe = stock restant dans les grandes cuves.</p>
                <MixedChart
                  labels={labels}
                  leftUnit="L"
                  rightUnit="L"
                  height={300}
                  datasets={[
                    {
                      type: 'bar',
                      label: 'Consommé',
                      data: weeklyConsumption,
                      backgroundColor: '#e8a31799',
                      borderColor: '#e8a317',
                      yAxisID: 'y',
                    },
                    {
                      type: 'line',
                      label: 'Stock grandes cuves',
                      data: cpVolumes,
                      borderColor: '#0d4f5c',
                      backgroundColor: '#0d4f5c22',
                      fill: false,
                      yAxisID: 'y1',
                    },
                  ]}
                />
              </div>
            </>
          )}

          {tab === 'conso' && (
            <>
              <div className="metric-toolbar">
                <p className="chart-hint">Affichez la consommation par semaine ou en moyenne par jour.</p>
                <ModeToggle
                  value={consoMode}
                  onChange={setConsoMode}
                  options={[
                    { id: 'week', label: 'Par semaine' },
                    { id: 'day', label: 'Par jour' },
                  ]}
                />
              </div>
              <div className="metric-split-grid">
                <div className="chart-panel">
                  <h3>{consoMode === 'week' ? 'Consommation totale par semaine' : 'Moyenne par jour'}</h3>
                  <BarChart
                    labels={labels}
                    datasets={[{
                      label: consumptionUnit,
                      data: consumptionSeries,
                      backgroundColor: '#0d4f5c',
                    }]}
                    unit={consumptionUnit}
                    height={280}
                  />
                </div>
                <div className="chart-panel">
                  <h3>Sites qui consomment le plus</h3>
                  <p className="chart-hint">Top 8 sur la période sélectionnée — le plus gourmand en haut.</p>
                  <BarChart
                    labels={topSitesByConsumption.map((site) => site.label || site.nom_site)}
                    datasets={[{
                      label: 'Consommation',
                      data: topSitesByConsumption.map((site) => Number(site.total.toFixed(1))),
                      backgroundColor: topSitesByConsumption.map((_, i) => (i === 0 ? '#c23b3b' : '#e8a317')),
                    }]}
                    unit="L"
                    horizontal
                    height={Math.max(240, topSitesByConsumption.length * 38)}
                  />
                </div>
              </div>
            </>
          )}

          {tab === 'heures' && (
            <div className="metric-split-grid">
              <div className="chart-panel">
                <h3>Heures de marche (tous groupes)</h3>
                <p className="chart-hint">Somme des heures ajoutées entre deux relevés.</p>
                <LineChart
                  labels={labels}
                  datasets={[{
                    label: 'Heures',
                    data: range(horairesGroupes.global_hours),
                    borderColor: '#0d6e7a',
                    backgroundColor: '#0d6e7a22',
                    fill: true,
                  }]}
                  unit="h"
                  height={280}
                />
              </div>
              <div className="chart-panel">
                <h3>Quelques groupes (aperçu)</h3>
                <p className="chart-hint">Pour le détail complet, ouvrez la page Groupes.</p>
                <LineChart
                  labels={labels}
                  datasets={Object.values(horairesGroupes.sites_data || {})
                    .flatMap((site) => site.datasets || [])
                    .slice(0, 5)
                    .map((dataset) => ({
                      label: dataset.label,
                      data: range(dataset.data),
                      borderColor: dataset.borderColor,
                      backgroundColor: dataset.backgroundColor,
                      borderWidth: 2,
                    }))}
                  unit="h"
                  showLegend
                  height={280}
                />
                <button type="button" className="btn-ghost btn-inline" onClick={() => onNavigate('groups')}>
                  Voir tous les groupes →
                </button>
              </div>
            </div>
          )}

          {tab === 'stock' && (
            <>
              <div className="metric-toolbar">
                <p className="chart-hint">
                  Capacité totale installée : <strong>{fmt(capacity, 'L')}</strong> (valeur fixe).
                </p>
                <ModeToggle
                  value={volumeMode}
                  onChange={setVolumeMode}
                  options={[
                    { id: 'raw', label: 'En litres' },
                    { id: 'relative', label: 'En %' },
                    { id: 'both', label: 'Litres + %' },
                  ]}
                />
              </div>
              <div className="chart-panel chart-panel-wide">
                <h3>Stock total dans le temps</h3>
                {volumeMode === 'both' ? (
                  <MixedChart labels={labels} leftUnit="L" rightUnit="%" height={300} datasets={volumeDatasets} />
                ) : (
                  <LineChart
                    labels={labels}
                    datasets={volumeDatasets}
                    unit={volumeMode === 'relative' ? '%' : 'L'}
                    beginAtZero
                    showLegend
                    height={300}
                  />
                )}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  )
}
