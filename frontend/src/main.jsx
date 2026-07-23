import React, { useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom/client'
import logo from '../../logo/logo_clair_navbar.jpeg'
import './styles.css'

const Chart = window.Chart

const fallbackDashboardData = {
  metric1: {
    labels: ['CP #1 (BUF Bepanda)', 'CP #2 (BUF Bonaberi)', 'CP #3 (BUF Yaounde)'],
    values: [62, 40, 55],
    quantities: [2400, 1800, 2100],
    dailySeries: {
      1: {
        labels: ['CJ #1', 'CJ #2', 'CJ #3'],
        quantities: [720, 880, 800],
        colors: ['#0b3d7a', '#3b82f6', '#60a5fa'],
      },
    },
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
        <button type="button" className={`nav-link ${activeView === 'site' ? 'active' : ''}`} onClick={() => onNavigate('site')}>Sites</button>
        <button type="button" className={`nav-link ${activeView === 'cuves' ? 'active' : ''}`} onClick={() => onNavigate('cuves')}>Cuves</button>
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

  const safeValue = (value) => (typeof value === 'number' ? value : 0)

  const buildDerivedMetric = (values = []) => {
    const normalizedValues = (values || []).map((value) => safeValue(value))
    if (!normalizedValues.length) {
      return {
        total: 0,
        mean: 0,
        all_time_mean: 0,
        all_time_stddev: 0,
        variation_pct: null,
        mean_variation_pct: null,
        has_previous_period: false,
      }
    }

    const total = normalizedValues.reduce((sum, value) => sum + value, 0)
    const mean = total / normalizedValues.length
    const firstValue = normalizedValues[0]
    const lastValue = normalizedValues[normalizedValues.length - 1]
    const variationPct = firstValue === 0 ? null : ((lastValue - firstValue) / firstValue) * 100
    const meanVariationPct = firstValue === 0 ? null : ((mean - firstValue) / firstValue) * 100
    const variance = normalizedValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / normalizedValues.length
    const stddev = Math.sqrt(variance)

    return {
      total: Number(total.toFixed(1)),
      mean: Number(mean.toFixed(1)),
      all_time_mean: Number(mean.toFixed(1)),
      all_time_stddev: Number(stddev.toFixed(1)),
      variation_pct: variationPct === null ? null : Number(variationPct.toFixed(1)),
      mean_variation_pct: meanVariationPct === null ? null : Number(meanVariationPct.toFixed(1)),
      has_previous_period: normalizedValues.length > 1,
    }
  }

  const renderDelta = (metric, suffix = '') => {
    if (metric?.has_previous_period === false) {
      return <small className="delta-neutral">— pas de période précédente</small>
    }

    const deltaValue = typeof metric?.variation_pct === 'number' ? `${metric.variation_pct.toFixed(1)} %` : '—'
    const deltaClass = (metric?.variation_pct ?? 0) >= 0 ? 'delta-up' : 'delta-down'
    return <small className={deltaClass}>{deltaValue}{suffix}</small>
  }

  const renderMeanDelta = (metric, suffix = '') => {
    if (metric?.has_previous_period === false) {
      return <small className="delta-neutral">— pas de période précédente</small>
    }

    const deltaValue = typeof metric?.mean_variation_pct === 'number' ? `${metric.mean_variation_pct.toFixed(1)} %` : '—'
    const deltaClass = (metric?.mean_variation_pct ?? 0) >= 0 ? 'delta-up' : 'delta-down'
    return <small className={deltaClass}>{deltaValue}{suffix}</small>
  }

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
        site_hours: { total: 140.0, mean: 28.0, previous_total: 120.0, previous_mean: 24.0, variation_pct: 16.7, mean_variation_pct: 16.7, all_time_mean: 27.0, all_time_stddev: 5.2, has_previous_period: true },
        site_consumption: { total: 560.0, mean: 112.0, previous_total: 500.0, previous_mean: 100.0, variation_pct: 12.0, mean_variation_pct: 12.0, all_time_mean: 105.0, all_time_stddev: 9.8, has_previous_period: true },
        labels: ['01/01 au 07/01', '08/01 au 14/01'],
        group_blocks: [
          {
            id: 1,
            label: 'G#100 (Perkins 250kVA)',
            marque: 'Perkins',
            puissance: '250kVA',
            rate: 15.5,
            color: '#0d6efd',
            hours: { total: 29.5, mean: 7.4, previous_total: null, previous_mean: null, variation_pct: null, mean_variation_pct: null, all_time_mean: 14.8, all_time_stddev: 3.6, has_previous_period: false },
            consumption_stats: { total: 457.3, mean: 114.3, previous_total: null, previous_mean: null, variation_pct: null, mean_variation_pct: null, all_time_mean: 228.7, all_time_stddev: 43.2, has_previous_period: false },
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

      const hourlyConsumptionTarget = document.getElementById(`chart-group-${block.id}-hourly-consumption`)
      if (hourlyConsumptionTarget) {
        const hourlyValues = (block.hours_run || []).map((hours, index) => {
          const hoursValue = safeValue(hours)
          const consumptionValue = safeValue((block.consumption || block.consommation || [])[index])
          return hoursValue > 0 ? Number((consumptionValue / hoursValue).toFixed(2)) : 0
        })

        const hourlyChart = new Chart(hourlyConsumptionTarget, {
          type: 'line',
          data: {
            labels,
            datasets: [
              {
                label: 'Consommation horaire',
                data: hourlyValues,
                borderColor: block.color || '#0b3d7a',
                backgroundColor: `${block.color || '#0b3d7a'}20`,
                borderWidth: 2,
                tension: 0.35,
                fill: true,
                pointRadius: 4,
              },
            ],
          },
          options: baseOptions('L/h', false),
        })
        charts.push(hourlyChart)
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
                  <span>Variation horaire sur la période</span>
                  <strong>{siteHours.total?.toFixed(1) ?? '—'} h</strong>
                  {renderDelta(siteHours)}
                </div>
                <div className="summary-chip">
                  <span>Variation horaire moyenne sur la période</span>
                  <strong>{siteHours.mean?.toFixed(1) ?? '—'} h</strong>
                  {renderMeanDelta(siteHours)}
                </div>
                <div className="summary-chip">
                  <span>Variation consommation sur la période</span>
                  <strong>{siteConsumption.total?.toFixed(1) ?? '—'} L</strong>
                  {renderDelta(siteConsumption)}
                </div>
                <div className="summary-chip">
                  <span>Variation consommation moyenne sur la période</span>
                  <strong>{siteConsumption.mean?.toFixed(1) ?? '—'} L</strong>
                  {renderMeanDelta(siteConsumption)}
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
                      <span className="curve-title">Variations horaires</span>
                      <div className="group-stats">
                        <div>
                          <span>Total période</span>
                          <strong>{group.hours?.total?.toFixed(1) ?? '—'} h</strong>
                          {renderDelta(group.hours)}
                        </div>
                        <div>
                          <span>Moyenne</span>
                          <strong>{group.hours?.mean?.toFixed(1) ?? '—'} h</strong>
                          {renderMeanDelta(group.hours)}
                        </div>
                        <div>
                          <span>Moy. absolue</span>
                          <strong>{group.hours?.all_time_mean?.toFixed(1) ?? '—'} h</strong>
                        </div>
                        <div>
                          <span>Écart type</span>
                          <strong>{group.hours?.all_time_stddev?.toFixed(1) ?? '—'} h</strong>
                        </div>
                      </div>
                    </div>

                    <div className="metric-stat-block">
                      <span className="curve-title">Consommation</span>
                      <div className="group-stats">
                        <div>
                          <span>Total période</span>
                          <strong>{group.consumption_stats?.total?.toFixed(1) ?? '—'} L</strong>
                          {renderDelta(group.consumption_stats)}
                        </div>
                        <div>
                          <span>Moyenne</span>
                          <strong>{group.consumption_stats?.mean?.toFixed(1) ?? '—'} L</strong>
                          {renderMeanDelta(group.consumption_stats)}
                        </div>
                        <div>
                          <span>Moy. absolue</span>
                          <strong>{group.consumption_stats?.all_time_mean?.toFixed(1) ?? '—'} L</strong>
                        </div>
                        <div>
                          <span>Écart type</span>
                          <strong>{group.consumption_stats?.all_time_stddev?.toFixed(1) ?? '—'} L</strong>
                        </div>
                      </div>
                    </div>

                    <div className="metric-stat-block">
                      <span className="curve-title">Consommation horaire</span>
                      <div className="group-stats">
                        <div>
                          <span>Total période</span>
                          <strong>{(() => {
                            const hourlyMetric = buildDerivedMetric((group.hours_run || []).map((hours, index) => {
                              const hoursValue = safeValue(hours)
                              const consumptionValue = safeValue((group.consumption || group.consommation || [])[index])
                              return hoursValue > 0 ? consumptionValue / hoursValue : 0
                            }))
                            return `${hourlyMetric.total.toFixed(1)} L/h`
                          })()}</strong>
                          {renderDelta(buildDerivedMetric((group.hours_run || []).map((hours, index) => {
                            const hoursValue = safeValue(hours)
                            const consumptionValue = safeValue((group.consumption || group.consommation || [])[index])
                            return hoursValue > 0 ? consumptionValue / hoursValue : 0
                          })))}
                        </div>
                        <div>
                          <span>Moyenne</span>
                          <strong>{(() => {
                            const hourlyMetric = buildDerivedMetric((group.hours_run || []).map((hours, index) => {
                              const hoursValue = safeValue(hours)
                              const consumptionValue = safeValue((group.consumption || group.consommation || [])[index])
                              return hoursValue > 0 ? consumptionValue / hoursValue : 0
                            }))
                            return `${hourlyMetric.mean.toFixed(1)} L/h`
                          })()}</strong>
                          {renderMeanDelta(buildDerivedMetric((group.hours_run || []).map((hours, index) => {
                            const hoursValue = safeValue(hours)
                            const consumptionValue = safeValue((group.consumption || group.consommation || [])[index])
                            return hoursValue > 0 ? consumptionValue / hoursValue : 0
                          })))}
                        </div>
                        <div>
                          <span>Moy. absolue</span>
                          <strong>{(() => {
                            const hourlyMetric = buildDerivedMetric((group.hours_run || []).map((hours, index) => {
                              const hoursValue = safeValue(hours)
                              const consumptionValue = safeValue((group.consumption || group.consommation || [])[index])
                              return hoursValue > 0 ? consumptionValue / hoursValue : 0
                            }))
                            return `${hourlyMetric.all_time_mean.toFixed(1)} L/h`
                          })()}</strong>
                        </div>
                        <div>
                          <span>Écart type</span>
                          <strong>{(() => {
                            const hourlyMetric = buildDerivedMetric((group.hours_run || []).map((hours, index) => {
                              const hoursValue = safeValue(hours)
                              const consumptionValue = safeValue((group.consumption || group.consommation || [])[index])
                              return hoursValue > 0 ? consumptionValue / hoursValue : 0
                            }))
                            return `${hourlyMetric.all_time_stddev.toFixed(1)} L/h`
                          })()}</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="group-curve-grid">
                    <div className="chart-card">
                      <span className="curve-title">Courbe heures de fonctionnement</span>
                      <div className="chart-box small-box">
                        <canvas id={`chart-group-${group.id}-hours`} />
                      </div>
                    </div>
                    <div className="chart-card">
                      <span className="curve-title">Courbe consommation</span>
                      <div className="chart-box small-box">
                        <canvas id={`chart-group-${group.id}-consumption`} />
                      </div>
                    </div>
                    <div className="chart-card">
                      <span className="curve-title">Courbe consommation horaire</span>
                      <div className="chart-box small-box">
                        <canvas id={`chart-group-${group.id}-hourly-consumption`} />
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

function CuvesPage({ onNavigate }) {
  const chartPalette = useMemo(() => ({
    text: '#23466d',
    grid: 'rgba(11, 61, 122, 0.08)',
  }), [])
  const [cuvesData, setCuvesData] = useState(null)
  const [rapportDebut, setRapportDebut] = useState('')
  const [rapportFin, setRapportFin] = useState('')
  const [siteId, setSiteId] = useState('')

  const renderDelta = (metric, suffix = '') => {
    if (metric?.has_previous_period === false) {
      return <small className="delta-neutral">— pas de période précédente</small>
    }

    const deltaValue = typeof metric?.variation_pct === 'number' ? `${metric.variation_pct.toFixed(1)} %` : '—'
    const deltaClass = (metric?.variation_pct ?? 0) >= 0 ? 'delta-up' : 'delta-down'
    return <small className={deltaClass}>{deltaValue}{suffix}</small>
  }

  const renderMeanDelta = (metric, suffix = '') => {
    if (metric?.has_previous_period === false) {
      return <small className="delta-neutral">— pas de période précédente</small>
    }

    const deltaValue = typeof metric?.mean_variation_pct === 'number' ? `${metric.mean_variation_pct.toFixed(1)} %` : '—'
    const deltaClass = (metric?.mean_variation_pct ?? 0) >= 0 ? 'delta-up' : 'delta-down'
    return <small className={deltaClass}>{deltaValue}{suffix}</small>
  }

  const loadCuvesData = async (queryParams = '') => {
    try {
      const response = await fetch(`/dashboard/cuves${queryParams ? `?${queryParams}` : ''}`)
      const data = await response.json()
      setCuvesData(data)
      setRapportDebut(data.selected_rapport_debut ?? '')
      setRapportFin(data.selected_rapport_fin ?? '')
      setSiteId(data.selected_site_id ?? '')
    } catch (error) {
      console.warn('Cuves backend unavailable, using demo fallback data.', error)
      setCuvesData({
        period_label: 'Période de démonstration',
        selected_site_id: 1,
        rapport_choices: [{ id: 1, label: '01/01 au 07/01' }, { id: 2, label: '08/01 au 14/01' }],
        sites: [{ id: 1, nom_site: 'BUF Bepanda' }],
        site_principal_stats: { total: 18000, mean: 9000, previous_total: 16000, previous_mean: 8000, variation_pct: 12.5, mean_variation_pct: 12.5, all_time_mean: 8500, all_time_stddev: 1200, has_previous_period: true },
        site_journalier_stats: { total: 9200, mean: 4600, previous_total: 8400, previous_mean: 4200, variation_pct: 9.5, mean_variation_pct: 9.5, all_time_mean: 4300, all_time_stddev: 650, has_previous_period: true },
        labels: ['01/01 au 07/01', '08/01 au 14/01'],
        principal_blocks: [
          { id: 1, label: 'CP #1 (BUF Bepanda)', capacity: 500000, color: '#0d6efd', stats: { total: 9600, mean: 4800, previous_total: 8500, previous_mean: 4250, variation_pct: 12.9, mean_variation_pct: 12.9, all_time_mean: 4500, all_time_stddev: 700, has_previous_period: true } },
          { id: 2, label: 'CP #2 (BUF Bepanda)', capacity: 450000, color: '#198754', stats: { total: 8400, mean: 4200, previous_total: 7500, previous_mean: 3750, variation_pct: 12.0, mean_variation_pct: 12.0, all_time_mean: 3900, all_time_stddev: 500, has_previous_period: true } },
        ],
        journalier_blocks: [
          { id: 1, label: 'CJ #1 (BUF Bepanda)', capacity: 150000, color: '#ffc107', stats: { total: 5000, mean: 2500, previous_total: 4700, previous_mean: 2350, variation_pct: 6.4, mean_variation_pct: 6.4, all_time_mean: 2400, all_time_stddev: 320, has_previous_period: true } },
          { id: 2, label: 'CJ #2 (BUF Bepanda)', capacity: 140000, color: '#dc3545', stats: { total: 4200, mean: 2100, previous_total: 3700, previous_mean: 1850, variation_pct: 13.5, mean_variation_pct: 13.5, all_time_mean: 2000, all_time_stddev: 280, has_previous_period: true } },
        ],
      })
    }
  }

  useEffect(() => {
    loadCuvesData()
  }, [])

  useEffect(() => {
    if (!window.Chart || !cuvesData) {
      return undefined
    }

    const charts = []
    const labels = cuvesData.labels || []

    const baseOptions = (unit = 'L') => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: chartPalette.text }, grid: { color: chartPalette.grid } },
        y: {
          beginAtZero: true,
          ticks: {
            color: chartPalette.text,
            callback: (value) => `${value.toLocaleString('fr-FR')} ${unit}`,
          },
          grid: { color: chartPalette.grid },
        },
      },
    })

    ;(cuvesData.principal_blocks || []).forEach((block) => {
      const target = document.getElementById(`chart-cuve-principale-${block.id}`)
      if (target) {
        const chart = new Chart(target, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: block.label,
              data: block.values || [],
              borderColor: block.color || '#0b3d7a',
              backgroundColor: `${block.color || '#0b3d7a'}20`,
              borderWidth: 2,
              tension: 0.35,
              fill: true,
              pointRadius: 4,
            }],
          },
          options: baseOptions('L'),
        })
        charts.push(chart)
      }
    })

    ;(cuvesData.journalier_blocks || []).forEach((block) => {
      const target = document.getElementById(`chart-cuve-journaliere-${block.id}`)
      if (target) {
        const chart = new Chart(target, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: block.label,
              data: block.values || [],
              borderColor: block.color || '#0b3d7a',
              backgroundColor: `${block.color || '#0b3d7a'}20`,
              borderWidth: 2,
              tension: 0.35,
              fill: true,
              pointRadius: 4,
            }],
          },
          options: baseOptions('L'),
        })
        charts.push(chart)
      }
    })

    return () => charts.forEach((chart) => chart.destroy())
  }, [chartPalette, cuvesData])

  const selectedSite = cuvesData?.sites?.find((site) => String(site.id) === String(siteId)) ?? cuvesData?.sites?.[0]

  const applyFilters = async (event) => {
    event.preventDefault()
    const params = new URLSearchParams()
    if (rapportDebut) params.set('rapport_debut', rapportDebut)
    if (rapportFin) params.set('rapport_fin', rapportFin)
    if (siteId) params.set('site_id', siteId)
    await loadCuvesData(params.toString())
  }

  return (
    <div className="app-shell dashboard-shell">
      <Topbar activeView="cuves" onNavigate={onNavigate} />

      <main className="groups-grid">
        {cuvesData && (
          <>
            <form className="groups-filter-bar" onSubmit={applyFilters}>
              <div className="filter-field">
                <label htmlFor="cuves-debut">Rapport début</label>
                <select id="cuves-debut" value={rapportDebut} onChange={(event) => setRapportDebut(event.target.value)}>
                  {(cuvesData.rapport_choices || []).map((choice) => (
                    <option key={choice.id} value={choice.id}>{choice.label}</option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label htmlFor="cuves-fin">Rapport fin</label>
                <select id="cuves-fin" value={rapportFin} onChange={(event) => setRapportFin(event.target.value)}>
                  {(cuvesData.rapport_choices || []).map((choice) => (
                    <option key={choice.id} value={choice.id}>{choice.label}</option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label htmlFor="cuves-site">Site</label>
                <select id="cuves-site" value={siteId} onChange={(event) => setSiteId(event.target.value)}>
                  {(cuvesData.sites || []).map((site) => (
                    <option key={site.id} value={site.id}>{site.nom_site}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="filter-submit">Appliquer</button>
            </form>

            <section className="metric-section">
              <div className="section-title-wrap">
                <span className="metric-label">Sous-rubrique 1</span>
                <h2>Cuves principales</h2>
                <p className="group-header-meta">Volume total, moyenne, moyenne absolue et écart type absolu par site et par cuve principale.</p>
              </div>
              <div className="summary-strip">
                <div className="summary-chip">
                  <span>Total période</span>
                  <strong>{cuvesData.site_principal_stats?.total?.toFixed(1) ?? '—'} L</strong>
                  {renderDelta(cuvesData.site_principal_stats)}
                </div>
                <div className="summary-chip">
                  <span>Moyenne</span>
                  <strong>{cuvesData.site_principal_stats?.mean?.toFixed(1) ?? '—'} L</strong>
                  {renderMeanDelta(cuvesData.site_principal_stats)}
                </div>
                <div className="summary-chip">
                  <span>Moy. absolue</span>
                  <strong>{cuvesData.site_principal_stats?.all_time_mean?.toFixed(1) ?? '—'} L</strong>
                </div>
                <div className="summary-chip">
                  <span>Écart type absolu</span>
                  <strong>{cuvesData.site_principal_stats?.all_time_stddev?.toFixed(1) ?? '—'} L</strong>
                </div>
              </div>
            </section>

            <section className="groups-list">
              {(cuvesData.principal_blocks || []).map((block) => (
                <article key={block.id} className="group-card" style={{ borderLeft: `4px solid ${block.color || '#0b3d7a'}` }}>
                  <div className="group-card-head">
                    <span className="metric-label">Cuve principale</span>
                    <h3>{block.label}</h3>
                    <p className="group-header-meta">Capacité : {block.capacity?.toFixed(1) ?? '—'} L</p>
                  </div>

                  <div className="cuve-metric-layout">
                    <div className="metric-stat-block wide-metric-block">
                      <span className="curve-title">Volume carburant</span>
                      <div className="group-stats wide-stats-grid">
                        <div>
                          <span>Total période</span>
                          <strong>{block.stats?.total?.toFixed(1) ?? '—'} L</strong>
                          {renderDelta(block.stats)}
                        </div>
                        <div>
                          <span>Moyenne</span>
                          <strong>{block.stats?.mean?.toFixed(1) ?? '—'} L</strong>
                          {renderMeanDelta(block.stats)}
                        </div>
                        <div>
                          <span>Moy. absolue</span>
                          <strong>{block.stats?.all_time_mean?.toFixed(1) ?? '—'} L</strong>
                        </div>
                        <div>
                          <span>Écart type absolu</span>
                          <strong>{block.stats?.all_time_stddev?.toFixed(1) ?? '—'} L</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="chart-card">
                    <span className="curve-title">Courbe du volume de la cuve</span>
                    <div className="chart-box small-box">
                      <canvas id={`chart-cuve-principale-${block.id}`} />
                    </div>
                  </div>
                </article>
              ))}
            </section>

            <section className="metric-section">
              <div className="section-title-wrap">
                <span className="metric-label">Sous-rubrique 2</span>
                <h2>Cuves journalières</h2>
                <p className="group-header-meta">Même logique analytique sur les cuves journalières associées au site sélectionné.</p>
              </div>
              <div className="summary-strip">
                <div className="summary-chip">
                  <span>Total période</span>
                  <strong>{cuvesData.site_journalier_stats?.total?.toFixed(1) ?? '—'} L</strong>
                  {renderDelta(cuvesData.site_journalier_stats)}
                </div>
                <div className="summary-chip">
                  <span>Moyenne</span>
                  <strong>{cuvesData.site_journalier_stats?.mean?.toFixed(1) ?? '—'} L</strong>
                  {renderMeanDelta(cuvesData.site_journalier_stats)}
                </div>
                <div className="summary-chip">
                  <span>Moy. absolue</span>
                  <strong>{cuvesData.site_journalier_stats?.all_time_mean?.toFixed(1) ?? '—'} L</strong>
                </div>
                <div className="summary-chip">
                  <span>Écart type absolu</span>
                  <strong>{cuvesData.site_journalier_stats?.all_time_stddev?.toFixed(1) ?? '—'} L</strong>
                </div>
              </div>
            </section>

            <section className="groups-list">
              {(cuvesData.journalier_blocks || []).map((block) => (
                <article key={block.id} className="group-card" style={{ borderLeft: `4px solid ${block.color || '#0b3d7a'}` }}>
                  <div className="group-card-head">
                    <span className="metric-label">Cuve journalière</span>
                    <h3>{block.label}</h3>
                    <p className="group-header-meta">Capacité : {block.capacity?.toFixed(1) ?? '—'} L</p>
                  </div>

                  <div className="cuve-metric-layout">
                    <div className="metric-stat-block wide-metric-block">
                      <span className="curve-title">Volume carburant</span>
                      <div className="group-stats wide-stats-grid">
                        <div>
                          <span>Total période</span>
                          <strong>{block.stats?.total?.toFixed(1) ?? '—'} L</strong>
                          {renderDelta(block.stats)}
                        </div>
                        <div>
                          <span>Moyenne</span>
                          <strong>{block.stats?.mean?.toFixed(1) ?? '—'} L</strong>
                          {renderMeanDelta(block.stats)}
                        </div>
                        <div>
                          <span>Moy. absolue</span>
                          <strong>{block.stats?.all_time_mean?.toFixed(1) ?? '—'} L</strong>
                        </div>
                        <div>
                          <span>Écart type absolu</span>
                          <strong>{block.stats?.all_time_stddev?.toFixed(1) ?? '—'} L</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="chart-card">
                    <span className="curve-title">Courbe du volume de la cuve</span>
                    <div className="chart-box small-box">
                      <canvas id={`chart-cuve-journaliere-${block.id}`} />
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

function SitePage({ onNavigate }) {
  const chartPalette = useMemo(() => ({
    axis: '#123d6d',
    grid: 'rgba(11, 61, 122, 0.08)',
    text: '#23466d',
  }), [])

  const [siteDashboard, setSiteDashboard] = useState(null)
  const [startIdx, setStartIdx] = useState(0)
  const [endIdx, setEndIdx] = useState(0)
  const [siteId, setSiteId] = useState('')

  const safeValue = (value) => (typeof value === 'number' ? value : 0)

  const windowStats = (values = [], start, end) => {
    const window = values.slice(start, end + 1)
    const total = window.reduce((sum, value) => sum + safeValue(value), 0)
    const mean = window.length ? total / window.length : 0

    const prevWindowLength = end - start + 1
    const prevStart = start - prevWindowLength
    const prevEnd = start - 1
    const prevWindow = prevStart >= 0 ? values.slice(prevStart, prevEnd + 1) : []
    const prevTotal = prevWindow.reduce((sum, value) => sum + safeValue(value), 0)
    const prevMean = prevWindow.length ? prevTotal / prevWindow.length : 0

    const allTimeMean = values.length ? values.reduce((sum, value) => sum + safeValue(value), 0) / values.length : 0
    const variance = values.length
      ? values.reduce((sum, value) => sum + (safeValue(value) - allTimeMean) ** 2, 0) / values.length
      : 0
    const allTimeStddev = Math.sqrt(variance)

    const variationPct = prevTotal === 0 ? null : ((total - prevTotal) / prevTotal) * 100
    const meanVariationPct = prevMean === 0 ? null : ((mean - prevMean) / prevMean) * 100

    return {
      total: Number(total.toFixed(1)),
      mean: Number(mean.toFixed(1)),
      previous_total: prevWindow.length ? Number(prevTotal.toFixed(1)) : null,
      previous_mean: prevWindow.length ? Number(prevMean.toFixed(1)) : null,
      variation_pct: variationPct === null ? null : Number(variationPct.toFixed(1)),
      mean_variation_pct: meanVariationPct === null ? null : Number(meanVariationPct.toFixed(1)),
      all_time_mean: Number(allTimeMean.toFixed(1)),
      all_time_stddev: Number(allTimeStddev.toFixed(1)),
      has_previous_period: prevWindow.length > 0,
    }
  }

  const loadSiteData = async () => {
    try {
      const [metric2, metric3, metric4] = await Promise.all([
        fetch('/dashboard/evolution_volumes').then((response) => response.json()),
        fetch('/dashboard/horaires_groupes').then((response) => response.json()),
        fetch('/dashboard/consommation').then((response) => response.json()),
      ])

      const siteSeries = metric2.sites_series || []
      const siteHoursSeries = Object.values(metric3.sites_data || {}).map((site) => ({
        id: site.id,
        nom_site: site.nom_site,
        datasets: site.datasets,
      }))
      const siteConsumptionSeries = metric4.sites_series || []

      setSiteDashboard({
        labels: metric2.labels,
        volumeSeries: siteSeries,
        hoursSeries: siteHoursSeries,
        consumptionSeries: siteConsumptionSeries,
      })
    } catch (error) {
      console.warn('Site backend unavailable, using demo fallback data.', error)
      setSiteDashboard({
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
      })
    }
  }

  useEffect(() => {
    loadSiteData()
  }, [])

  useEffect(() => {
    if (!siteDashboard) {
      return
    }

    const options = siteDashboard.volumeSeries?.[0]?.id ? siteDashboard.volumeSeries : siteDashboard.consumptionSeries
    const fallbackId = options?.[0]?.id ?? ''
    if (!siteId && fallbackId) {
      setSiteId(String(fallbackId))
    }

    if (startIdx === endIdx && siteDashboard.labels?.length) {
      setStartIdx(0)
      setEndIdx(siteDashboard.labels.length - 1)
    }
  }, [siteDashboard, siteId, startIdx, endIdx])

  const selectedSite = useMemo(() => {
    if (!siteDashboard) {
      return null
    }

    const candidates = [
      ...(siteDashboard.volumeSeries || []),
      ...(siteDashboard.consumptionSeries || []),
      ...(siteDashboard.hoursSeries || []),
    ]

    return candidates.find((entry) => String(entry.id) === String(siteId)) || candidates[0] || null
  }, [siteDashboard, siteId])

  const siteVolumeData = useMemo(() => {
    if (!selectedSite || !siteDashboard?.volumeSeries?.length) {
      return []
    }

    const candidate = siteDashboard.volumeSeries.find((entry) => String(entry.id) === String(selectedSite.id))
    return candidate?.data || []
  }, [selectedSite, siteDashboard])

  const siteConsumptionData = useMemo(() => {
    if (!selectedSite || !siteDashboard?.consumptionSeries?.length) {
      return []
    }

    const candidate = siteDashboard.consumptionSeries.find((entry) => String(entry.id) === String(selectedSite.id))
    return candidate?.data || []
  }, [selectedSite, siteDashboard])

  const siteHoursData = useMemo(() => {
    if (!selectedSite || !siteDashboard?.hoursSeries?.length) {
      return []
    }

    const candidate = siteDashboard.hoursSeries.find((entry) => String(entry.id) === String(selectedSite.id))
    const datasets = candidate?.datasets || []
    return datasets.flatMap((dataset) => dataset.data || [])
  }, [selectedSite, siteDashboard])

  const siteVolumeStats = windowStats(siteVolumeData, startIdx, endIdx)
  const siteConsumptionStats = windowStats(siteConsumptionData, startIdx, endIdx)
  const siteHoursStats = windowStats(siteHoursData, startIdx, endIdx)

  const siteOptions = useMemo(() => {
    if (!siteDashboard) {
      return []
    }

    const volumeSites = (siteDashboard.volumeSeries || []).map((site) => ({ id: site.id, nom_site: site.nom_site }))
    const consumptionSites = (siteDashboard.consumptionSeries || []).map((site) => ({ id: site.id, nom_site: site.nom_site }))
    const hoursSites = (siteDashboard.hoursSeries || []).map((site) => ({ id: site.id, nom_site: site.nom_site }))

    const byId = new Map()
    ;[...volumeSites, ...consumptionSites, ...hoursSites].forEach((site) => byId.set(String(site.id), site))
    return [...byId.values()]
  }, [siteDashboard])

  useEffect(() => {
    if (!window.Chart || !siteDashboard || !selectedSite) {
      return undefined
    }

    const charts = []
    const labels = siteDashboard.labels || []
    const createLineChart = (id, data, label, color, fill = false) => {
      const ctx = document.getElementById(id)
      if (!ctx) return

      const chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
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

    createLineChart('chart-site-volume', siteVolumeData, 'Volume total', '#0b3d7a', true)
    createLineChart('chart-site-hours', siteHoursData, 'Variation horaire', '#3b82f6', true)
    createLineChart('chart-site-consumption', siteConsumptionData, 'Consommation', '#60a5fa', true)

    return () => charts.forEach((chart) => chart.destroy())
  }, [chartPalette, siteDashboard, selectedSite, siteVolumeData, siteHoursData, siteConsumptionData])

  const renderDelta = (metric, suffix = '') => {
    if (metric?.has_previous_period === false) {
      return <small className="delta-neutral">— pas de période précédente</small>
    }

    const deltaValue = typeof metric?.variation_pct === 'number' ? `${metric.variation_pct.toFixed(1)} %` : '—'
    const deltaClass = (metric?.variation_pct ?? 0) >= 0 ? 'delta-up' : 'delta-down'
    return <small className={deltaClass}>{deltaValue}{suffix}</small>
  }

  const renderMeanDelta = (metric, suffix = '') => {
    if (metric?.has_previous_period === false) {
      return <small className="delta-neutral">— pas de période précédente</small>
    }

    const deltaValue = typeof metric?.mean_variation_pct === 'number' ? `${metric.mean_variation_pct.toFixed(1)} %` : '—'
    const deltaClass = (metric?.mean_variation_pct ?? 0) >= 0 ? 'delta-up' : 'delta-down'
    return <small className={deltaClass}>{deltaValue}{suffix}</small>
  }

  const applyFilters = (event) => {
    event.preventDefault()
    if (!siteDashboard?.labels?.length) {
      return
    }

    const labels = siteDashboard.labels
    const normalizedStart = Number(startIdx)
    const normalizedEnd = Number(endIdx)
    if (normalizedStart > normalizedEnd) {
      setStartIdx(normalizedEnd)
      setEndIdx(normalizedStart)
    }
  }

  return (
    <div className="app-shell dashboard-shell">
      <Topbar activeView="site" onNavigate={onNavigate} />

      <main className="groups-grid">
        {siteDashboard && (
          <>
            <form className="groups-filter-bar" onSubmit={applyFilters}>
              <div className="filter-field">
                <label htmlFor="site-start">Rapport début</label>
                <select id="site-start" value={startIdx} onChange={(event) => setStartIdx(Number(event.target.value))}>
                  {siteDashboard.labels.map((label, index) => (
                    <option key={`${label}-${index}`} value={index}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label htmlFor="site-end">Rapport fin</label>
                <select id="site-end" value={endIdx} onChange={(event) => setEndIdx(Number(event.target.value))}>
                  {siteDashboard.labels.map((label, index) => (
                    <option key={`${label}-${index}`} value={index}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label htmlFor="site-select">Site</label>
                <select id="site-select" value={siteId} onChange={(event) => setSiteId(event.target.value)}>
                  {siteOptions.map((site) => (
                    <option key={site.id} value={site.id}>{site.nom_site}</option>
                  ))}
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
                  <span className="metric-label">Variation horaire</span>
                  <h3>Écart / période</h3>
                  <div className="site-metric-stack">
                    <div>
                      <span>Total période</span>
                      <strong>{siteHoursStats.total.toFixed(1)} h</strong>
                      {renderDelta(siteHoursStats)}
                    </div>
                    <div>
                      <span>Moyenne</span>
                      <strong>{siteHoursStats.mean.toFixed(1)} h</strong>
                      {renderMeanDelta(siteHoursStats)}
                    </div>
                    <div>
                      <span>Moy. absolue</span>
                      <strong>{siteHoursStats.all_time_mean.toFixed(1)} h</strong>
                    </div>
                    <div>
                      <span>Écart type absolu</span>
                      <strong>{siteHoursStats.all_time_stddev.toFixed(1)} h</strong>
                    </div>
                  </div>
                  <div className="chart-box secondary-box">
                    <canvas id="chart-site-hours" />
                  </div>
                </article>

                <article className="metric-panel site-metric-card">
                  <span className="metric-label">Consommation</span>
                  <h3>Carburant / période</h3>
                  <div className="site-metric-stack">
                    <div>
                      <span>Total période</span>
                      <strong>{siteConsumptionStats.total.toFixed(1)} L</strong>
                      {renderDelta(siteConsumptionStats)}
                    </div>
                    <div>
                      <span>Moyenne</span>
                      <strong>{siteConsumptionStats.mean.toFixed(1)} L</strong>
                      {renderMeanDelta(siteConsumptionStats)}
                    </div>
                    <div>
                      <span>Moy. absolue</span>
                      <strong>{siteConsumptionStats.all_time_mean.toFixed(1)} L</strong>
                    </div>
                    <div>
                      <span>Écart type absolu</span>
                      <strong>{siteConsumptionStats.all_time_stddev.toFixed(1)} L</strong>
                    </div>
                  </div>
                  <div className="chart-box secondary-box">
                    <canvas id="chart-site-consumption" />
                  </div>
                </article>

                <article className="metric-panel site-metric-card">
                  <span className="metric-label">Volume carburant</span>
                  <h3>Volume total / période</h3>
                  <div className="site-metric-stack">
                    <div>
                      <span>Total période</span>
                      <strong>{siteVolumeStats.total.toFixed(1)} L</strong>
                      {renderDelta(siteVolumeStats)}
                    </div>
                    <div>
                      <span>Moyenne</span>
                      <strong>{siteVolumeStats.mean.toFixed(1)} L</strong>
                      {renderMeanDelta(siteVolumeStats)}
                    </div>
                    <div>
                      <span>Moy. absolue</span>
                      <strong>{siteVolumeStats.all_time_mean.toFixed(1)} L</strong>
                    </div>
                    <div>
                      <span>Écart type absolu</span>
                      <strong>{siteVolumeStats.all_time_stddev.toFixed(1)} L</strong>
                    </div>
                  </div>
                  <div className="chart-box secondary-box">
                    <canvas id="chart-site-volume" />
                  </div>
                </article>
              </div>
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
  const [periodStart, setPeriodStart] = useState(0)
  const [periodEnd, setPeriodEnd] = useState(0)

  const sliceRange = (items = []) => {
    if (!items.length) return []
    const start = Math.min(periodStart, periodEnd)
    const end = Math.max(periodStart, periodEnd)
    return items.slice(start, end + 1)
  }

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
            quantities: metric1.cp_chart_quantities,
            dailySeries: metric1.sites_cj_chart_data,
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
    if (!dashboardData) return

    const lastIndex = Math.max((dashboardData.metric2.labels?.length || 1) - 1, 0)
    setPeriodStart(0)
    setPeriodEnd(lastIndex)
  }, [dashboardData])

  useEffect(() => {
    if (!window.Chart || !dashboardData) {
      return undefined
    }

    const charts = []
    const labels = sliceRange(dashboardData.metric2.labels)
    const globalVolumesRange = sliceRange(dashboardData.metric2.globalVolumes)
    const globalHoursRange = sliceRange(dashboardData.metric3.globalHours)
    const globalConsumptionRange = sliceRange(dashboardData.metric4.globalConsumption)

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

    const dailySeriesEntries = Object.entries(dashboardData.metric1.dailySeries || {})
    const dailySeries = dailySeriesEntries[0]?.[1]
    if (dailySeries) {
      const dailyCtx = document.getElementById('chart-metric-1-daily')
      if (dailyCtx) {
        const dailyChart = new Chart(dailyCtx, {
          type: 'bar',
          data: {
            labels: dailySeries.labels || [],
            datasets: [
              {
                label: 'Volume journalier (L)',
                data: dailySeries.quantities || [],
                backgroundColor: dailySeries.colors || ['#0b3d7a'],
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
        charts.push(dailyChart)
      }
    }

    createLineChart('chart-metric-2', globalVolumesRange, 'Volume total global', '#0b3d7a', labels, true)
    createLineChart('chart-metric-3', globalHoursRange, 'Écart horaire global', '#3b82f6', labels, true)
    createLineChart('chart-metric-4', globalConsumptionRange, 'Consommation globale', '#60a5fa', labels, true)

    const siteVolumeCtx = document.getElementById('chart-metric-2-sites')
    if (siteVolumeCtx) {
      const siteChart = new Chart(siteVolumeCtx, {
        type: 'line',
        data: {
          labels,
          datasets: dashboardData.metric2.siteSeries.map((site) => ({
            label: site.label,
            data: sliceRange(site.data),
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
          data: sliceRange(dataset.data),
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
          labels,
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
          labels,
          datasets: dashboardData.metric4.siteSeries.map((site) => ({
            label: site.label,
            data: sliceRange(site.data),
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
  }, [chartPalette, dashboardData, periodStart, periodEnd])

  return (
    <div className="app-shell dashboard-shell">
      <Topbar activeView="dashboard" onNavigate={onNavigate} />

      <main className="dashboard-grid">
        <section className="dashboard-cards">
          <MetricPanel label="Métrique 1" title="Cuves principales">
            <div className="metric-stack">
              <div className="chart-box fixed-box">
                <canvas id="chart-metric-1" />
              </div>
              <div className="chart-box fixed-box">
                <canvas id="chart-metric-1-daily" />
              </div>
            </div>
          </MetricPanel>

          {dashboardData && (
            <div className="period-bar">
              <div className="filter-field">
                <label htmlFor="dashboard-start">Rapport début</label>
                <select id="dashboard-start" value={periodStart} onChange={(event) => setPeriodStart(Number(event.target.value))}>
                  {dashboardData.metric2.labels.map((label, index) => (
                    <option key={`${label}-${index}`} value={index}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label htmlFor="dashboard-end">Rapport fin</label>
                <select id="dashboard-end" value={periodEnd} onChange={(event) => setPeriodEnd(Number(event.target.value))}>
                  {dashboardData.metric2.labels.map((label, index) => (
                    <option key={`${label}-${index}`} value={index}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <MetricPanel label="Métrique 2" title="Quantité de carburant dans les cuves">
            <div className="metric-split-grid">
              <div className="chart-box fixed-box">
                <canvas id="chart-metric-2" />
              </div>
              <div className="chart-box fixed-box">
                <canvas id="chart-metric-2-sites" />
              </div>
            </div>
          </MetricPanel>

          <MetricPanel label="Métrique 3" title="Variations horaires">
            <div className="metric-split-grid">
              <div className="chart-box fixed-box">
                <canvas id="chart-metric-3" />
              </div>
              <div className="chart-box fixed-box">
                <canvas id="chart-metric-3-sites" />
              </div>
            </div>
          </MetricPanel>

          <MetricPanel label="Métrique 4" title="Consommation">
            <div className="metric-split-grid">
              <div className="chart-box fixed-box">
                <canvas id="chart-metric-4" />
              </div>
              <div className="chart-box fixed-box">
                <canvas id="chart-metric-4-sites" />
              </div>
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
      site: '/site/',
      cuves: '/cuves/',
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

      if (pathname.startsWith('/site')) {
        setView('site')
        return
      }

      if (pathname.startsWith('/cuves')) {
        setView('cuves')
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
      {view === 'site' && <SitePage onNavigate={navigate} />}
      {view === 'cuves' && <CuvesPage onNavigate={navigate} />}
      {view === 'groups' && <GroupsPage onNavigate={navigate} />}
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
