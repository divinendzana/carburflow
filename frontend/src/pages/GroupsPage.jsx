import React, { useEffect, useMemo, useState } from 'react'
import Topbar from '../components/Topbar.jsx'

const buildDerivedMetric = (values = []) => {
  const normalizedValues = (values || []).map((value) => (typeof value === 'number' ? value : 0)).filter((value) => value > 0)
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
  const variationPct = firstValue === 0 ? null : ((normalizedValues[normalizedValues.length - 1] - firstValue) / firstValue) * 100
  const meanVariationPct = firstValue === 0 ? null : ((mean - firstValue) / firstValue) * 100
  const variance = normalizedValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / normalizedValues.length

  return {
    total: Number(total.toFixed(1)),
    mean: Number(mean.toFixed(1)),
    all_time_mean: Number(mean.toFixed(1)),
    all_time_stddev: Number(Math.sqrt(variance).toFixed(1)),
    variation_pct: variationPct === null ? null : Number(variationPct.toFixed(1)),
    mean_variation_pct: meanVariationPct === null ? null : Number(meanVariationPct.toFixed(1)),
    has_previous_period: normalizedValues.length > 1,
  }
}

const renderDelta = (metric, suffix = '') => {
  if (metric?.has_previous_period === false) {
    return <small className="delta-neutral">— pas de période précédente</small>
  }

  const deltaValue = typeof metric?.variation_pct === 'number'
    ? `${metric.variation_pct >= 0 ? '+' : ''}${metric.variation_pct.toFixed(1)} %`
    : '—'
  const deltaClass = (metric?.variation_pct ?? 0) >= 0 ? 'delta-up' : 'delta-down'
  return <small className={deltaClass}>{deltaValue}{suffix}</small>
}

const renderMeanDelta = (metric, suffix = '') => {
  if (metric?.has_previous_period === false) {
    return <small className="delta-neutral">— pas de période précédente</small>
  }

  const deltaValue = typeof metric?.mean_variation_pct === 'number'
    ? `${metric.mean_variation_pct >= 0 ? '+' : ''}${metric.mean_variation_pct.toFixed(1)} %`
    : '—'
  const deltaClass = (metric?.mean_variation_pct ?? 0) >= 0 ? 'delta-up' : 'delta-down'
  return <small className={deltaClass}>{deltaValue}{suffix}</small>
}

