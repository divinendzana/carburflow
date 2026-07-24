import React, { useEffect, useMemo, useState } from 'react'
import Topbar from '../components/Topbar.jsx'

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

function CuvesPage({ onNavigate }) {
  const chartPalette = useMemo(() => ({ text: '#23466d', grid: 'rgba(11, 61, 122, 0.08)' }), [])
  const [cuvesData, setCuvesData] = useState(null)
  const [rapportDebut, setRapportDebut] = useState('')
  const [rapportFin, setRapportFin] = useState('')
  const [siteId, setSiteId] = useState(null)

  const reportChoices = useMemo(() => (cuvesData?.rapport_choices || []), [cuvesData])

  const loadCuvesData = async (queryParams = '') => {
    try {
      const response = await fetch(`/api/v1/dashboard/cuves${queryParams ? `?${queryParams}` : ''}`)
      const data = await response.json()
      setCuvesData(data)
      setRapportDebut(data.selected_rapport_debut ?? '')
      setRapportFin(data.selected_rapport_fin ?? '')
      setSiteId(data.selected_site_id != null ? String(data.selected_site_id) : '')
    } catch (error) {
      console.warn('Cuves backend unavailable, using demo fallback data.', error)
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
    const labels = (cuvesData.labels || []).slice(Math.min(Number(rapportDebut) || 0, Number(rapportFin) || 0), Math.max(Number(rapportDebut) || 0, Number(rapportFin) || 0) + 1)
    const baseOptions = (unit = 'L') => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: chartPalette.text }, grid: { color: chartPalette.grid } },
        y: { beginAtZero: true, ticks: { color: chartPalette.text, callback: (value) => `${value.toLocaleString('fr-FR')} ${unit}` }, grid: { color: chartPalette.grid } },
      },
    })

    const sliceSeries = (values = []) => values.slice(Math.min(Number(rapportDebut) || 0, Number(rapportFin) || 0), Math.max(Number(rapportDebut) || 0, Number(rapportFin) || 0) + 1)
    const makeChart = (id, block, unit = 'L') => {
      const target = document.getElementById(id)
      if (!target) return
      const chart = new Chart(target, {
        type: 'line',
        data: { labels, datasets: [{ label: block.label, data: sliceSeries(block.values || []), borderColor: block.color || '#0b3d7a', backgroundColor: `${block.color || '#0b3d7a'}20`, borderWidth: 2, tension: 0.35, fill: true, pointRadius: 4 }] },
        options: baseOptions(unit),
      })
      charts.push(chart)
    }

    ;(cuvesData.principal_blocks || []).forEach((block) => makeChart(`chart-cuve-principale-${block.id}`, block, 'L'))
    ;(cuvesData.journalier_blocks || []).forEach((block) => makeChart(`chart-cuve-journaliere-${block.id}`, block, 'L'))

    return () => charts.forEach((chart) => chart.destroy())
  }, [chartPalette, cuvesData, rapportDebut, rapportFin])

  if (!cuvesData) {
    return (
      <div className="app-shell dashboard-shell">
        <Topbar activeView="cuves" onNavigate={onNavigate} />
        <main className="groups-grid">
          <div className="loading-state">Chargement des données cuves...</div>
        </main>
      </div>
    )
  }

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
            <select id="cuves-site" value={siteId ?? ''} onChange={(event) => setSiteId(event.target.value)}>
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
                <div className="chart-box small-box"><canvas id={`chart-cuve-principale-${block.id}`} /></div>
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
                <div className="chart-box small-box"><canvas id={`chart-cuve-journaliere-${block.id}`} /></div>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  )
}

export default CuvesPage
