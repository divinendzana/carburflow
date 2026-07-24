import React, { useEffect, useMemo, useState } from 'react'
import Topbar from '../components/Topbar.jsx'
import { apiFetch } from '../auth.js'

const fallbackDashboardData = {
  summary: {
    critical_autonomy_sites: 1,
    abnormal_consumption_groups: 1,
    total_consumption: 3200,
    total_runtime: 180,
  },
  sites: [
    { id: 1, site_name: 'BUF Bepanda', label: 'BUF Bepanda', avg_consumption: 180, latest_consumption: 180, latest_volume: 340, autonomy: 1.9 },
    { id: 2, site_name: 'BUF Bonaberi', label: 'BUF Bonaberi', avg_consumption: 150, latest_consumption: 150, latest_volume: 420, autonomy: 2.8 },
  ],
  groups: [
    { id: 10, label: 'G#10 (Group A)', site_name: 'BUF Bepanda', avg_consumption: 90, latest_consumption: 96, avg_hours: 24, latest_hours: 26, variance_pct: 18, autonomy: 2.1 },
    { id: 11, label: 'G#11 (Group B)', site_name: 'BUF Bonaberi', avg_consumption: 72, latest_consumption: 74, avg_hours: 20, latest_hours: 22, variance_pct: 10, autonomy: 3.2 },
  ],
  alerts: [],
}