function GroupsPage({ onNavigate }) {
  const chartPalette = useMemo(() => ({ text: '#23466d', grid: 'rgba(11, 61, 122, 0.08)' }), [])
  const [groupsData, setGroupsData] = useState(null)
  const [rapportDebut, setRapportDebut] = useState('')
  const [rapportFin, setRapportFin] = useState('')
  const [siteId, setSiteId] = useState('')

  const reportChoices = useMemo(() => (groupsData?.rapport_choices || groupsData?.report_choices || []), [groupsData])
  const rapportDebutIndex = useMemo(() => {
    if (!reportChoices.length) return 0
    const selectedId = rapportDebut ? String(rapportDebut) : ''
    const selectedIndex = reportChoices.findIndex((choice) => String(choice.id) === selectedId)
    return selectedIndex >= 0 ? selectedIndex : 0
  }, [rapportDebut, reportChoices])
  const rapportFinIndex = useMemo(() => {
    if (!reportChoices.length) return 0
    const selectedId = rapportFin ? String(rapportFin) : ''
    const selectedIndex = reportChoices.findIndex((choice) => String(choice.id) === selectedId)
    return selectedIndex >= 0 ? selectedIndex : reportChoices.length - 1
  }, [rapportFin, reportChoices])
  const startIndex = Math.min(rapportDebutIndex, rapportFinIndex)
  const endIndex = Math.max(rapportDebutIndex, rapportFinIndex)

  const safeValue = (value) => (typeof value === 'number' ? value : 0)

  const loadGroupsData = async (queryParams = '') => {
    try {
      const response = await fetch(`/dashboard/groupes${queryParams ? `?${queryParams}` : ''}`)
      if (!response.ok) {
        throw new Error(`Backend error ${response.status}`)
      }
      const data = await response.json()
      const choices = data.rapport_choices || data.report_choices || []
      setGroupsData(data)
      setRapportDebut(data.selected_rapport_debut != null ? String(data.selected_rapport_debut) : String(choices[0]?.id ?? ''))
      setRapportFin(data.selected_rapport_fin != null ? String(data.selected_rapport_fin) : String(choices[choices.length - 1]?.id ?? ''))
      setSiteId(data.selected_site_id != null ? String(data.selected_site_id) : String(data.sites?.[0]?.id ?? ''))
    } catch (error) {
      console.warn('Groups backend unavailable, using demo fallback data.', error)
    }
  }

  useEffect(() => {
    loadGroupsData()
  }, [])

  useEffect(() => {
    if (!window.Chart || !groupsData) return undefined
    const charts = []
    const labels = (groupsData.labels || []).slice(startIndex, endIndex + 1)
    const sliceSeries = (values = []) => (values || []).slice(startIndex, endIndex + 1)
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
        x: { ticks: { color: chartPalette.text }, grid: { color: chartPalette.grid } },
        y: { beginAtZero: beginZero, ticks: { color: chartPalette.text, callback: (value) => `${value.toLocaleString('fr-FR')} ${unit}` }, grid: { color: chartPalette.grid } },
      },
    })

    groupsData.group_blocks?.forEach((block) => {
      const makeChart = (elementId, type, data, fill, label, color) => {
        const target = document.getElementById(elementId)
        if (!target) return
        const chart = new Chart(target, {
          type,
          data: { labels, datasets: [{ label, data: sliceSeries(data), borderColor: color, backgroundColor: `${color}20`, borderWidth: 2, tension: 0.35, fill, pointRadius: 4 }] },
          options: baseOptions(type === 'bar' ? 'L' : 'h', type !== 'bar'),
        })
        charts.push(chart)
      }

      makeChart(`chart-group-${block.id}-hours`, 'line', block.hours_run || [], true, block.label, block.color || '#0b3d7a')
      makeChart(`chart-group-${block.id}-consumption`, 'bar', block.consumption || block.consommation || [], false, 'Consommation', block.color || '#0b3d7a')
      const hourlyValues = (block.hours_run || []).map((hours, index) => {
        const hoursValue = safeValue(hours)
        const consumptionValue = safeValue((block.consumption || block.consommation || [])[index])
        return hoursValue > 0 ? Number((consumptionValue / hoursValue).toFixed(2)) : 0
      })
      makeChart(`chart-group-${block.id}-hourly-consumption`, 'line', hourlyValues, true, 'Consommation horaire', block.color || '#0b3d7a')
    })

    return () => charts.forEach((chart) => chart.destroy())
  }, [chartPalette, groupsData, startIndex, endIndex])

  const selectedSite = groupsData?.sites?.find((site) => String(site.id) === String(siteId)) ?? groupsData?.sites?.[0]

  const applyFilters = async (event) => {
    event.preventDefault()
    const params = new URLSearchParams()
    if (rapportDebut) params.set('rapport_debut', rapportDebut)
    if (rapportFin) params.set('rapport_fin', rapportFin)
    if (siteId) params.set('site_id', siteId)
    await loadGroupsData(params.toString())
  }

  if (!groupsData) {
    return (
      <div className="app-shell dashboard-shell">
        <Topbar activeView="groups" onNavigate={onNavigate} />
        <main className="groups-grid">
          <div className="loading-state">Chargement des données groupes...</div>
        </main>
      </div>
    )
  }

  const siteHours = groupsData.site_hours || {}
  const siteConsumption = groupsData.site_consumption || {}

  return (
    <div className="app-shell dashboard-shell">
      <Topbar activeView="groups" onNavigate={onNavigate} />

      <main className="groups-grid">
        <form className="groups-filter-bar" onSubmit={applyFilters}>
          <div className="filter-field">
            <label htmlFor="rapport_debut">Rapport début</label>
            <select id="rapport_debut" value={rapportDebut} onChange={(event) => setRapportDebut(event.target.value)}>
              {(groupsData.rapport_choices || []).map((choice) => (
                <option key={choice.id} value={String(choice.id)}>{choice.label}</option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="rapport_fin">Rapport fin</label>
            <select id="rapport_fin" value={rapportFin} onChange={(event) => setRapportFin(event.target.value)}>
              {(groupsData.rapport_choices || []).map((choice) => (
                <option key={choice.id} value={String(choice.id)}>{choice.label}</option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="site_id">Site</label>
            <select id="site_id" value={siteId} onChange={(event) => setSiteId(event.target.value)}>
              {(groupsData.sites || []).map((site) => (
                <option key={site.id} value={String(site.id)}>{site.nom_site}</option>
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
              <span>Durée de fonctionnement sur la période</span>
              <strong>{siteHours.total?.toFixed(1) ?? '—'} h</strong>
              {renderDelta(siteHours)}
            </div>
            <div className="summary-chip">
              <span>Durée de fonctionnement moyenne sur la période</span>
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
            <article key={group.id} className="group-card" style={{ position: 'relative', borderLeft: `4px solid ${group.color || '#0b3d7a'}` }}>
              <div style={{ position: 'absolute', top: '1rem', right: '1rem', backgroundColor: '#fde047', color: '#0b3d91', padding: '0.6rem 0.9rem', borderRadius: '999px', fontWeight: 700, boxShadow: '0 12px 20px rgba(0,0,0,0.08)', zIndex: 1 }}>
                Autonomie {group.autonomie_hours != null ? `${group.autonomie_hours.toFixed(1)} h` : '—'}
              </div>
              <div className="group-card-head">
                <span className="metric-label">Groupe</span>
                <h3>{group.label}</h3>
                <p className="group-header-meta">{group.rate?.toFixed(1) ?? '—'} L/h — {group.marque || ''} {group.puissance || ''}</p>
              </div>

              <div className="group-metric-grid">
                <div className="metric-stat-block">
                  <span className="curve-title">Durée de fonctionnement</span>
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
                  <div className="chart-box small-box"><canvas id={`chart-group-${group.id}-hours`} /></div>
                </div>
                <div className="chart-card">
                  <span className="curve-title">Courbe consommation</span>
                  <div className="chart-box small-box"><canvas id={`chart-group-${group.id}-consumption`} /></div>
                </div>
                <div className="chart-card">
                  <span className="curve-title">Courbe consommation horaire</span>
                  <div className="chart-box small-box"><canvas id={`chart-group-${group.id}-hourly-consumption`} /></div>
                </div>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  )
}

export default GroupsPage
