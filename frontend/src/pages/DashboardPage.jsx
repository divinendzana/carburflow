import React, { useEffect, useMemo, useState } from 'react'
import Topbar from '../components/Topbar.jsx'
import MetricPanel from '../components/MetricPanel.jsx'

const fallbackDashboardData = {
  metric1: {
    labels: ['CP #1 (BUF Bepanda)', 'CP #2 (BUF Bonaberi)', 'CP #3 (BUF Yaounde)'],
    values: [62, 40, 55],
    quantities: [2400, 1800, 2100],
    dailySeries: {
      1: {
        labels: ['CJ #1', 'CJ #2', 'CJ #3'],
        percentages: [72, 88, 80],
        colors: ['#0b3d7a', '#3b82f6', '#60a5fa'],
      },
    },
  },
  metric2: {
    labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jui'],
    globalConsumption: [380, 420, 460, 490, 520, 570],
    siteSeries: [
      { label: 'BUF Bepanda', data: [130, 150, 170, 180, 190, 220], borderColor: '#0b3d7a', backgroundColor: '#0b3d7a22' },
      { label: 'BUF Bonaberi', data: [115, 130, 145, 150, 160, 175], borderColor: '#3b82f6', backgroundColor: '#3b82f622' },
      { label: 'BUF Yaounde', data: [135, 140, 145, 160, 170, 175], borderColor: '#60a5fa', backgroundColor: '#60a5fa22' },
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
    },
  },
  metric4: {
    labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jui'],
    globalVolumes: [1800, 2100, 2050, 2350, 2600, 2820],
    siteSeries: [
      { label: 'BUF Bepanda', data: [700, 780, 760, 850, 920, 1000], borderColor: '#0b3d7a', backgroundColor: '#0b3d7a22' },
      { label: 'BUF Bonaberi', data: [560, 620, 610, 720, 760, 820], borderColor: '#3b82f6', backgroundColor: '#3b82f622' },
      { label: 'BUF Yaounde', data: [540, 700, 680, 780, 920, 1000], borderColor: '#60a5fa', backgroundColor: '#60a5fa22' },
    ],
  },
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

  const average = (values = []) => {
    const numeric = (values || []).filter((value) => typeof value === 'number')
    if (!numeric.length) return 0
    return numeric.reduce((sum, value) => sum + value, 0) / numeric.length
  }

  const formatValue = (value, suffix = '') => {
    if (value == null || Number.isNaN(value)) return '—'
    return `${Number(value).toLocaleString('fr-FR')}${suffix}`
  }

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [metric1, metric2, metric3, metric4] = await Promise.all([
          fetch('/api/v1/dashboard/etat_cuves').then((response) => response.json()),
          fetch('/api/v1/dashboard/evolution_volumes').then((response) => response.json()),
          fetch('/api/v1/dashboard/horaires_groupes').then((response) => response.json()),
          fetch('/api/v1/dashboard/consommation').then((response) => response.json()),
        ])

        setDashboardData({
          metric1: {
            labels: metric1.cp_chart_labels,
            values: metric1.cp_chart_pcts,
            quantities: metric1.cp_chart_quantities,
            dailySeries: metric1.sites_cj_chart_data || {},
          },
          metric2: {
            labels: metric4.labels,
            globalConsumption: metric4.global_consumption,
            siteSeries: metric4.sites_series,
          },
          metric3: {
            labels: metric3.labels,
            globalHours: metric3.global_hours,
            sitesData: metric3.sites_data,
          },
          metric4: {
            labels: metric2.labels,
            globalVolumes: metric2.global_volumes,
            siteSeries: metric2.sites_series,
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

  const selectedLabels = dashboardData ? sliceRange(dashboardData.metric2.labels) : []
  const selectedConsumption = dashboardData ? sliceRange(dashboardData.metric2.globalConsumption) : []
  const selectedHours = dashboardData ? sliceRange(dashboardData.metric3.globalHours) : []

  const totalConsumption = selectedConsumption.reduce((sum, value) => sum + (typeof value === 'number' ? value : 0), 0)
  const totalHours = selectedHours.reduce((sum, value) => sum + (typeof value === 'number' ? value : 0), 0)

  const lastConsumption = selectedConsumption[selectedConsumption.length - 1]
  const previousConsumption = selectedConsumption[selectedConsumption.length - 2]
  const lastHours = selectedHours[selectedHours.length - 1]
  const previousHours = selectedHours[selectedHours.length - 2]

  const computeTrend = (current, previous) => {
    if (current == null || previous == null || previous === 0) return null
    const value = ((current - previous) / previous) * 100
    const rounded = Number(value.toFixed(1))
    return {
      percent: rounded,
      positive: rounded >= 0,
      text: `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)} % par rapport à la semaine passée`,
    }
  }

  const consumptionTrend = computeTrend(lastConsumption, previousConsumption)
  const hoursTrend = computeTrend(lastHours, previousHours)

  const siteVolumeMap = new Map((dashboardData?.metric4.siteSeries || []).map((site) => [String(site.id ?? site.label), site]))
  const siteRows = (dashboardData?.metric2.siteSeries || []).map((site) => {
    const data = sliceRange(site.data || [])
    const avg = average(data)
    const latestConsumption = data[data.length - 1] ?? 0
    const volumeSite = siteVolumeMap.get(String(site.id ?? site.label))
    const latestVolume = Array.isArray(volumeSite?.data) ? volumeSite.data[volumeSite.data.length - 1] : null
    const autonomy = avg > 0 && latestVolume != null ? latestVolume / avg : null

    return {
      key: String(site.id ?? site.label),
      label: site.label,
      avg,
      latestConsumption,
      latestVolume,
      autonomy,
    }
  })

  const sortedSitesByConsumption = [...siteRows].sort((a, b) => b.avg - a.avg)
  const lowAutonomySites = sortedSitesByConsumption.filter((site) => site.autonomy != null && site.autonomy <= 2).slice(0, 5)
  const siteAverageConsumption = average(siteRows.map((site) => site.avg))
  const highConsumptionSites = sortedSitesByConsumption.filter((site) => site.avg > siteAverageConsumption * 1.2).slice(0, 5)

  const groupRows = Object.values(dashboardData?.metric3.sitesData || {}).flatMap((site) =>
    (site.datasets || []).map((dataset) => {
      const data = sliceRange(dataset.data || [])
      const avg = average(data)
      return {
        key: String(dataset.id ?? dataset.label),
        label: dataset.label,
        siteName: site.nom_site || '',
        avg,
        latest: data[data.length - 1] ?? 0,
      }
    }),
  )

  const sortedGroupsByHours = [...groupRows].sort((a, b) => b.avg - a.avg)
  const groupAverageHours = average(groupRows.map((group) => group.avg))
  const groupDeviations = sortedGroupsByHours.filter((group) => groupAverageHours > 0 && group.avg > groupAverageHours * 1.2).slice(0, 8)

  const computeDeviation = (value, average) => {
    if (value == null || average == null || average === 0) return null
    return Number((((value - average) / average) * 100).toFixed(1))
  }

  const formatAutonomy = (hours) => {
    if (hours == null || Number.isNaN(hours)) return 'N/D'
    const hrs = Math.round(hours)
    if (hrs > 24) {
      const days = Math.floor(hrs / 24)
      const rem = hrs % 24
      return `${days}j:${String(rem).padStart(2, '0')}h`
    }
    return `${hrs} h`
  }

  const topGroupForSite = (siteLabel) => {
    const groups = groupRows.filter((g) => (g.siteName || '').toLowerCase() === (siteLabel || '').toLowerCase())
    if (!groups.length) return null
    return groups.sort((a, b) => b.avg - a.avg)[0].label
  }

  const alertItems = [
    ...lowAutonomySites.map((site) => {
      const deviation = computeDeviation(site.avg, siteAverageConsumption)
      const topGroup = topGroupForSite(site.label)
      return {
        id: `low-autonomy-${site.key}`,
        title: `Site ${site.label} : autonomie critique`,
        siteName: site.label,
        autonomyHours: site.autonomy,
        autonomyFormatted: formatAutonomy(site.autonomy),
        topGroup,
        subtitle: `Consommation ${formatValue(site.avg, ' L')} ${deviation != null ? `(${deviation > 0 ? '+' : ''}${deviation}% vs moyenne)` : ''}.`,
        target: 'site',
        priority: 'Critique',
        priorityLevel: 'urgent',
        deviation,
        priorityRank: 3,
      }
    }),
    ...highConsumptionSites.map((site) => {
      const deviation = computeDeviation(site.avg, siteAverageConsumption)
      return {
        id: `high-consumption-${site.key}`,
        title: `Site ${site.label} : consommation anormale`,
        siteName: site.label,
        avg: site.avg,
        subtitle: `Consommation ${formatValue(site.avg, ' L')} ${deviation != null ? `(${deviation > 0 ? '+' : ''}${deviation}% vs moyenne)` : ''}.`,
        target: 'site',
        priority: 'Critique',
        priorityLevel: 'urgent',
        deviation,
        priorityRank: 2,
      }
    }),
    ...groupDeviations.map((group) => {
      const deviation = computeDeviation(group.avg, groupAverageHours)
      return {
        id: `group-anomaly-${group.key}`,
        title: `Groupe ${group.label} : consommation horaire anormale`,
        groupLabel: group.label,
        siteName: group.siteName || '',
        avg: group.avg,
        latest: group.latest,
        subtitle: `Consommation horaire ${formatValue(group.avg, ' h')} ${deviation != null ? `(${deviation > 0 ? '+' : ''}${deviation}% vs moyenne)` : ''}.`,
        target: 'groups',
        priority: 'Moyenne',
        priorityLevel: 'warning',
        deviation,
        priorityRank: 1,
      }
    }),
  ].sort((a, b) => (b.priorityRank - a.priorityRank) || ((b.deviation || 0) - (a.deviation || 0)))

  const isCritical = alertItems.length >= 3
  const summaryCards = isCritical
    ? [
        { label: 'Autonomie critique', title: `${lowAutonomySites.length}`, detail: 'Sites avec autonomie estimée faible' },
        { label: 'Groupes anormaux', title: `${groupDeviations.length}`, detail: 'Groupes à forte déviation horaire' },
        {
          label: 'Consommation totale',
          title: formatValue(totalConsumption, ' L'),
          detail: 'Dernière période analysée',
          trend: consumptionTrend,
        },
        {
          label: 'Durée de fonctionnement',
          title: formatValue(totalHours, ' h'),
          detail: 'Total des heures groupes',
          trend: hoursTrend,
        },
      ]
    : [
        {
          label: 'Consommation totale',
          title: formatValue(totalConsumption, ' L'),
          detail: 'Dernière période analysée',
          trend: consumptionTrend,
        },
        {
          label: 'Durée de fonctionnement',
          title: formatValue(totalHours, ' h'),
          detail: 'Total des heures groupes',
          trend: hoursTrend,
        },
        { label: 'Sites gourmands', title: `${sortedSitesByConsumption.length}`, detail: 'Sites avec fort niveau de consommation' },
        { label: 'Groupes gourmands', title: `${sortedGroupsByHours.length}`, detail: 'Groupes avec le plus d’heures' },
      ]

  const primaryTable = isCritical ? highConsumptionSites : sortedSitesByConsumption.slice(0, 8)
  const primaryTableTitle = isCritical ? 'Sites à consommation anormale' : 'Sites les plus gourmands'
  const primaryTableHeaders = isCritical
    ? ['Site', 'Consommation moyenne', 'Dernière consommation', 'Écart relatif']
    : ['Site', 'Consommation moyenne', 'Dernier volume', 'Autonomie estimée']

  const secondaryTable = isCritical ? lowAutonomySites : sortedGroupsByHours.slice(0, 8)
  const secondaryTableTitle = isCritical ? 'Site à faible autonomie' : 'Groupes les plus gourmands'
  const secondaryTableHeaders = isCritical ? ['Site', 'Dernier volume', 'Consommation moyenne', 'Autonomie estimée'] : ['Groupe', 'Site', 'Heures moyennes']

  const tertiaryTable = (groupDeviations && groupDeviations.length > 0)
    ? groupDeviations
    : (isCritical ? sortedGroupsByHours.slice(0, 8) : highConsumptionSites)
  const tertiaryIsGroups = (groupDeviations && groupDeviations.length > 0)

  const tertiaryTableTitle = tertiaryIsGroups
    ? 'Groupes à consommation anormale'
    : (isCritical ? 'Groupes consommation anormale' : 'Sites à consommation élevée')

  const tertiaryTableHeaders = tertiaryIsGroups
    ? ['Groupe', 'Site', 'Consommation moyenne', 'Dernière consommation', 'Écart relatif']
    : ['Site', 'Consommation moyenne', 'Dernier volume', 'Autonomie estimée']

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

      <main className="dashboard-grid">
        <div className="dashboard-summary-grid">
          {summaryCards.map((card) => (
            <article key={card.label} className="metric-panel dashboard-summary-card">
              <div className="summary-card-header">
                <span className="metric-label">{card.label}</span>
                {card.trend ? (
                  <span className={`summary-trend ${card.trend.positive ? 'positive' : 'negative'}`}>
                    <span className="summary-trend-arrow">{card.trend.positive ? '▲' : '▼'}</span>
                    {card.trend.text}
                  </span>
                ) : null}
              </div>
              <h3>{card.title}</h3>
              <p>{card.detail}</p>
            </article>
          ))}
        </div>

        <section className="dashboard-table dashboard-table-large metric-panel">
          <div className="metric-title-row">
            <div>
              <span className="metric-label">Tableau principal</span>
              <h3>{primaryTableTitle}</h3>
            </div>
          </div>
          <div className="dashboard-table-scroll">
            <table>
              <thead>
                <tr>
                  {primaryTableHeaders.map((header) => <th key={header}>{header}</th>)}
                </tr>
              </thead>
              <tbody>
                {primaryTable.map((row) => (
                  <tr key={row.key}>
                    {isCritical ? (
                      // row is a site with avg and latestConsumption
                      (() => {
                        const latest = row.latestConsumption ?? row.latest ?? row.latestVolume ?? null
                        const dev = computeDeviation(latest, row.avg)
                        const sign = dev == null ? '' : dev > 0 ? '▲+' : dev < 0 ? '▼' : ''
                        return (
                          <>
                            <td>{row.label}</td>
                            <td>{formatValue(row.avg, ' L')}</td>
                            <td>{latest != null ? formatValue(latest, ' L') : '—'}</td>
                            <td className={`deviation-cell ${dev == null ? '' : (dev >= 0 ? 'positive' : 'negative')}`}>
                              {dev == null ? '—' : `${sign}${Math.abs(dev)}%`}
                            </td>
                          </>
                        )
                      })()
                    ) : (
                      <>
                        <td>{row.label}</td>
                        <td>{formatValue(row.avg, ' L')}</td>
                        <td>{formatValue(row.latestVolume, ' L')}</td>
                        <td>{row.autonomy != null ? `${row.autonomy.toFixed(1)} périodes` : '—'}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="dashboard-table dashboard-table-secondary dashboard-table-small metric-panel">
          <div className="metric-title-row">
            <div>
              <span className="metric-label">Tableau secondaire</span>
              <h3>{secondaryTableTitle}</h3>
            </div>
          </div>
          <div className="dashboard-table-scroll">
            <table>
              <thead>
                <tr>
                  {secondaryTableHeaders.map((header) => <th key={header}>{header}</th>)}
                </tr>
              </thead>
              <tbody>
                {secondaryTable.map((row) => (
                  <tr key={row.key}>
                    {isCritical ? (
                      <>
                        <td>{row.label}</td>
                        <td>{formatValue(row.latestVolume, ' L')}</td>
                        <td>{formatValue(row.avg, ' L')}</td>
                        <td>{row.autonomy != null ? `${row.autonomy.toFixed(1)} périodes` : '—'}</td>
                      </>
                    ) : (
                      <>
                        <td>{row.label}</td>
                        <td>{row.siteName || '—'}</td>
                        <td>{formatValue(row.avg, ' h')}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="dashboard-table dashboard-table-tertiary dashboard-table-small metric-panel">
          <div className="metric-title-row">
            <div>
              <span className="metric-label">Tableau tertiaire</span>
              <h3>{tertiaryTableTitle}</h3>
            </div>
          </div>
          <div className="dashboard-table-scroll">
            <table>
              <thead>
                <tr>
                  {tertiaryTableHeaders.map((header) => <th key={header}>{header}</th>)}
                </tr>
              </thead>
              <tbody>
                {tertiaryTable.map((row) => (
                  <tr key={row.key}>
                    {tertiaryIsGroups ? (
                      (() => {
                        const latest = row.latest ?? row.latestVolume ?? null
                        const dev = computeDeviation(latest, row.avg)
                        const sign = dev == null ? '' : dev > 0 ? '▲+' : dev < 0 ? '▼' : ''
                        return (
                          <>
                            <td>{row.label}</td>
                            <td>{row.siteName || '—'}</td>
                            <td>{formatValue(row.avg, ' h')}</td>
                            <td>{latest != null ? formatValue(latest, ' h') : '—'}</td>
                            <td className={`deviation-cell ${dev == null ? '' : (dev >= 0 ? 'positive' : 'negative')}`}>
                              {dev == null ? '—' : `${sign}${Math.abs(dev)}%`}
                            </td>
                          </>
                        )
                      })()
                    ) : (
                      <>
                        <td>{row.label}</td>
                        <td>{formatValue(row.avg, ' L')}</td>
                        <td>{formatValue(row.latestVolume, ' L')}</td>
                        <td>{row.autonomy != null ? `${row.autonomy.toFixed(1)} périodes` : '—'}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="dashboard-alerts metric-panel">
          <div className="metric-title-row">
            <div>
              <span className="metric-label">Notifications d'alertes</span>
              <h3>{isCritical ? 'Situation critique' : 'Situation normale'}</h3>
            </div>
          </div>
          <div className="alert-list">
            {alertItems.length ? alertItems.map((alert) => {
              const unit = alert.target === 'groups' ? ' h' : ' L'
              const dev = alert.deviation
              const avg = alert.avg ?? alert.autonomyHours ?? null
              const title = alert.siteName ? `Site ${alert.siteName} : Consommation anormale` : (alert.groupLabel ? `Groupe ${alert.groupLabel} : Consommation anormale` : alert.title)
              return (
                <div key={alert.id} className={`alert-item alert-${alert.priorityLevel}`}>
                  <div className="alert-header">
                    <strong>{title}</strong>
                    <span className={`alert-badge alert-badge-${alert.priorityLevel}`}>
                      {alert.priorityLevel === 'urgent' ? (
                        <svg className="alert-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                          <path d="M12 2L22 20H2L12 2Z" fill="#9B1C1C"/>
                          <path d="M12 8.5V13" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <circle cx="12" cy="16.5" r="1" fill="#FFF"/>
                        </svg>
                      ) : (
                        <svg className="alert-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                          <path d="M12 2L22 20H2L12 2Z" fill="#A65F03"/>
                          <path d="M12 8.5V13" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                      <span className="alert-badge-text">{alert.priority}</span>
                    </span>
                  </div>
                  <p>
                    {dev != null ? (
                      <>
                        Un constat de{' '}
                        <span className={`deviation-inline ${dev >= 0 ? 'positive' : 'negative'}`}>
                          {dev >= 0 ? '+' : ''}{dev.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                        </span>{' '}
                        par rapport à la valeur moyenne de {formatValue(avg, unit)} a été constaté lors du dernier rapport. {' '}
                      </>
                    ) : (
                      'Un constat a été relevé lors du dernier rapport. '
                    )}
                    <span className="alert-more" onClick={() => onNavigate && onNavigate({ view: 'sites', siteId: alert.siteName, siteName: alert.siteName })}>En savoir plus</span>
                  </p>
                </div>
              )
            }) : (
              <div className="alert-empty">Aucune alerte majeure détectée pour le moment.</div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default DashboardPage