function DashboardPage({ onNavigate }) {
  const [dashboardData, setDashboardData] = useState(null)

  const formatValue = (value, suffix = '') => {
    if (value == null || Number.isNaN(value)) return '—'
    return `${Number(value).toLocaleString('fr-FR')}${suffix}`
  }

  const average = (values = []) => {
    const numeric = (values || []).filter((value) => typeof value === 'number' && !Number.isNaN(value))
    if (!numeric.length) return 0
    return numeric.reduce((sum, value) => sum + value, 0) / numeric.length
  }

  const getDeviation = (value, reference) => {
    if (value == null || reference == null || reference === 0) return null
    return Number((((value - reference) / reference) * 100).toFixed(1))
  }

  const renderDeviation = (value, reference, fallback = '—') => {
    const deviation = getDeviation(value, reference)
    if (deviation == null) return fallback

    const positive = deviation >= 0
    return (
      <span className={`deviation-cell ${positive ? 'positive' : 'negative'}`}>
        {positive ? '▲' : '▼'} {Math.abs(deviation).toFixed(1)}%
      </span>
    )
  }

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const payload = await apiFetch('/api/v1/dashboard/overview')
        setDashboardData(payload)
      } catch (error) {
        console.warn('Dashboard API unavailable, using fallback data.', error)
        setDashboardData(fallbackDashboardData)
      }
    }

    loadDashboardData()
  }, [])

  const siteRows = useMemo(() => {
    if (!dashboardData?.sites?.length) return []
    return [...dashboardData.sites].map((site) => ({
      ...site,
      autonomy: site.autonomy != null ? Number(site.autonomy) : null,
      avg_consumption: site.avg_consumption != null ? Number(site.avg_consumption) : 0,
      latest_consumption: site.latest_consumption != null ? Number(site.latest_consumption) : 0,
      latest_volume: site.latest_volume != null ? Number(site.latest_volume) : 0,
    }))
  }, [dashboardData])

  const groupRows = useMemo(() => {
    if (!dashboardData?.groups?.length) return []
    return [...dashboardData.groups].map((group) => ({
      ...group,
      avg_consumption: group.avg_consumption != null ? Number(group.avg_consumption) : 0,
      latest_consumption: group.latest_consumption != null ? Number(group.latest_consumption) : 0,
      avg_hours: group.avg_hours != null ? Number(group.avg_hours) : 0,
      latest_hours: group.latest_hours != null ? Number(group.latest_hours) : 0,
      variance_pct: group.variance_pct != null ? Number(group.variance_pct) : 0,
      autonomy: group.autonomy != null ? Number(group.autonomy) : null,
    }))
  }, [dashboardData])

  const siteAverageAutonomy = useMemo(() => average(siteRows.map((site) => site.autonomy).filter((value) => value != null)), [siteRows])
  const siteAverageConsumption = useMemo(() => average(siteRows.map((site) => site.avg_consumption)), [siteRows])
  const groupAverageConsumption = useMemo(() => average(groupRows.map((group) => group.avg_consumption)), [groupRows])
  const groupAverageVariance = useMemo(() => average(groupRows.map((group) => group.variance_pct)), [groupRows])
  const groupAverageAutonomy = useMemo(() => average(groupRows.map((group) => group.autonomy).filter((value) => value != null)), [groupRows])

  const summaryCards = useMemo(() => {
    if (!dashboardData) return []

    const criticalAutonomySites = dashboardData.summary?.critical_autonomy_sites ?? 0
    const abnormalGroups = dashboardData.summary?.abnormal_consumption_groups ?? 0
    const totalConsumption = dashboardData.summary?.total_consumption ?? 0
    const totalRuntime = dashboardData.summary?.total_runtime ?? 0

    const criticalReference = Math.max(1, Math.ceil((groupRows.length || 1) * 0.25))
    const abnormalReference = Math.max(1, Math.ceil((groupRows.length || 1) * 0.25))
    const consumptionDeviation = getDeviation(totalConsumption, siteAverageConsumption || totalConsumption || 1)
    const runtimeDeviation = getDeviation(totalRuntime, groupRows.length ? average(groupRows.map((group) => group.latest_hours)) || 1 : totalRuntime || 1)
    const criticalDeviation = getDeviation(criticalAutonomySites, criticalReference)
    const abnormalDeviation = getDeviation(abnormalGroups, abnormalReference)

    return [
      {
        label: 'Autonomie critique',
        title: `${criticalAutonomySites}`,
        detail: 'Groupes avec autonomie faible',
      },
      {
        label: 'Groupes anormaux',
        title: `${abnormalGroups}`,
        detail: 'Groupes avec consommation anormale',
      },
      {
        label: 'Consommation totale',
        title: formatValue(totalConsumption, ' L'),
        detail: 'Dernière période analysée',
        deviation: {
          value: consumptionDeviation,
          positive: (consumptionDeviation ?? 0) >= 0,
          text: consumptionDeviation == null ? '—' : `${consumptionDeviation >= 0 ? '+' : ''}${consumptionDeviation.toFixed(1)} % vs moyenne`,
        },
      },
      {
        label: 'Durée de fonctionnement',
        title: formatValue(totalRuntime, ' h'),
        detail: 'Somme des heures de fonctionnement',
        deviation: {
          value: runtimeDeviation,
          positive: (runtimeDeviation ?? 0) >= 0,
          text: runtimeDeviation == null ? '—' : `${runtimeDeviation >= 0 ? '+' : ''}${runtimeDeviation.toFixed(1)} % vs moyenne`,
        },
      },
    ]
  }, [dashboardData, groupRows, siteAverageConsumption])

  // 1. Groupes à faible autonomie
  const lowAutonomyGroupRows = useMemo(() => {
    if (!groupRows.length) return []
    return [...groupRows]
      .filter((g) => g.autonomy != null)
      .sort((a, b) => (a.autonomy ?? 999) - (b.autonomy ?? 999))
      .slice(0, 6)
  }, [groupRows])

  // 2. Groupes à consommation anormale
  const abnormalGroupRows = useMemo(() => {
    if (!groupRows.length) return []
    return [...groupRows]
      .sort((a, b) => b.variance_pct - a.variance_pct)
      .slice(0, 6)
  }, [groupRows])

  // 3. Groupes les plus gourmands
  const topConsumerGroupRows = useMemo(() => {
    if (!groupRows.length) return []
    return [...groupRows]
      .sort((a, b) => b.avg_consumption - a.avg_consumption)
      .slice(0, 6)
  }, [groupRows])

  // 4. Sites les plus gourmands
  const topConsumerSiteRows = useMemo(() => {
    if (!dashboardData?.sites?.length) return []
    const rows = dashboardData.sites.map((site) => ({
      ...site,
      autonomy: site.autonomy != null ? Number(site.autonomy) : null,
      avg_consumption: site.avg_consumption != null ? Number(site.avg_consumption) : 0,
      latest_consumption: site.latest_consumption != null ? Number(site.latest_consumption) : 0,
      latest_volume: site.latest_volume != null ? Number(site.latest_volume) : 0,
      group_autonomy: null,
    }))

    const rowsWithGroups = rows.map((site) => {
      const relatedGroups = groupRows.filter((group) => (group.site_name || '').toLowerCase() === (site.site_name || '').toLowerCase())
      const avgGroupAutonomy = average(relatedGroups.map((group) => group.autonomy).filter((value) => value != null))
      return {
        ...site,
        group_autonomy: avgGroupAutonomy || site.autonomy,
      }
    })

    return [...rowsWithGroups].sort((a, b) => b.avg_consumption - a.avg_consumption).slice(0, 6)
  }, [dashboardData, groupRows])

  const alertItems = useMemo(() => {
    const baseAlerts = [...(dashboardData?.alerts || [])]
    const enriched = baseAlerts.map((alert) => {
      if (alert.target === 'site') {
        const site = dashboardData?.sites?.find((entry) => String(entry.id) === String(alert.site_id))
        const deviation = site?.autonomy != null ? getDeviation(site.autonomy, siteAverageAutonomy) : null
        return { ...alert, deviation }
      }

      if (alert.target === 'groups') {
        const group = groupRows.find((entry) => String(entry.id) === String(alert.group_id))
        const deviation = group?.avg_consumption != null ? getDeviation(group.avg_consumption, groupAverageConsumption) : null
        return { ...alert, deviation }
      }

      return alert
    })

    return enriched.sort((a, b) => {
      const rank = { urgent: 2, warning: 1 }
      return (rank[b.priority_level] || 0) - (rank[a.priority_level] || 0)
    })
  }, [dashboardData, groupRows, siteAverageAutonomy, groupAverageConsumption])

  const alerts = alertItems

  const renderAlertSubtitle = (subtitle) => {
    if (!subtitle) return null
    // Split on the arrow pattern to inject colored JSX spans
    const parts = subtitle.split(/(▲[\d.]+%|▼[\d.]+%)/)
    return parts.map((part, i) => {
      const arrowMatch = part.match(/^(▲|▼)([\d.]+%)$/)
      if (arrowMatch) {
        const isUp = arrowMatch[1] === '▲'
        return (
          <span key={i} style={{ color: isUp ? '#0f8a4c' : '#bb1f26', fontWeight: 700 }}>
            {arrowMatch[1]}{arrowMatch[2]}
          </span>
        )
      }
      return <span key={i}>{part}</span>
    })
  }

  if (!dashboardData) {
    return (
      <div className="app-shell dashboard-shell">
        <Topbar activeView="dashboard" onNavigate={onNavigate} />
        <main className="dashboard-grid">
          <div className="loading-state">Chargement du dashboard...</div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell dashboard-shell">
      <Topbar activeView="dashboard" onNavigate={onNavigate} />

      <main className="dashboard-grid dashboard-grid-4col">
        <div className="dashboard-summary-grid">
          {summaryCards.map((card) => (
            <article key={card.label} className="metric-panel dashboard-summary-card">
              <div className="summary-card-header">
                <span className="metric-label">{card.label}</span>
                {card.deviation ? (
                  <span className={`summary-trend ${card.deviation.positive ? 'positive' : 'negative'}`}>
                    <span className="summary-trend-arrow">{card.deviation.positive ? '▲' : '▼'}</span>
                    {card.deviation.text}
                  </span>
                ) : null}
              </div>
              <h3>{card.title}</h3>
              <p>{card.detail}</p>
            </article>
          ))}
        </div>

        {/* 1. Groupes à faible autonomie */}
        <section className="dashboard-table metric-panel">
          <div className="metric-title-row">
            <div>
              <span className="metric-label">Alertes Autonomie</span>
              <h3>Groupes à faible autonomie</h3>
            </div>
          </div>
          <div className="dashboard-table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Groupe</th>
                  <th style={{ textAlign: 'left' }}>Site</th>
                  <th style={{ textAlign: 'center' }}>Autonomie</th>
                  <th style={{ textAlign: 'right' }}>Moy. conso</th>
                </tr>
              </thead>
              <tbody>
                {lowAutonomyGroupRows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ textAlign: 'left' }}>{row.label}</td>
                    <td style={{ textAlign: 'left' }}>{row.site_name || '—'}</td>
                    <td style={{ textAlign: 'center' }}><strong style={{ color: '#d97706' }}>{row.autonomy != null ? `${row.autonomy.toFixed(1)} pér.` : '—'}</strong></td>
                    <td style={{ textAlign: 'right' }}>{formatValue(row.avg_consumption, ' L')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 2. Groupes à consommation anormale */}
        <section className="dashboard-table metric-panel">
          <div className="metric-title-row">
            <div>
              <span className="metric-label">Alertes Anomalies</span>
              <h3>Groupes à consommation anormale</h3>
            </div>
          </div>
          <div className="dashboard-table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Groupe</th>
                  <th style={{ textAlign: 'left' }}>Site</th>
                  <th style={{ textAlign: 'right' }}>Conso moyenne</th>
                  <th style={{ textAlign: 'right' }}>Dernière conso</th>
                  <th style={{ textAlign: 'center' }}>Écart</th>
                </tr>
              </thead>
              <tbody>
                {abnormalGroupRows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ textAlign: 'left' }}>{row.label}</td>
                    <td style={{ textAlign: 'left' }}>{row.site_name || '—'}</td>
                    <td style={{ textAlign: 'right' }}><strong style={{ color: '#dc2626' }}>{formatValue(row.avg_consumption, ' L')}</strong></td>
                    <td style={{ textAlign: 'right' }}>{formatValue(row.latest_consumption, ' L')}</td>
                    <td style={{ textAlign: 'center' }}>{renderDeviation(row.variance_pct, groupAverageVariance, '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 3. Groupes les plus gourmands */}
        <section className="dashboard-table metric-panel">
          <div className="metric-title-row">
            <div>
              <span className="metric-label">Consommation Groupes</span>
              <h3>Groupes les plus gourmands</h3>
            </div>
          </div>
          <div className="dashboard-table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Groupe</th>
                  <th style={{ textAlign: 'left' }}>Site</th>
                  <th style={{ textAlign: 'right' }}>Moy. conso</th>
                  <th style={{ textAlign: 'right' }}>Dernière conso</th>
                  <th style={{ textAlign: 'center' }}>Écart</th>
                </tr>
              </thead>
              <tbody>
                {topConsumerGroupRows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ textAlign: 'left' }}>{row.label}</td>
                    <td style={{ textAlign: 'left' }}>{row.site_name || '—'}</td>
                    <td style={{ textAlign: 'right' }}><strong>{formatValue(row.avg_consumption, ' L')}</strong></td>
                    <td style={{ textAlign: 'right' }}>{formatValue(row.latest_consumption, ' L')}</td>
                    <td style={{ textAlign: 'center' }}>{renderDeviation(row.avg_consumption, groupAverageConsumption, '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 4. Sites les plus gourmands */}
        <section className="dashboard-table metric-panel">
          <div className="metric-title-row">
            <div>
              <span className="metric-label">Consommation Sites</span>
              <h3>Sites les plus gourmands</h3>
            </div>
          </div>
          <div className="dashboard-table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Site</th>
                  <th style={{ textAlign: 'right' }}>Moy. conso</th>
                  <th style={{ textAlign: 'right' }}>Dernier volume</th>
                  <th style={{ textAlign: 'center' }}>Écart</th>
                </tr>
              </thead>
              <tbody>
                {topConsumerSiteRows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ textAlign: 'left' }}>{row.label}</td>
                    <td style={{ textAlign: 'right' }}><strong>{formatValue(row.avg_consumption, ' L')}</strong></td>
                    <td style={{ textAlign: 'right' }}>{formatValue(row.latest_volume, ' L')}</td>
                    <td style={{ textAlign: 'center' }}>{renderDeviation(row.group_autonomy, groupAverageAutonomy, '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Notifications d'alertes en bas */}
        <section className="dashboard-alerts metric-panel" style={{ gridColumn: '1 / -1' }}>
          <div className="metric-title-row">
            <div>
              <span className="metric-label">Notifications d'alertes</span>
              <h3>{alerts.length ? 'Situation critique' : 'Situation normale'}</h3>
            </div>
          </div>
          <div className="alert-list">
            {alerts.length ? alerts.map((alert) => (
              <div key={alert.id} className={`alert-item alert-${alert.priority_level}`}>
                <div className="alert-header">
                  <strong>{alert.title}</strong>
                  <span className={`alert-badge alert-badge-${alert.priority_level}`}>
                    <span className="alert-badge-text">{alert.priority}</span>
                  </span>
                </div>
                <p>
                  {renderAlertSubtitle(alert.subtitle)}{' '}
                  <span
                    className="alert-more"
                    onClick={() => {
                      if (!onNavigate) return
                      if (alert.target === 'groups') {
                        onNavigate({ view: 'groups', groupId: alert.group_id, groupLabel: alert.group_label })
                      } else {
                        onNavigate({ view: 'sites', siteId: alert.site_id, siteName: alert.site_name })
                      }
                    }}
                  >En savoir plus</span>
                </p>
              </div>
            )) : (
              <div className="alert-empty">Aucune alerte majeure détectée pour le moment.</div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default DashboardPage
