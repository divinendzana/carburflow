import React, { useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom/client'
import logo from '../../logo/logo_clair_navbar.jpeg'
import './styles.css'

const Chart = window.Chart

const fallbackDashboardData = {
  metric1: {
    labels: ['CP #1 (BUF Bepanda)', 'CP #2 (BUF Bonaberi)', 'CP #3 (BUF Yaounde)'],
    values: [62, 40, 55],
  },
  metric2: {
    labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jui'],
    globalVolumes: [1800, 2100, 2050, 2350, 2600, 2820],
    siteSeries: [
      { label: 'BUF Bepanda', data: [700, 780, 760, 850, 920, 1000], borderColor: '#0b3d7a', backgroundColor: '#0b3d7a22' },
      { label: 'BUF Bonaberi', data: [560, 620, 610, 720, 760, 820], borderColor: '#3b82f6', backgroundColor: '#3b82f622' },
      { label: 'BUF Yaounde', data: [540, 700, 680, 780, 920, 1000], borderColor: '#60a5fa', backgroundColor: '#60a5fa22' },
    ],
  },
  metric3: {
    labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jui'],
    globalHours: [42, 48, 54, 61, 58, 66],
    sitesData: {
      1: {
        nom_site: 'BUF Bepanda',
        datasets: [
          { label: 'G#1 (Group 1)', data: [18, 21, 22, 24, 23, 26], borderColor: '#0b3d7a', backgroundColor: '#0b3d7a22' },
          { label: 'G#2 (Group 2)', data: [12, 13, 15, 17, 16, 18], borderColor: '#3b82f6', backgroundColor: '#3b82f622' },
        ],
      },
      2: {
        nom_site: 'BUF Bonaberi',
        datasets: [
          { label: 'G#3 (Group 3)', data: [10, 14, 17, 20, 19, 22], borderColor: '#60a5fa', backgroundColor: '#60a5fa22' },
        ],
      },
    },
  },
  metric4: {
    labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jui'],
    globalConsumption: [380, 420, 460, 490, 520, 570],
    siteSeries: [
      { label: 'BUF Bepanda', data: [130, 150, 170, 180, 190, 220], borderColor: '#0b3d7a', backgroundColor: '#0b3d7a22' },
      { label: 'BUF Bonaberi', data: [115, 130, 145, 150, 160, 175], borderColor: '#3b82f6', backgroundColor: '#3b82f622' },
      { label: 'BUF Yaounde', data: [135, 140, 145, 160, 170, 175], borderColor: '#60a5fa', backgroundColor: '#60a5fa22' },
    ],
  },
}

function Topbar({ activeView, onNavigate }) {
  return (
    <header className="topbar">
      <div className="brand-wrap">
        <img src={logo} alt="Logo CarburFlow" className="brand-logo" />
        <div className="brand-text">
          <span className="brand-name">CarburFlow</span>
          <span className="brand-subtitle">Dashboard de suivi carburant</span>
        </div>
      </div>

      <nav className="topbar-actions" aria-label="Navigation principale">
        <button type="button" className={`nav-link ${activeView === 'presentation' ? 'active' : ''}`} onClick={() => onNavigate('presentation')}>Présentation</button>
        <button type="button" className={`nav-link ${activeView === 'dashboard' ? 'active' : ''}`} onClick={() => onNavigate('dashboard')}>Dashboard</button>
        <button type="button" className={`nav-link ${activeView === 'groups' ? 'active' : ''}`} onClick={() => onNavigate('groups')}>Groupes</button>
      </nav>
    </header>
  )
}

function PresentationPage({ onNavigate }) {
  return (
    <div className="app-shell">
      <Topbar activeView="presentation" onNavigate={onNavigate} />

      <main className="content-grid">
        <section className="hero-panel">
          <div className="hero-copy">
            <span className="eyebrow">Vision globale</span>
            <h1>Supervision du carburant dans les sites</h1>
            <p>
              Plateforme de suivi et de pilotage des sites, groupes électrogènes et niveaux de stock.
              La page de présentation donne une première lecture claire du projet et de sa couverture opérationnelle.
            </p>
          </div>

          <div className="hero-stats">
            <div className="stat-pill">
              <span>Sites actifs</span>
              <strong>03</strong>
            </div>
            <div className="stat-pill">
              <span>Groupes suivis</span>
              <strong>03</strong>
            </div>
            <div className="stat-pill">
              <span>Dernier rapport</span>
              <strong>2026</strong>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function MetricPanel({ label, title, children }) {
  return (
    <article className="metric-panel">
      <span className="metric-label">{label}</span>
      <h3>{title}</h3>
      {children}
    </article>
  )
}

function GroupsPage({ onNavigate }) {
  const chartPalette = useMemo(() => ({
    text: '#23466d',
    grid: 'rgba(11, 61, 122, 0.08)',
  }), [])
  const [groupsData, setGroupsData] = useState(null)
  const [rapportDebut, setRapportDebut] = useState('')
  const [rapportFin, setRapportFin] = useState('')
  const [siteId, setSiteId] = useState('')

  const loadGroupsData = async (queryParams = '') => {
    try {
      const response = await fetch(`/dashboard/groupes${queryParams ? `?${queryParams}` : ''}`)
      const data = await response.json()
      setGroupsData(data)
      setRapportDebut(data.selected_rapport_debut ?? '')
      setRapportFin(data.selected_rapport_fin ?? '')
      setSiteId(data.selected_site_id ?? '')
    } catch (error) {
      console.warn('Groups backend unavailable, using demo fallback data.', error)
      setGroupsData({
        period_label: 'Période de démonstration',
        previous_period_label: null,
        selected_site_id: 1,
        report_choices: [{ id: 1, label: '01/01 au 07/01' }, { id: 2, label: '08/01 au 14/01' }],
        sites: [{ id: 1, nom_site: 'BUF Bepanda' }],
        site_hours: { total: 140.0, mean: 28.0, previous_total: 120.0, previous_mean: 24.0, variation_pct: 16.7, all_time_mean: 27.0, has_previous_period: true },
        site_consumption: { total: 560.0, mean: 112.0, previous_total: 500.0, previous_mean: 100.0, variation_pct: 12.0, all_time_mean: 105.0, has_previous_period: true },
        labels: ['01/01 au 07/01', '08/01 au 14/01'],
        group_blocks: [
          {
            id: 1,
            label: 'G#100 (Perkins 250kVA)',
            marque: 'Perkins',
            puissance: '250kVA',
            rate: 15.5,
            color: '#0d6efd',
            hours: { total: 29.5, mean: 7.4, previous_total: null, previous_mean: null, variation_pct: null, all_time_mean: 14.8, has_previous_period: false },
            consumption_stats: { total: 457.3, mean: 114.3, previous_total: null, previous_mean: null, variation_pct: null, all_time_mean: 228.7, has_previous_period: false },
            hours_run: [15, 17],
            consumption: [95, 115],
            compteurs: [240, 300],
          },
        ],
      })
    }
  }

  useEffect(() => {
    loadGroupsData()
  }, [])

  useEffect(() => {
    if (!window.Chart || !groupsData) {
      return undefined
    }

    const charts = []
    const labels = groupsData.labels || []
    const baseOptions = (unit, beginZero = false) => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => ` ${context.parsed.y.toLocaleString('fr-FR')} ${unit}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: chartPalette.text },
          grid: { color: chartPalette.grid },
        },
        y: {
          beginAtZero: beginZero,
          ticks: {
            color: chartPalette.text,
            callback: (value) => `${value.toLocaleString('fr-FR')} ${unit}`,
          },
          grid: { color: chartPalette.grid },
        },
      },
    })

    groupsData.group_blocks?.forEach((block) => {
      const hoursTarget = document.getElementById(`chart-group-${block.id}-hours`)
      if (hoursTarget) {
        const hoursChart = new Chart(hoursTarget, {
          type: 'line',
          data: {
            labels,
            datasets: [
              {
                label: block.label,
                data: block.hours_run,
                borderColor: block.color || '#0b3d7a',
                backgroundColor: `${block.color || '#0b3d7a'}20`,
                borderWidth: 2,
                tension: 0.35,
                fill: true,
                pointRadius: 4,
              },
            ],
          },
          options: baseOptions('h', false),
        })
        charts.push(hoursChart)
      }

      const consumptionTarget = document.getElementById(`chart-group-${block.id}-consumption`)
      if (consumptionTarget) {
        const consChart = new Chart(consumptionTarget, {
          type: 'bar',
          data: {
            labels,
            datasets: [
              {
                label: 'Consommation',
                data: block.consumption || block.consommation || [],
                backgroundColor: `${block.color || '#0b3d7a'}99`,
                borderColor: block.color || '#0b3d7a',
                borderWidth: 1,
                borderRadius: 4,
              },
            ],
          },
          options: baseOptions('L', true),
        })
        charts.push(consChart)
      }
    })

    return () => charts.forEach((chart) => chart.destroy())
  }, [chartPalette, groupsData])

  const siteHours = groupsData?.site_hours || {}
  const siteConsumption = groupsData?.site_consumption || {}
  const selectedSite = groupsData?.sites?.find((site) => String(site.id) === String(siteId)) ?? groupsData?.sites?.[0]

  const applyFilters = async (event) => {
    event.preventDefault()
    const params = new URLSearchParams()
    if (rapportDebut) params.set('rapport_debut', rapportDebut)
    if (rapportFin) params.set('rapport_fin', rapportFin)
    if (siteId) params.set('site_id', siteId)
    await loadGroupsData(params.toString())
  }

  return (
    <div className="app-shell dashboard-shell">
      <Topbar activeView="groups" onNavigate={onNavigate} />

      <main className="groups-grid">
        {groupsData && (
          <>
            <form className="groups-filter-bar" onSubmit={applyFilters}>
              <div className="filter-field">
                <label htmlFor="rapport_debut">Rapport début</label>
                <select id="rapport_debut" value={rapportDebut} onChange={(event) => setRapportDebut(event.target.value)}>
                  {(groupsData.rapport_choices || []).map((choice) => (
                    <option key={choice.id} value={choice.id}>{choice.label}</option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label htmlFor="rapport_fin">Rapport fin</label>
                <select id="rapport_fin" value={rapportFin} onChange={(event) => setRapportFin(event.target.value)}>
                  {(groupsData.rapport_choices || []).map((choice) => (
                    <option key={choice.id} value={choice.id}>{choice.label}</option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label htmlFor="site_id">Site</label>
                <select id="site_id" value={siteId} onChange={(event) => setSiteId(event.target.value)}>
                  {(groupsData.sites || []).map((site) => (
                    <option key={site.id} value={site.id}>{site.nom_site}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="filter-submit">Appliquer</button>
            </form>

            <section className="metric-section">
              <div className="section-title-wrap">
                <span className="metric-label">Métriques globales</span>
                <h2>{selectedSite?.nom_site || 'Site'}</h2>
              </div>
              <div className="summary-strip">
                <div className="summary-chip">
                  <span>Écarts horaires — Total période</span>
                  <strong>{siteHours.total?.toFixed(1) ?? '—'} h</strong>
                  <small>{siteHours.has_previous_period ? `${siteHours.variation_pct?.toFixed(1) ?? '—'} %` : '— pas de période précédente'}</small>
                </div>
                <div className="summary-chip">
                  <span>Écarts horaires — Moyenne / période</span>
                  <strong>{siteHours.mean?.toFixed(1) ?? '—'} h</strong>
                  <small>Moy. par rapport dans la fenêtre</small>
                </div>
                <div className="summary-chip">
                  <span>Consommation — Total période</span>
                  <strong>{siteConsumption.total?.toFixed(1) ?? '—'} L</strong>
                  <small>{siteConsumption.has_previous_period ? `${siteConsumption.variation_pct?.toFixed(1) ?? '—'} %` : '— pas de période précédente'}</small>
                </div>
                <div className="summary-chip">
                  <span>Consommation — Moyenne / période</span>
                  <strong>{siteConsumption.mean?.toFixed(1) ?? '—'} L</strong>
                  <small>Moy. par rapport dans la fenêtre</small>
                </div>
              </div>
            </section>

            <section className="metric-section">
              <div className="section-title-wrap">
                <span className="metric-label">Moyennes absolues</span>
                <h2>{selectedSite?.nom_site || 'Site'} (depuis le 1er rapport)</h2>
              </div>
              <div className="absolute-strip">
                <div className="summary-chip">
                  <span>Horaires moyens / période</span>
                  <strong>{siteHours.all_time_mean?.toFixed(1) ?? '—'} h</strong>
                </div>
                <div className="summary-chip">
                  <span>Consommation moyenne / période</span>
                  <strong>{siteConsumption.all_time_mean?.toFixed(1) ?? '—'} L</strong>
                </div>
              </div>
            </section>

            <section className="groups-list">
              {groupsData.group_blocks?.map((group) => (
                <article key={group.id} className="group-card" style={{ borderLeft: `4px solid ${group.color || '#0b3d7a'}` }}>
                  <div className="group-card-head">
                    <span className="metric-label">Groupe</span>
                    <h3>{group.label}</h3>
                    <p className="group-header-meta">{group.rate?.toFixed(1) ?? '—'} L/h — {group.marque || ''} {group.puissance || ''}</p>
                  </div>

                  <div className="group-metric-grid">
                    <div className="metric-stat-block">
                      <span className="curve-title">Variations horaires de fonctionnement</span>
                      <div className="group-stats">
                        <div>
                          <span>Total période</span>
                          <strong>{group.hours?.total?.toFixed(1) ?? '—'} h</strong>
                          <small>{group.hours?.has_previous_period ? `${group.hours.variation_pct?.toFixed(1) ?? '—'} %` : '— pas de période précédente'}</small>
                        </div>
                        <div>
                          <span>Moyenne</span>
                          <strong>{group.hours?.mean?.toFixed(1) ?? '—'} h</strong>
                        </div>
                        <div>
                          <span>Total période préc.</span>
                          <strong>{group.hours?.previous_total?.toFixed(1) ?? '—'} h</strong>
                        </div>
                        <div>
                          <span>Moy. absolue</span>
                          <strong>{group.hours?.all_time_mean?.toFixed(1) ?? '—'} h</strong>
                        </div>
                      </div>
                    </div>

                    <div className="metric-stat-block">
                      <span className="curve-title">Consommation carburant</span>
                      <div className="group-stats">
                        <div>
                          <span>Total période</span>
                          <strong>{group.consumption_stats?.total?.toFixed(1) ?? '—'} L</strong>
                          <small>{group.consumption_stats?.has_previous_period ? `${group.consumption_stats.variation_pct?.toFixed(1) ?? '—'} %` : '— pas de période précédente'}</small>
                        </div>
                        <div>
                          <span>Moyenne</span>
                          <strong>{group.consumption_stats?.mean?.toFixed(1) ?? '—'} L</strong>
                        </div>
                        <div>
                          <span>Total période préc.</span>
                          <strong>{group.consumption_stats?.previous_total?.toFixed(1) ?? '—'} L</strong>
                        </div>
                        <div>
                          <span>Moy. absolue</span>
                          <strong>{group.consumption_stats?.all_time_mean?.toFixed(1) ?? '—'} L</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="group-curve-grid">
                    <div className="chart-card">
                      <span className="curve-title">Courbe des heures de fonctionnement (écarts)</span>
                      <div className="chart-box small-box">
                        <canvas id={`chart-group-${group.id}-hours`} />
                      </div>
                    </div>
                    <div className="chart-card">
                      <span className="curve-title">Courbe consommation (L/période)</span>
                      <div className="chart-box small-box">
                        <canvas id={`chart-group-${group.id}-consumption`} />
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          </>
        )}
      </main>
    </div>
  )
}

function DashboardPage({ onNavigate }) {
  const chartPalette = useMemo(() => ({
    axis: '#123d6d',
    grid: 'rgba(11, 61, 122, 0.08)',
    text: '#23466d',
  }), [])
  const [dashboardData, setDashboardData] = useState(null)

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [metric1, metric2, metric3, metric4] = await Promise.all([
          fetch('/dashboard/etat_cuves').then((response) => response.json()),
          fetch('/dashboard/evolution_volumes').then((response) => response.json()),
          fetch('/dashboard/horaires_groupes').then((response) => response.json()),
          fetch('/dashboard/consommation').then((response) => response.json()),
        ])

        setDashboardData({
          metric1: {
            labels: metric1.cp_chart_labels,
            values: metric1.cp_chart_pcts,
          },
          metric2: {
            labels: metric2.labels,
            globalVolumes: metric2.global_volumes,
            siteSeries: metric2.sites_series,
          },
          metric3: {
            labels: metric3.labels,
            globalHours: metric3.global_hours,
            sitesData: metric3.sites_data,
          },
          metric4: {
            labels: metric4.labels,
            globalConsumption: metric4.global_consumption,
            siteSeries: metric4.sites_series,
          },
        })
      } catch (error) {
        console.warn('Backend React dashboard unavailable, using demo fallback data.', error)
        setDashboardData(fallbackDashboardData)
      }
    }

    loadDashboardData()
  }, [])

  useEffect(() => {
    if (!window.Chart || !dashboardData) {
      return undefined
    }

    const charts = []

    const createLineChart = (id, data, label, color, labelsForChart, fill = false) => {
      const ctx = document.getElementById(id)
      if (!ctx) return

      const chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labelsForChart,
          datasets: [
            {
              label,
              data,
              borderColor: color,
              backgroundColor: fill ? `${color}22` : 'transparent',
              borderWidth: 3,
              tension: 0.35,
              fill,
              pointRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: chartPalette.text }, grid: { color: chartPalette.grid } },
            y: { ticks: { color: chartPalette.text }, grid: { color: chartPalette.grid } },
          },
        },
      })

      charts.push(chart)
    }

    const createBarChart = (id, data, label, labelsForChart, color) => {
      const ctx = document.getElementById(id)
      if (!ctx) return

      const chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labelsForChart,
          datasets: [
            {
              label,
              data,
              backgroundColor: color,
              borderRadius: 8,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: chartPalette.text }, grid: { display: false } },
            y: { ticks: { color: chartPalette.text }, grid: { color: chartPalette.grid } },
          },
        },
      })

      charts.push(chart)
    }

    createBarChart('chart-metric-1', dashboardData.metric1.values, 'Niveau des cuves (%)', dashboardData.metric1.labels, '#0b3d7a')
    createLineChart('chart-metric-2', dashboardData.metric2.globalVolumes, 'Volume total global', '#0b3d7a', dashboardData.metric2.labels, true)
    createLineChart('chart-metric-3', dashboardData.metric3.globalHours, 'Écart horaire global', '#3b82f6', dashboardData.metric3.labels, true)
    createLineChart('chart-metric-4', dashboardData.metric4.globalConsumption, 'Consommation globale', '#60a5fa', dashboardData.metric4.labels, true)

    const siteVolumeCtx = document.getElementById('chart-metric-2-sites')
    if (siteVolumeCtx) {
      const siteChart = new Chart(siteVolumeCtx, {
        type: 'line',
        data: {
          labels: dashboardData.metric2.labels,
          datasets: dashboardData.metric2.siteSeries.map((site) => ({
            label: site.label,
            data: site.data,
            borderColor: site.borderColor || site.color,
            backgroundColor: site.backgroundColor || `${site.borderColor || site.color}22`,
            borderWidth: 2,
            tension: 0.35,
            fill: false,
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top' } },
          scales: {
            x: { ticks: { color: chartPalette.text }, grid: { color: chartPalette.grid } },
            y: { ticks: { color: chartPalette.text }, grid: { color: chartPalette.grid } },
          },
        },
      })
      charts.push(siteChart)
    }

    const siteHoursCtx = document.getElementById('chart-metric-3-sites')
    if (siteHoursCtx) {
      const siteHoursDatasets = Object.values(dashboardData.metric3.sitesData || {}).flatMap((site) =>
        (site.datasets || []).map((dataset) => ({
          label: dataset.label,
          data: dataset.data,
          borderColor: dataset.borderColor,
          backgroundColor: dataset.backgroundColor,
          borderWidth: 2,
          tension: 0.35,
          fill: false,
        })),
      )

      const siteHoursChart = new Chart(siteHoursCtx, {
        type: 'line',
        data: {
          labels: dashboardData.metric3.labels,
          datasets: siteHoursDatasets,
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top' } },
          scales: {
            x: { ticks: { color: chartPalette.text }, grid: { color: chartPalette.grid } },
            y: { ticks: { color: chartPalette.text }, grid: { color: chartPalette.grid } },
          },
        },
      })
      charts.push(siteHoursChart)
    }

    const siteConsumptionCtx = document.getElementById('chart-metric-4-sites')
    if (siteConsumptionCtx) {
      const siteConsumptionChart = new Chart(siteConsumptionCtx, {
        type: 'line',
        data: {
          labels: dashboardData.metric4.labels,
          datasets: dashboardData.metric4.siteSeries.map((site) => ({
            label: site.label,
            data: site.data,
            borderColor: site.borderColor || site.color,
            backgroundColor: site.backgroundColor || `${site.borderColor || site.color}22`,
            borderWidth: 2,
            tension: 0.35,
            fill: false,
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top' } },
          scales: {
            x: { ticks: { color: chartPalette.text }, grid: { color: chartPalette.grid } },
            y: { ticks: { color: chartPalette.text }, grid: { color: chartPalette.grid } },
          },
        },
      })
      charts.push(siteConsumptionChart)
    }

    return () => {
      charts.forEach((chart) => chart.destroy())
    }
  }, [chartPalette, dashboardData])

  return (
    <div className="app-shell dashboard-shell">
      <Topbar activeView="dashboard" onNavigate={onNavigate} />

      <main className="dashboard-grid">
        <section className="dashboard-cards">
          <MetricPanel label="Métrique 1" title="Cuves principales">
            <div className="chart-box fixed-box">
              <canvas id="chart-metric-1" />
            </div>
          </MetricPanel>

          <MetricPanel label="Métrique 2" title="Volumes cumulés">
            <div className="chart-box fixed-box">
              <canvas id="chart-metric-2" />
            </div>
            <div className="chart-box secondary-box">
              <canvas id="chart-metric-2-sites" />
            </div>
          </MetricPanel>

          <MetricPanel label="Métrique 3" title="Horaires / écarts">
            <div className="chart-box fixed-box">
              <canvas id="chart-metric-3" />
            </div>
            <div className="chart-box secondary-box">
              <canvas id="chart-metric-3-sites" />
            </div>
          </MetricPanel>

          <MetricPanel label="Métrique 4" title="Consommation">
            <div className="chart-box fixed-box">
              <canvas id="chart-metric-4" />
            </div>
            <div className="chart-box secondary-box">
              <canvas id="chart-metric-4-sites" />
            </div>
          </MetricPanel>
        </section>
      </main>
    </div>
  )
}

function App() {
  const [view, setView] = useState('presentation')

  const navigate = (nextView) => {
    const pathMap = {
      presentation: '/',
      dashboard: '/dashboard/',
      groups: '/groupes/',
    }

    const nextPath = pathMap[nextView] || '/'
    window.history.pushState({}, '', nextPath)
    setView(nextView)
  }

  useEffect(() => {
    const syncViewFromLocation = () => {
      const pathname = window.location.pathname
      if (pathname.startsWith('/groupes')) {
        setView('groups')
        return
      }

      if (pathname.startsWith('/dashboard')) {
        setView('dashboard')
        return
      }

      setView('presentation')
    }

    syncViewFromLocation()
    window.addEventListener('popstate', syncViewFromLocation)

    return () => {
      window.removeEventListener('popstate', syncViewFromLocation)
    }
  }, [])

  return (
    <>
      {view === 'presentation' && <PresentationPage onNavigate={navigate} />}
      {view === 'dashboard' && <DashboardPage onNavigate={navigate} />}
      {view === 'groups' && <GroupsPage onNavigate={navigate} />}
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
