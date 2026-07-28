import React, { useEffect, useMemo, useRef, useState } from 'react'
import Topbar from '../components/Topbar.jsx'
import WelcomeBanner from '../components/WelcomeBanner.jsx'
import { apiFetch } from '../auth.js'
import PageLoader from '../components/PageLoader.jsx'
import PageEnter from '../components/PageEnter.jsx'
import AnimatedContent from '../components/reactbits/AnimatedContent.jsx'
import { useChartPalette } from '../hooks/useChartPalette.js'
import { createChart, defaultPeriodIndices, MAX_CHART_WEEKS, seriesPointRadius, toChartLabels, visibleChartRange, xAxisTicks } from '../utils/chartAxis.js'
import { METRIC_LABELS } from '../utils/format.js'

const renderDelta = (metric, suffix = '') => {
  if (metric?.has_previous_period === false) {
    return <small className="delta-neutral">{METRIC_LABELS.noPreviousPeriod}</small>
  }

  const deltaValue = typeof metric?.variation_pct === 'number' ? `${metric.variation_pct.toFixed(1)} %` : '—'
  const deltaClass = (metric?.variation_pct ?? 0) >= 0 ? 'delta-up' : 'delta-down'
  return <small className={deltaClass}>{deltaValue}{suffix}</small>
}

const renderMeanDelta = (metric, suffix = '') => {
  if (metric?.has_previous_period === false) {
    return <small className="delta-neutral">{METRIC_LABELS.noPreviousPeriod}</small>
  }

  const deltaValue = typeof metric?.mean_variation_pct === 'number' ? `${metric.mean_variation_pct.toFixed(1)} %` : '—'
  const deltaClass = (metric?.mean_variation_pct ?? 0) >= 0 ? 'delta-up' : 'delta-down'
  return <small className={deltaClass}>{deltaValue}{suffix}</small>
}

