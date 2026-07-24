import { useEffect, useMemo, useState } from 'react'
import Topbar from '../components/Topbar'
import FilterBar from '../components/FilterBar'
import { LineChart, BarChart, MixedChart } from '../components/ChartCanvas'
import { LoadingState, DemoBanner } from '../components/PageState'
import { fetchDashboardMetrics, fetchAlertes } from '../lib/api'
import { fmt, fmtInt } from '../lib/format'

const FILL_COLORS = {
  ok: '#198754',
  warn: '#ffc107',
  danger: '#dc3545',
}

function fillTone(pct) {
  if (pct >= 50) return 'ok'
  if (pct >= 20) return 'warn'
  return 'danger'
}

function ThresholdLegend() {
  return (
    <div className="threshold-legend">
      <span><i className="threshold-ok" /> Optimal ≥ 50 %</span>
      <span><i className="threshold-warn" /> Moyen 20–50 %</span>
      <span><i className="threshold-danger" /> Critique &lt; 20 %</span>
    </div>
  )
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

function KpiStrip({ etatCuves, consommation, horaires, alertes, capacity }) {
  const autonomy = alertes?.global_autonomy_days
  const kpis = [
    {
      label: 'Capacité installée',
      value: fmt(capacity, 'L'),
      sub: 'métrique statique (toutes cuves)',
    },
    {
      label: 'Stock global',
      value: fmt(etatCuves?.total_volume_global, 'L'),
      sub: `remplissage ${fmt(etatCuves?.global_pct, '%')}`,
      tone: fillTone(etatCuves?.global_pct ?? 100),
    },
    {
      label: 'Autonomie globale',
      value: autonomy != null ? fmt(autonomy, 'jours') : '∞',
      sub: 'stock ÷ conso. journalière (tous sites)',
      tone: autonomy != null && autonomy < 30 ? 'danger' : autonomy != null && autonomy < 60 ? 'warn' : 'ok',
    },
    {
      label: 'Conso. hebdomadaire',
      value: fmt(consommation?.latest_total_liters ?? consommation?.global_consumption?.at(-1), 'L/sem'),
      sub: 'dernier rapport, tous sites',
    },
    {
      label: 'Heures de fonctionnement',
      value: fmt(horaires?.latest_total_hours ?? horaires?.global_hours?.at(-1), 'h'),
      sub: 'tous groupes, dernier rapport',
    },
  ]

  return (
    <section className="kpi-strip kpi-strip-5">
      {kpis.map((kpi) => (
        <div key={kpi.label} className={`kpi-card ${kpi.tone ? `kpi-${kpi.tone}` : ''}`}>
          <span className="kpi-label">{kpi.label}</span>
          <strong className="kpi-value">{kpi.value}</strong>
          <span className="kpi-sub">{kpi.sub}</span>
        </div>
      ))}
    </section>
  )
}

function AlertsSummary({ alertes, onNavigate }) {
  if (!alertes) return null
  return (
    <section className="alerts-summary">
      <button type="button" className="alerts-summary-card" onClick={() => onNavigate('alertes')}>
        <span className="kpi-label">Alertes critiques</span>
        <strong style={{ color: 'var(--danger)' }}>{fmtInt(alertes.critical?.length)}</strong>
        <span className="kpi-sub">niveaux &lt; 20 % — voir la page Alertes</span>
      </button>
      <button type="button" className="alerts-summary-card" onClick={() => onNavigate('alertes')}>
        <span className="kpi-label">Alertes significatives</span>
        <strong style={{ color: 'var(--accent)' }}>{fmtInt(alertes.significant?.length)}</strong>
        <span className="kpi-sub">niveaux 20–50 %</span>
      </button>
      <button type="button" className="alerts-summary-card" onClick={() => onNavigate('alertes')}>
        <span className="kpi-label">Top site gourmand</span>
        <strong>{alertes.top_consumers?.[0]?.site || '—'}</strong>
        <span className="kpi-sub">
          {alertes.top_consumers?.[0] ? fmt(alertes.top_consumers[0].consumption, 'L') : 'pas de conso.'}
        </span>
      </button>
    </section>
  )
}

export default function DashboardPage({ onNavigate }) {
  const [payload, setPayload] = useState(null)
  const [alertes, setAlertes] = useState(null)
  const [demo, setDemo] = useState(false)
  const [periodStart, setPeriodStart] = useState(0)
  const [periodEnd, setPeriodEnd] = useState(0)
  const [volumeMode, setVolumeMode] = useState('raw') // raw | relative | both
  const [consoMode, setConsoMode] = useState('week') // week | day

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
      <div className="app-shell dashboard-shell">
        <Topbar activeView="dashboard" onNavigate={onNavigate} />
        <main className="dashboard-grid">
          <LoadingState label="Chargement du dashboard…" />
        </main>
      </div>
    )
  }

  const { etatCuves, evolutionVolumes, horairesGroupes, consommation } = payload
  const labels = range(consommation.labels || [])
  const periodDays = range(evolutionVolumes.period_days || [])
  const reportChoices = (consommation.labels || []).map((label, index) => ({ id: index, label }))
  const capacity = evolutionVolumes.total_capacity || etatCuves.total_capacity_global || 0

  const cpColors = (etatCuves.cp_chart_pcts || []).map((pct) => FILL_COLORS[fillTone(pct)])
  const dailySeries = Object.entries(etatCuves.sites_cj_chart_data || {}).flatMap(([siteId, series]) =>
    (series.labels || []).map((label, index) => {
      const value = series.percentages?.[index] ?? 0
      return {
        label: `${label} · site ${siteId}`,
        value,
        color: series.colors?.[index] || FILL_COLORS[fillTone(value)],
      }
    }),
  )

  const weeklyConsumption = range(consommation.global_consumption || [])
  const dailyConsumption = weeklyConsumption.map((value, index) => {
    const days = periodDays[index] || 7
    return days > 0 ? Number((value / days).toFixed(1)) : 0
  })
  const consumptionSeries = consoMode === 'day' ? dailyConsumption : weeklyConsumption
  const consumptionUnit = consoMode === 'day' ? 'L/j' : 'L/sem'

  const globalVolumes = range(evolutionVolumes.global_volumes || [])
  const cpVolumes = range(evolutionVolumes.cp_volumes || evolutionVolumes.global_volumes || [])
  const relativeVolumes = globalVolumes.map((value) => (
    capacity > 0 ? Number(((value / capacity) * 100).toFixed(1)) : 0
  ))
  const capacityLine = labels.map(() => capacity)

  const volumeDatasets = []
  if (volumeMode === 'raw' || volumeMode === 'both') {
    volumeDatasets.push({
      label: 'Volume brut',
      data: globalVolumes,
      borderColor: '#60a5fa',
      backgroundColor: '#60a5fa22',
      fill: volumeMode === 'raw',
      yAxisID: 'y',
      type: 'line',
    })
    volumeDatasets.push({
      label: 'Capacité installée',
      data: capacityLine,
      borderColor: '#94a3b8',
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
      label: 'Taux de remplissage',
      data: relativeVolumes,
      borderColor: '#22c55e',
      backgroundColor: '#22c55e22',
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

  return (
    <div className="app-shell dashboard-shell">
      <Topbar activeView="dashboard" onNavigate={onNavigate} />
      <DemoBanner visible={demo} />

      <main className="dashboard-grid">
        <KpiStrip
          etatCuves={etatCuves}
          consommation={consommation}
          horaires={horairesGroupes}
          alertes={alertes}
          capacity={capacity}
        />

        <AlertsSummary alertes={alertes} onNavigate={onNavigate} />

        <section className="dashboard-cards">
          <article className="metric-panel">
            <div className="metric-toolbar">
              <div>
                <span className="metric-label">Métrique 1</span>
                <h3 style={{ margin: '6px 0 0' }}>Volume actuel des cuves</h3>
              </div>
              <ThresholdLegend />
            </div>
            <div className="metric-split-grid">
              <div className="chart-card">
                <span className="curve-title">Cuves principales (% + code couleur)</span>
                <BarChart
                  labels={etatCuves.cp_chart_labels}
                  datasets={[{
                    label: 'Remplissage',
                    data: etatCuves.cp_chart_pcts,
                    backgroundColor: cpColors,
                  }]}
                  unit="%"
                  height={280}
                  tooltipLabel={(ctx) => {
                    const quantity = etatCuves.cp_chart_quantities?.[ctx.dataIndex] ?? 0
                    const tone = fillTone(ctx.parsed.y)
                    const label = tone === 'ok' ? 'Optimal' : tone === 'warn' ? 'Moyen' : 'Critique'
                    return ` ${ctx.parsed.y.toLocaleString('fr-FR')} % (${label}) • ${quantity.toLocaleString('fr-FR')} L`
                  }}
                />
              </div>
              <div className="chart-card">
                <span className="curve-title">Cuves journalières (% + code couleur)</span>
                <BarChart
                  labels={dailySeries.map((item) => item.label)}
                  datasets={[{
                    label: 'Remplissage',
                    data: dailySeries.map((item) => item.value),
                    backgroundColor: dailySeries.map((item) => FILL_COLORS[fillTone(item.value)]),
                  }]}
                  unit="%"
                  height={280}
                />
              </div>
            </div>

            <div className="chart-card" style={{ marginTop: 16 }}>
              <span className="curve-title">Corrélation consommation ↔ volume cuves principales</span>
              <MixedChart
                labels={labels}
                leftUnit="L"
                rightUnit="L"
                height={300}
                datasets={[
                  {
                    type: 'bar',
                    label: 'Consommation',
                    data: weeklyConsumption,
                    backgroundColor: '#f59e0b99',
                    borderColor: '#f59e0b',
                    yAxisID: 'y',
                  },
                  {
                    type: 'line',
                    label: 'Stock cuves principales (CP)',
                    data: cpVolumes,
                    borderColor: '#0b3d7a',
                    backgroundColor: '#0b3d7a22',
                    fill: false,
                    yAxisID: 'y1',
                  },
                ]}
              />
            </div>
          </article>

          <FilterBar
            idPrefix="dashboard"
            reportChoices={reportChoices}
            startValue={String(periodStart)}
            endValue={String(periodEnd)}
            onStartChange={(value) => setPeriodStart(Number(value))}
            onEndChange={(value) => setPeriodEnd(Number(value))}
          />

          <article className="metric-panel">
            <div className="metric-toolbar">
              <div>
                <span className="metric-label">Métrique 2</span>
                <h3 style={{ margin: '6px 0 0' }}>Consommation — fréquence hebdomadaire</h3>
              </div>
              <ModeToggle
                value={consoMode}
                onChange={setConsoMode}
                options={[
                  { id: 'week', label: 'L / semaine' },
                  { id: 'day', label: 'L / jour' },
                ]}
              />
            </div>
            <div className="metric-split-grid">
              <div className="chart-card">
                <span className="curve-title">
                  {consoMode === 'week' ? 'Consommation hebdomadaire globale' : 'Consommation journalière moyenne'}
                </span>
                <BarChart
                  labels={labels}
                  datasets={[{
                    label: consoMode === 'week' ? 'L / semaine' : 'L / jour',
                    data: consumptionSeries,
                    backgroundColor: '#0b3d7a',
                  }]}
                  unit={consumptionUnit}
                  height={280}
                />
              </div>
              <div className="chart-card">
                <span className="curve-title">Top 8 sites (période sélectionnée)</span>
                <BarChart
                  labels={topSitesByConsumption.map((site) => site.label || site.nom_site)}
                  datasets={[{
                    label: 'Consommation',
                    data: topSitesByConsumption.map((site) => Number(site.total.toFixed(1))),
                    backgroundColor: '#3b82f6',
                  }]}
                  unit="L"
                  height={280}
                />
              </div>
            </div>
          </article>

          <article className="metric-panel">
            <span className="metric-label">Métrique 3</span>
            <h3>Variations horaires totales</h3>
            <div className="metric-split-grid">
              <div className="chart-card">
                <span className="curve-title">Écart horaire global</span>
                <LineChart
                  labels={labels}
                  datasets={[{
                    label: 'Écart horaire global',
                    data: range(horairesGroupes.global_hours),
                    borderColor: '#3b82f6',
                    backgroundColor: '#3b82f622',
                    fill: true,
                  }]}
                  unit="h"
                  height={280}
                />
              </div>
              <div className="chart-card">
                <span className="curve-title">Écarts par groupe (aperçu — page Groupes pour le détail)</span>
                <LineChart
                  labels={labels}
                  datasets={Object.values(horairesGroupes.sites_data || {})
                    .flatMap((site) => site.datasets || [])
                    .slice(0, 6)
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
              </div>
            </div>
          </article>

          <article className="metric-panel">
            <div className="metric-toolbar">
              <div>
                <span className="metric-label">Métrique 4</span>
                <h3 style={{ margin: '6px 0 0' }}>Volume total dans les cuves</h3>
                <p className="group-header-meta">
                  Capacité installée (statique) : {fmt(capacity, 'L')} — affichage en valeurs brutes et/ou en taux de remplissage.
                </p>
              </div>
              <ModeToggle
                value={volumeMode}
                onChange={setVolumeMode}
                options={[
                  { id: 'raw', label: 'Valeurs (L)' },
                  { id: 'relative', label: 'Taux (%)' },
                  { id: 'both', label: 'L + %' },
                ]}
              />
            </div>

            <div className="chart-card">
              <span className="curve-title">
                {volumeMode === 'raw' && 'Courbe des valeurs brutes + capacité'}
                {volumeMode === 'relative' && 'Courbe des taux de remplissage'}
                {volumeMode === 'both' && 'Valeurs brutes (gauche) et taux % (droite)'}
              </span>
              {volumeMode === 'both' ? (
                <MixedChart
                  labels={labels}
                  leftUnit="L"
                  rightUnit="%"
                  height={300}
                  datasets={volumeDatasets}
                />
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
          </article>
        </section>
      </main>
    </div>
  )
}