function CuvesPage({ onNavigate }) {
  const chartPalette = useChartPalette()
  const [cuvesData, setCuvesData] = useState(null)
  const [rapportDebut, setRapportDebut] = useState('')
  const [rapportFin, setRapportFin] = useState('')
  const [siteId, setSiteId] = useState('')
  const [loadError, setLoadError] = useState('')
  const [filtering, setFiltering] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [chartPan, setChartPan] = useState(0)
  const filterSeq = useRef(0)

  const reportChoices = useMemo(() => (cuvesData?.rapport_choices || []), [cuvesData])
  const rapportDebutIndex = useMemo(() => {
    if (!reportChoices.length) return 0
    const selectedIndex = reportChoices.findIndex((choice) => String(choice.id) === String(rapportDebut))
    return selectedIndex >= 0 ? selectedIndex : 0
  }, [rapportDebut, reportChoices])
  const rapportFinIndex = useMemo(() => {
    if (!reportChoices.length) return 0
    const selectedIndex = reportChoices.findIndex((choice) => String(choice.id) === String(rapportFin))
    return selectedIndex >= 0 ? selectedIndex : reportChoices.length - 1
  }, [rapportFin, reportChoices])
  const startIndex = Math.min(rapportDebutIndex, rapportFinIndex)
  const endIndex = Math.max(rapportDebutIndex, rapportFinIndex)
  const chartWindow = useMemo(
    () => visibleChartRange(startIndex, endIndex, chartPan),
    [startIndex, endIndex, chartPan],
  )
  const { viewStart, viewEnd, maxPan, canScroll } = chartWindow

  useEffect(() => {
    setChartPan(Math.max(0, endIndex - startIndex + 1 - MAX_CHART_WEEKS))
  }, [startIndex, endIndex])

  const loadCuvesData = async (queryParams = '', { isFilter = false, preserveSiteSelection = false, preservePeriod = false } = {}) => {
    const seq = ++filterSeq.current
    try {
      setLoadError('')
      if (isFilter) setFiltering(true)
      const data = await apiFetch(`/api/v1/dashboard/cuves${queryParams ? `?${queryParams}` : ''}`)
      if (seq !== filterSeq.current) return
      setCuvesData(data)
      const choices = data.rapport_choices || []
      if (!preservePeriod) {
        if (queryParams && (queryParams.includes('rapport_debut') || queryParams.includes('rapport_fin'))) {
          const nextDebut = data.selected_rapport_debut != null
            ? String(data.selected_rapport_debut)
            : String(choices[0]?.id ?? '')
          const nextFin = data.selected_rapport_fin != null
            ? String(data.selected_rapport_fin)
            : String(choices[choices.length - 1]?.id ?? '')
          setRapportDebut(nextDebut)
          setRapportFin(nextFin)
        } else {
          const { first, last } = defaultPeriodIndices(choices.length)
          setRapportDebut(String(choices[first]?.id ?? ''))
          setRapportFin(String(choices[last]?.id ?? ''))
        }
      }
      if (!preserveSiteSelection) {
        const nextSite = data.selected_site_id != null ? String(data.selected_site_id) : ''
        setSiteId(nextSite)
      }
    } catch (error) {
      console.warn('Cuves backend unavailable.', error)
      if (seq === filterSeq.current) {
        setLoadError(error.message || 'Impossible de charger les cuves.')
        if (!isFilter) setCuvesData(null)
      }
    } finally {
      if (seq === filterSeq.current) {
        setFiltering(false)
        setInitialLoading(false)
      }
    }
  }

  useEffect(() => {
    // Premier chargement : toutes les cuves (pas de site_id)
    loadCuvesData()
  }, [])

  const runFilters = async (next = {}) => {
    const debut = next.rapportDebut ?? rapportDebut
    const fin = next.rapportFin ?? rapportFin
    const site = next.siteId !== undefined ? next.siteId : siteId
    if (next.rapportDebut != null) setRapportDebut(next.rapportDebut)
    if (next.rapportFin != null) setRapportFin(next.rapportFin)
    if (next.siteId !== undefined) setSiteId(next.siteId)
    const params = new URLSearchParams()
    if (debut) params.set('rapport_debut', debut)
    if (fin) params.set('rapport_fin', fin)
    if (site) params.set('site_id', site)
    await loadCuvesData(params.toString(), {
      isFilter: true,
      preserveSiteSelection: true,
      preservePeriod: true,
    })
  }

  useEffect(() => {
    if (!window.Chart || !cuvesData) {
      return undefined
    }

    const charts = []
    const fullLabels = cuvesData.labels || []
    const labels = toChartLabels(fullLabels.slice(viewStart, viewEnd + 1))
    const fullLabelsWindow = fullLabels.slice(viewStart, viewEnd + 1)
    const pointRadius = seriesPointRadius(labels.length)
    const baseOptions = (unit = 'L') => ({
      responsive: true,
      maintainAspectRatio: false,
      spanGaps: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const idx = items?.[0]?.dataIndex
              return fullLabelsWindow[idx] != null ? String(fullLabelsWindow[idx]) : ''
            },
          },
        },
      },
      scales: {
        x: {
          ticks: xAxisTicks(labels.length, chartPalette.text),
          grid: { color: chartPalette.grid },
        },
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

    const sliceSeries = (values = []) => values.slice(viewStart, viewEnd + 1)
    const makeChart = (id, block, unit = 'L') => {
      const target = document.getElementById(id)
      if (!target) return
      const chart = createChart(target, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: block.label,
            data: sliceSeries(block.values || []),
            borderColor: block.color || '#0b3d7a',
            backgroundColor: `${block.color || '#0b3d7a'}20`,
            borderWidth: 2,
            tension: 0.35,
            fill: true,
            pointRadius,
            spanGaps: true,
          }],
        },
        options: baseOptions(unit),
      })
      if (chart) charts.push(chart)
    }

    ;(cuvesData.principal_blocks || []).forEach((block) => makeChart(`chart-cuve-principale-${block.id}`, block, 'L'))
    ;(cuvesData.journalier_blocks || []).forEach((block) => makeChart(`chart-cuve-journaliere-${block.id}`, block, 'L'))

    const onWheel = (event) => {
      if (!canScroll) return
      event.preventDefault()
      const step = event.deltaY > 0 ? 1 : -1
      setChartPan((prev) => Math.min(maxPan, Math.max(0, prev + step)))
    }
    const chartBoxes = document.querySelectorAll('.chart-box')
    chartBoxes.forEach((box) => box.addEventListener('wheel', onWheel, { passive: false }))

    return () => {
      charts.forEach((chart) => chart.destroy())
      chartBoxes.forEach((box) => box.removeEventListener('wheel', onWheel))
    }
  }, [chartPalette, cuvesData, viewStart, viewEnd, canScroll, maxPan])

  if (initialLoading || !cuvesData) {
    return (
      <div className="app-shell dashboard-shell">
        <Topbar activeView="cuves" onNavigate={onNavigate} />
        {loadError ? (
          <div className="loading-state" style={{ marginTop: 24 }}>{loadError}</div>
        ) : (
          <PageLoader label="Chargement de toutes les cuves…" />
        )}
      </div>
    )
  }

  const principalCount = (cuvesData.principal_blocks || []).length
  const journalierCount = (cuvesData.journalier_blocks || []).length
  const scopeLabel = siteId
    ? (cuvesData.sites || []).find((s) => String(s.id) === String(siteId))?.nom_site || 'Site filtré'
    : 'Tous les sites'

  return (
    <div className="app-shell dashboard-shell">
      <Topbar activeView="cuves" onNavigate={onNavigate} />

      {filtering && (
        <div className="cf-filter-overlay" role="status" aria-live="polite">
          <PageLoader fullscreen={false} label="Application du filtre…" />
        </div>
      )}

      <PageEnter>
        <main className={`groups-grid ${filtering ? 'is-filtering' : ''}`}>
          <WelcomeBanner subtitle="Toutes les cuves d’abord — affinez avec les filtres si besoin." />

          <AnimatedContent distance={20} duration={0.45} delay={0.05} threshold={0.01}>
            <form className="groups-filter-bar" onSubmit={(event) => event.preventDefault()}>
              <div className="filter-field">
                <label htmlFor="cuves-debut">Période — début</label>
                <select
                  id="cuves-debut"
                  value={rapportDebut}
                  disabled={filtering}
                  onChange={(event) => runFilters({ rapportDebut: event.target.value })}
                >
                  {(cuvesData.rapport_choices || []).map((choice) => (
                    <option key={choice.id} value={choice.id}>{choice.label}</option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label htmlFor="cuves-fin">Période — fin</label>
                <select
                  id="cuves-fin"
                  value={rapportFin}
                  disabled={filtering}
                  onChange={(event) => runFilters({ rapportFin: event.target.value })}
                >
                  {(cuvesData.rapport_choices || []).map((choice) => (
                    <option key={choice.id} value={choice.id}>{choice.label}</option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label htmlFor="cuves-site">Site</label>
                <select
                  id="cuves-site"
                  value={siteId ?? ''}
                  disabled={filtering}
                  onChange={(event) => runFilters({ siteId: event.target.value })}
                >
                  <option value="">Tous les sites</option>
                  {(cuvesData.sites || []).map((site) => (
                    <option key={site.id} value={site.id}>{site.nom_site}</option>
                  ))}
                </select>
              </div>
              {siteId ? (
                <div className="filter-actions">
                  <button
                    type="button"
                    className="filter-reset"
                    disabled={filtering}
                    onClick={() => runFilters({ siteId: '' })}
                  >
                    Tout afficher
                  </button>
                </div>
              ) : null}
            </form>
          </AnimatedContent>

          <p className="cuves-scope-hint">
            Affichage : <strong>{scopeLabel}</strong>
            {' · '}
            {principalCount} cuve(s) principale(s)
            {' · '}
            {journalierCount} cuve(s) journalière(s)
          </p>

          <section className="metric-section">
            <div className="section-title-wrap">
              <span className="metric-label">Stock principal</span>
              <h2>Cuves principales</h2>
              <p className="group-header-meta">
                Volumes en litres — {scopeLabel.toLowerCase()}.
              </p>
            </div>
            <div className="summary-strip">
              <div className="summary-chip">
                <span>{METRIC_LABELS.totalPeriod}</span>
                <strong>{cuvesData.site_principal_stats?.total?.toFixed(1) ?? '—'} L</strong>
                {renderDelta(cuvesData.site_principal_stats)}
              </div>
              <div className="summary-chip">
                <span>{METRIC_LABELS.averagePeriod}</span>
                <strong>{cuvesData.site_principal_stats?.mean?.toFixed(1) ?? '—'} L</strong>
                {renderMeanDelta(cuvesData.site_principal_stats)}
              </div>
              <div className="summary-chip">
                <span>{METRIC_LABELS.habitualAverage}</span>
                <strong>{cuvesData.site_principal_stats?.all_time_mean?.toFixed(1) ?? '—'} L</strong>
              </div>
              <div className="summary-chip">
                <span title="À quel point le niveau varie d’un relevé à l’autre">{METRIC_LABELS.variability}</span>
                <strong>{cuvesData.site_principal_stats?.all_time_stddev?.toFixed(1) ?? '—'} L</strong>
              </div>
            </div>
          </section>

          <section className="groups-list">
            {(cuvesData.principal_blocks || []).map((block, index) => (
              <AnimatedContent key={block.id} distance={24} duration={0.4} delay={0.04 * Math.min(index, 6)} threshold={0.01}>
                <article className="group-card" style={{ borderLeft: `4px solid ${block.color || '#0b3d7a'}` }}>
                  <div className="group-card-head">
                    <span className="metric-label">Cuve principale</span>
                    <h3>{block.label}</h3>
                    <p className="group-header-meta">Capacité : {block.capacity?.toFixed(1) ?? '—'} L</p>
                  </div>
                  <div className="cuve-metric-layout">
                    <div className="metric-stat-block wide-metric-block">
                      <span className="curve-title">Volume stock</span>
                      <div className="group-stats wide-stats-grid">
                        <div>
                          <span>{METRIC_LABELS.totalPeriod}</span>
                          <strong>{block.stats?.total?.toFixed(1) ?? '—'} L</strong>
                          {renderDelta(block.stats)}
                        </div>
                        <div>
                          <span>{METRIC_LABELS.averagePeriod}</span>
                          <strong>{block.stats?.mean?.toFixed(1) ?? '—'} L</strong>
                          {renderMeanDelta(block.stats)}
                        </div>
                        <div>
                          <span>{METRIC_LABELS.habitualAverage}</span>
                          <strong>{block.stats?.all_time_mean?.toFixed(1) ?? '—'} L</strong>
                        </div>
                        <div>
                          <span title="À quel point le niveau varie d’un relevé à l’autre">{METRIC_LABELS.variability}</span>
                          <strong>{block.stats?.all_time_stddev?.toFixed(1) ?? '—'} L</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="chart-card">
                    <span className="curve-title">Courbe volume stock</span>
                    <div className={`chart-box small-box${canScroll ? ' is-scrollable' : ''}`}><canvas id={`chart-cuve-principale-${block.id}`} /></div>
                  </div>
                </article>
              </AnimatedContent>
            ))}
            {principalCount === 0 && (
              <p className="reports-empty">Aucune cuve principale pour ce filtre.</p>
            )}
          </section>

          <section className="metric-section">
            <div className="section-title-wrap">
              <span className="metric-label">Stock journalier</span>
              <h2>Cuves journalières</h2>
              <p className="group-header-meta">Même lecture pour les cuves journalières.</p>
            </div>
            <div className="summary-strip">
              <div className="summary-chip">
                <span>{METRIC_LABELS.totalPeriod}</span>
                <strong>{cuvesData.site_journalier_stats?.total?.toFixed(1) ?? '—'} L</strong>
                {renderDelta(cuvesData.site_journalier_stats)}
              </div>
              <div className="summary-chip">
                <span>{METRIC_LABELS.averagePeriod}</span>
                <strong>{cuvesData.site_journalier_stats?.mean?.toFixed(1) ?? '—'} L</strong>
                {renderMeanDelta(cuvesData.site_journalier_stats)}
              </div>
              <div className="summary-chip">
                <span>{METRIC_LABELS.habitualAverage}</span>
                <strong>{cuvesData.site_journalier_stats?.all_time_mean?.toFixed(1) ?? '—'} L</strong>
              </div>
              <div className="summary-chip">
                <span title="À quel point le niveau varie d’un relevé à l’autre">{METRIC_LABELS.variability}</span>
                <strong>{cuvesData.site_journalier_stats?.all_time_stddev?.toFixed(1) ?? '—'} L</strong>
              </div>
            </div>
          </section>

          <section className="groups-list">
            {(cuvesData.journalier_blocks || []).map((block, index) => (
              <AnimatedContent key={block.id} distance={24} duration={0.4} delay={0.04 * Math.min(index, 6)} threshold={0.01}>
                <article className="group-card" style={{ borderLeft: `4px solid ${block.color || '#0b3d7a'}` }}>
                  <div className="group-card-head">
                    <span className="metric-label">Cuve journalière</span>
                    <h3>{block.label}</h3>
                    <p className="group-header-meta">Capacité : {block.capacity?.toFixed(1) ?? '—'} L</p>
                  </div>
                  <div className="cuve-metric-layout">
                    <div className="metric-stat-block wide-metric-block">
                      <span className="curve-title">Volume stock</span>
                      <div className="group-stats wide-stats-grid">
                        <div>
                          <span>{METRIC_LABELS.totalPeriod}</span>
                          <strong>{block.stats?.total?.toFixed(1) ?? '—'} L</strong>
                          {renderDelta(block.stats)}
                        </div>
                        <div>
                          <span>{METRIC_LABELS.averagePeriod}</span>
                          <strong>{block.stats?.mean?.toFixed(1) ?? '—'} L</strong>
                          {renderMeanDelta(block.stats)}
                        </div>
                        <div>
                          <span>{METRIC_LABELS.habitualAverage}</span>
                          <strong>{block.stats?.all_time_mean?.toFixed(1) ?? '—'} L</strong>
                        </div>
                        <div>
                          <span title="À quel point le niveau varie d’un relevé à l’autre">{METRIC_LABELS.variability}</span>
                          <strong>{block.stats?.all_time_stddev?.toFixed(1) ?? '—'} L</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="chart-card">
                    <span className="curve-title">Courbe volume stock</span>
                    <div className={`chart-box small-box${canScroll ? ' is-scrollable' : ''}`}><canvas id={`chart-cuve-journaliere-${block.id}`} /></div>
                  </div>
                </article>
              </AnimatedContent>
            ))}
            {journalierCount === 0 && (
              <p className="reports-empty">Aucune cuve journalière pour ce filtre.</p>
            )}
          </section>
        </main>
      </PageEnter>
    </div>
  )
}

export default CuvesPage
