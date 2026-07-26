import React, { useEffect, useMemo, useState } from 'react'
import Topbar from '../components/Topbar.jsx'
import WelcomeBanner from '../components/WelcomeBanner.jsx'
import { apiFetch } from '../auth.js'
import AutonomyBadge from '../components/AutonomyBadge.jsx'
import PageLoader from '../components/PageLoader.jsx'
import PageEnter from '../components/PageEnter.jsx'
import { formatAutonomy, getAutonomySeverity } from '../utils/format.js'

const SEVERITY_META = {
  critical: { label: 'Urgent', level: 'critical', rank: 3 },
  medium: { label: 'À surveiller', level: 'medium', rank: 2 },
  low: { label: 'Attention', level: 'low', rank: 1 },
}

function normalizeAlertSeverity(alert) {
  const raw = String(alert.priority_level || alert.severity || '').toLowerCase()
  const label = String(alert.priority || '').toLowerCase()
  if (
    raw === 'urgent'
    || raw === 'critical'
    || label.includes('critique')
  ) return SEVERITY_META.critical
  if (
    raw === 'high'
    || raw === 'medium'
    || label.includes('moyen')
  ) return SEVERITY_META.medium
  if (
    raw === 'warning'
    || raw === 'low'
    || label.includes('faible')
  ) return SEVERITY_META.low
  return SEVERITY_META.medium
}

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

    // Si l'écart est négatif, valeur inférieure à la moyenne -> rouge
    // Si positif, valeur supérieure à la moyenne -> vert
    const isNegative = deviation < 0
    return (
      <span className={`deviation-cell ${isNegative ? 'negative' : 'positive'}`}>
        {isNegative ? '▼' : '▲'} {Math.abs(deviation).toFixed(1)}%
      </span>
    )
  }

  const renderAutonomyDeviation = (value, reference, fallback = '—') => {
    const deviation = getDeviation(value, reference)
    if (deviation == null) return fallback

    // Pour l'autonomie, une valeur négative = pire (moins d'autonomie)
    const isNegative = deviation < 0
    return (
      <span className={`deviation-cell ${isNegative ? 'negative' : 'positive'}`}>
        {isNegative ? '▼' : '▲'} {Math.abs(deviation).toFixed(1)}% {isNegative ? '(pire)' : '(mieux)'}
      </span>
    )
  }

  // Écart pour "Groupes les plus gourmands" : (dernière conso - moyenne) / dernière
  // conso — relatif à la dernière valeur, pas à la moyenne (contrairement à
  // getDeviation/renderDeviation utilisés ailleurs). Flèche bas quand la dernière
  // conso est en retrait par rapport à la moyenne du groupe.
  const renderConsumptionGapVsLatest = (latest, avg, fallback = '—') => {
    if (latest == null || avg == null || latest === 0) return fallback
    const gapPct = Number((((latest - avg) / latest) * 100).toFixed(1))
    const isNegative = gapPct < 0
    return (
      <span className={`deviation-cell ${isNegative ? 'negative' : 'positive'}`}>
        {isNegative ? '▼' : '▲'} {Math.abs(gapPct).toFixed(1)}%
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
      autonomie_hours: site.autonomie_hours != null ? Number(site.autonomie_hours) : null,
      formatted_autonomy: site.formatted_autonomy || null,
      is_infinite_consumption: !!site.is_infinite_consumption,
      is_infinite_autonomy: !!site.is_infinite_autonomy,
      avg_consumption: site.avg_consumption != null ? Number(site.avg_consumption) : 0,
      latest_consumption: site.latest_consumption != null ? Number(site.latest_consumption) : 0,
      latest_volume: site.latest_volume != null ? Number(site.latest_volume) : 0,
    }))
  }, [dashboardData])

  // Dans le useMemo groupRows
  const groupRows = useMemo(() => {
    if (!dashboardData?.groups?.length) return []
    return [...dashboardData.groups].map((group) => ({
      ...group,
      avg_consumption: group.avg_consumption != null ? Number(group.avg_consumption) : 0,
      latest_consumption: group.latest_consumption != null ? Number(group.latest_consumption) : 0,
      // === CHAMPS CORRIGÉS ===
      mean_hourly_consumption: group.mean_hourly_consumption != null ? Number(group.mean_hourly_consumption) : 0,
      mean_hourly_consumption_deduite: group.mean_hourly_consumption_deduite != null ? Number(group.mean_hourly_consumption_deduite) : 0,
      latest_hourly_consumption: group.latest_hourly_consumption != null ? Number(group.latest_hourly_consumption) : null,
      avg_hours: group.avg_hours != null ? Number(group.avg_hours) : 0,
      latest_hours: group.latest_hours != null ? Number(group.latest_hours) : 0,
      variance_pct: group.variance_pct != null ? Number(group.variance_pct) : 0,
      autonomy: group.autonomie_hours != null ? Number(group.autonomie_hours) : (group.autonomy != null ? Number(group.autonomy) : null),
      formatted_autonomy: group.formatted_autonomy || null,
    }))
  }, [dashboardData])



  const siteAverageAutonomy = useMemo(() => average(siteRows.map((site) => site.autonomy).filter((value) => value != null)), [siteRows])
  const siteAverageAutonomyHours = useMemo(() => average(siteRows.map((site) => site.autonomie_hours).filter((value) => value != null)), [siteRows])
  const siteAverageConsumption = useMemo(() => average(siteRows.map((site) => site.avg_consumption)), [siteRows])
  const groupAverageConsumption = useMemo(() => average(groupRows.map((group) => group.avg_consumption)), [groupRows])
  const groupAverageVariance = useMemo(() => average(groupRows.map((group) => group.variance_pct)), [groupRows])
  const groupAverageAutonomy = useMemo(() => average(groupRows.map((group) => group.autonomy).filter((value) => value != null)), [groupRows])

  // Fonction pour déterminer le type d'alerte d'un site
  const getSiteAlertType = (site) => {
    // 0h = consommation sans heures -> traité comme critique (pas de données de
    // consommation sur le groupe rattaché, donc l'autonomie réelle est inconnue et
    // potentiellement nulle : ça doit apparaître dans les faibles autonomies, pas
    // être ignoré).
    if (site.is_infinite_consumption) {
      return { type: 'critique', priority: 'urgent', label: 'Temps restant critique (0 h — consommation sans delta horaire)' }
    }
    // ∞ = pas de données -> IGNORER (pas d'alerte)
    if (site.is_infinite_autonomy) {
      return null
    }
    // Autonomie finie
    if (site.autonomie_hours != null) {
      if (site.autonomie_hours < 24) {
        return { type: 'critique', priority: 'urgent', label: 'Temps restant critique (< 24 h)' }
      }
      if (site.autonomie_hours < 36) {
        return { type: 'alerte', priority: 'warning', label: 'Temps restant faible (< 36 h)' }
      }
    }
    return null
  }

  const summaryCards = useMemo(() => {
    if (!dashboardData) return []

    // Sites en faible autonomie : autonomie finie < 24h, OU 0h (consommation avérée
    // sans heures de fonctionnement enregistrées sur le groupe rattaché — pas de
    // données de consommation disponibles, donc autonomie potentiellement nulle).
    // Seul ∞ (aucune donnée du tout) reste exclu du compte.
    const criticalAutonomySites = siteRows.filter((s) => {
      if (s.is_infinite_autonomy) return false // ∞ = pas de données
      if (s.is_infinite_consumption) return true // 0h = compté comme critique
      return s.autonomie_hours != null && s.autonomie_hours < 24
    }).length

    const abnormalGroups = dashboardData.summary?.abnormal_consumption_groups ?? 0
    const totalConsumption = dashboardData.summary?.total_consumption ?? 0
    const totalRuntime = dashboardData.summary?.total_runtime ?? 0

    const criticalReference = Math.max(1, Math.ceil((siteRows.length || 1) * 0.25))
    const abnormalReference = Math.max(1, Math.ceil((groupRows.length || 1) * 0.25))
    const consumptionDeviation = getDeviation(totalConsumption, siteAverageConsumption || totalConsumption || 1)
    const runtimeDeviation = getDeviation(totalRuntime, groupRows.length ? average(groupRows.map((group) => group.latest_hours)) || 1 : totalRuntime || 1)

    return [
      {
        label: 'Sites urgents',
        title: `${criticalAutonomySites}`,
        detail: 'Moins de 24 h de temps restant',
      },
      {
        label: 'Anomalies groupes',
        title: `${abnormalGroups}`,
        detail: 'Écart de consommation horaire détecté',
      },
      {
        label: 'Consommation',
        title: formatValue(totalConsumption, ' L'),
        detail: 'Sur la dernière période analysée',
        deviation: {
          value: consumptionDeviation,
          isNegative: consumptionDeviation !== null && consumptionDeviation < 0,
          text: consumptionDeviation == null ? '—' : `${Math.abs(consumptionDeviation).toFixed(1)}%`,
        },
      },
      {
        label: 'Delta horaire',
        title: formatValue(totalRuntime, ' h'),
        detail: 'Total du delta horaire enregistré',
        deviation: {
          value: runtimeDeviation,
          isNegative: runtimeDeviation !== null && runtimeDeviation < 0,
          text: runtimeDeviation == null ? '—' : `${Math.abs(runtimeDeviation).toFixed(1)}%`,
        },
      },
    ]
  }, [dashboardData, groupRows, siteRows, siteAverageConsumption])

  // 1. Sites à faible autonomie (inclut 0h — pas de données de consommation sur le
  // groupe rattaché, donc autonomie potentiellement nulle ; exclut seulement ∞,
  // qui signifie une absence totale de données)
  const lowAutonomySiteRows = useMemo(() => {
    if (!siteRows.length) return []
    return [...siteRows]
      .filter((s) => {
        // Exclure les sites avec autonomie infinie (∞ = aucune donnée)
        if (s.is_infinite_autonomy) return false
        // Garder les 0h (consommation avérée sans heures)
        if (s.is_infinite_consumption) return true
        // Garder les sites avec une autonomie finie sous le seuil
        return s.autonomie_hours != null && s.autonomie_hours < 36
      })
      // 0h passe en tête (pire cas), puis tri croissant par autonomie
      .sort((a, b) => {
        const aKey = a.is_infinite_consumption ? -1 : (a.autonomie_hours ?? 999)
        const bKey = b.is_infinite_consumption ? -1 : (b.autonomie_hours ?? 999)
        return aKey - bKey
      })
      .slice(0, 6)
  }, [siteRows])

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

  // 4. Sites les plus gourmands (avec colonnes simplifiées)
  const topConsumerSiteRows = useMemo(() => {
    if (!siteRows.length) return []
    return [...siteRows]
      .sort((a, b) => b.avg_consumption - a.avg_consumption)
      .slice(0, 6)
  }, [siteRows])

  const alertItems = useMemo(() => {
    // Créer des alertes pour les sites avec 0h (consommation sans heures)
    const siteAlerts = siteRows
      .map((site) => {
        // Seulement pour les sites avec 0h
        if (!site.is_infinite_consumption) return null
        
        const title = `Site ${site.site_name} : consommation sans delta horaire`
        const subtitle = `Consommation détectée sans delta horaire — consommation moyenne ${site.avg_consumption} L.`
        
        return {
          id: `site-anormal-${site.id}`,
          type: 'anormal',
          target: 'site',
          priority: 'Moyen',
          priority_level: 'medium',
          severity: 'medium',
          site_id: site.id,
          site_name: site.site_name,
          title,
          subtitle,
          is_infinite_consumption: true,
        }
      })
      .filter(Boolean)

    // Créer des alertes pour les sites avec autonomie critique (<24h) et faible (24-36h)
    const autonomyAlerts = siteRows
      .map((site) => {
        // Ignorer ∞ et 0h
        if (site.is_infinite_autonomy) return null
        if (site.is_infinite_consumption) return null
        if (site.autonomie_hours == null) return null
        
        if (site.autonomie_hours < 24) {
          return {
            id: `site-critique-${site.id}`,
            type: 'critique',
            target: 'site',
            priority: 'Critique',
            priority_level: 'critical',
            severity: 'critical',
            site_id: site.id,
            site_name: site.site_name,
            title: `Site ${site.site_name} : temps restant critique`,
            subtitle: `Temps restant : ${site.formatted_autonomy || formatAutonomy(site.autonomie_hours)} — consommation moyenne ${site.avg_consumption} L.`,
            is_infinite_consumption: false,
          }
        }
        
        if (site.autonomie_hours < 36) {
          return {
            id: `site-faible-${site.id}`,
            type: 'alerte',
            target: 'site',
            priority: 'Faible',
            priority_level: 'low',
            severity: 'low',
            site_id: site.id,
            site_name: site.site_name,
            title: `Site ${site.site_name} : temps restant à surveiller`,
            subtitle: `Temps restant : ${site.formatted_autonomy || formatAutonomy(site.autonomie_hours)} — consommation moyenne ${site.avg_consumption} L.`,
            is_infinite_consumption: false,
          }
        }
        
        return null
      })
      .filter(Boolean)

    // Garder les alertes existantes pour les groupes — le subtitle vient déjà du
    // backend avec le même écart que celui affiché dans le tableau "consommation
    // anormale" (déduite vs réellement évaluée) ; pas de recalcul ici, pour éviter
    // que la notification et le tableau divergent.
    const groupAlerts = (dashboardData?.alerts || [])
      .filter((alert) => alert.target === 'groups')
      .map((alert) => {
        const sev = normalizeAlertSeverity(alert)
        return {
          ...alert,
          priority: sev.label,
          priority_level: sev.level,
          severity: sev.level,
        }
      })

    const combined = [...siteAlerts, ...autonomyAlerts, ...groupAlerts]
      .map((alert) => {
        if (alert.severity) return alert
        const sev = normalizeAlertSeverity(alert)
        return {
          ...alert,
          priority: sev.label,
          priority_level: sev.level,
          severity: sev.level,
        }
      })
    
    return combined.sort((a, b) => {
      const rank = { critical: 3, medium: 2, low: 1 }
      return (rank[b.severity] || 0) - (rank[a.severity] || 0)
    })
  }, [siteRows, groupRows, dashboardData])

  const alerts = alertItems
  const alertCounts = useMemo(() => ({
    critical: alerts.filter((a) => a.severity === 'critical').length,
    medium: alerts.filter((a) => a.severity === 'medium').length,
    low: alerts.filter((a) => a.severity === 'low').length,
  }), [alerts])

  const renderAlertSubtitle = (subtitle) => {
    if (!subtitle) return null
    // Polarité de couleur : pour l'autonomie, ▼ (moins d'heures) est le sens
    // défavorable ; pour l'écart de consommation groupe (déduite vs réellement
    // évaluée), c'est ▲ (déduite > réelle, carburant manquant non expliqué par le
    // fonctionnement du groupe) qui est défavorable — l'inverse.
    const isConsumptionGap = subtitle.includes('Écart de')
    const parts = subtitle.split(/(▲[\d.]+%|▼[\d.]+%)/)
    return parts.map((part, i) => {
      const arrowMatch = part.match(/^(▲|▼)([\d.]+%)$/)
      if (arrowMatch) {
        const arrowIsUp = arrowMatch[1] === '▲'
        const isBad = isConsumptionGap ? arrowIsUp : !arrowIsUp
        return (
          <span key={i} style={{ color: isBad ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
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
        <PageLoader label="Préparation du tableau de bord…" />
      </div>
    )
  }

  return (
    <div className="app-shell dashboard-shell">
      <Topbar activeView="dashboard" onNavigate={onNavigate} />

      <PageEnter>
      <main className="dashboard-grid dashboard-grid-4col">
        <WelcomeBanner
          subtitle="Stocks, alertes et consommations — l’essentiel pour décider vite."
        />
        <div className="dashboard-summary-grid">
          {summaryCards.map((card) => (
            <article key={card.label} className="metric-panel dashboard-summary-card">
              <div className="summary-card-header">
                <span className="metric-label">{card.label}</span>
                {card.deviation ? (
                  <span className={`summary-trend ${card.deviation.isNegative ? 'negative' : 'positive'}`}>
                    <span className="summary-trend-arrow">{card.deviation.isNegative ? '▼' : '▲'}</span>
                    {card.deviation.text}
                  </span>
                ) : null}
              </div>
              <h3>{card.title}</h3>
              <p>{card.detail}</p>
            </article>
          ))}
        </div>

        {/* 1. Sites à faible autonomie */}
        <section className="dashboard-table metric-panel">
          <div className="metric-title-row">
            <div>
              <span className="metric-label">Priorité stock</span>
              <h3>Sites bientôt à sec</h3>
            </div>
          </div>
          <div className="dashboard-table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Site</th>
                  <th style={{ textAlign: 'right' }}>Dernier stock</th>
                  <th style={{ textAlign: 'center' }}>Temps restant</th>
                </tr>
              </thead>
              <tbody>
                {lowAutonomySiteRows.map((row) => {
                  const severity = getAutonomySeverity(row)
                  const level = severity === 'critical' ? 'critical' : severity === 'medium' ? 'medium' : 'low'
                  return (
                    <tr key={row.id} className={`autonomy-row autonomy-row--${level}`}>
                      <td style={{ textAlign: 'left' }}>{row.site_name || row.label}</td>
                      <td style={{ textAlign: 'right' }}>{formatValue(row.latest_volume, ' L')}</td>
                      <td style={{ textAlign: 'center' }}>
                        <AutonomyBadge entity={row} size="sm" showLabel={false} />
                      </td>
                    </tr>
                  )
                })}
                {lowAutonomySiteRows.length === 0 && (
                  <tr>
                    <td colSpan="3" className="empty-state-cell">
                      Aucun site en tension pour le moment
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 2. Groupes à consommation anormale */}
        <section className="dashboard-table metric-panel">
          <div className="metric-title-row">
            <div>
              <span className="metric-label">Anomalies</span>
              <h3>Écart de consommation horaire</h3>
            </div>
          </div>
          <div className="dashboard-table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Groupe</th>
                  <th style={{ textAlign: 'left' }}>Site</th>
                  <th style={{ textAlign: 'right' }}>Consommation horaire moyenne (L/h)</th>
                  <th style={{ textAlign: 'right' }}>Consommation horaire semaine N (L/h)</th>
                  <th style={{ textAlign: 'center' }}>Écart</th>
                </tr>
              </thead>
              <tbody>
                {abnormalGroupRows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ textAlign: 'left' }}>{row.label}</td>
                    <td style={{ textAlign: 'left' }}>{row.site_name || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <strong className="text-danger">
                        {formatValue(row.mean_hourly_consumption_deduite, ' L/h')}
                      </strong>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {row.latest_hourly_consumption == null
                        ? <span title="Consommation sans delta horaire">Non dispo.</span>
                        : formatValue(row.latest_hourly_consumption, ' L/h')}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {renderDeviation(row.mean_hourly_consumption_deduite, row.latest_hourly_consumption, '—')}
                    </td>
                  </tr>
                ))}
                {abnormalGroupRows.length === 0 && (
                  <tr>
                    <td colSpan="5" className="empty-state-cell">
                      Aucune anomalie détectée
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 3. Groupes les plus gourmands */}
        <section className="dashboard-table metric-panel">
          <div className="metric-title-row">
            <div>
              <span className="metric-label">Consommation</span>
              <h3>Groupes à plus forte consommation</h3>
            </div>
          </div>
          <div className="dashboard-table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Groupe</th>
                  <th style={{ textAlign: 'left' }}>Site</th>
                  <th style={{ textAlign: 'right' }}>Consommation moyenne</th>
                  <th style={{ textAlign: 'right' }}>Consommation semaine N</th>
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
                    <td style={{ textAlign: 'center' }}>{renderConsumptionGapVsLatest(row.latest_consumption, row.avg_consumption, '—')}</td>
                  </tr>
                ))}
                {topConsumerGroupRows.length === 0 && (
                  <tr>
                    <td colSpan="5" className="empty-state-cell">
                      Aucun groupe disponible
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 4. Sites les plus gourmands (simplifié) */}
        <section className="dashboard-table metric-panel">
          <div className="metric-title-row">
            <div>
              <span className="metric-label">Consommation</span>
              <h3>Sites à plus forte consommation</h3>
            </div>
          </div>
          <div className="dashboard-table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Site</th>
                  <th style={{ textAlign: 'right' }}>Consommation moyenne</th>
                  <th style={{ textAlign: 'right' }}>Consommation semaine N</th>
                  <th style={{ textAlign: 'center' }}>Écart</th>
                </tr>
              </thead>
              <tbody>
                {topConsumerSiteRows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ textAlign: 'left' }}>{row.site_name || row.label}</td>
                    <td style={{ textAlign: 'right' }}><strong>{formatValue(row.avg_consumption, ' L')}</strong></td>
                    <td style={{ textAlign: 'right' }}>{formatValue(row.latest_consumption, ' L')}</td>
                    <td style={{ textAlign: 'center' }}>{renderDeviation(row.avg_consumption, siteAverageConsumption, '—')}</td>
                  </tr>
                ))}
                {topConsumerSiteRows.length === 0 && (
                  <tr>
                    <td colSpan="4" className="empty-state-cell">
                      Aucun site disponible
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Notifications d'alertes en bas */}
        <section className="dashboard-alerts metric-panel" style={{ gridColumn: '1 / -1' }}>
          <div className="metric-title-row alert-section-head">
            <div>
              <span className="metric-label">À traiter</span>
              <h3>
                {alerts.length
                  ? (alertCounts.critical > 0 ? 'Des actions sont nécessaires' : 'Points à surveiller')
                  : 'Tout est sous contrôle'}
              </h3>
            </div>
            {alerts.length > 0 && (
              <div className="alert-legend" aria-label="Niveaux d’alerte">
                <span className="alert-legend-item alert-legend--critical">
                  Urgent <strong>{alertCounts.critical}</strong>
                </span>
                <span className="alert-legend-item alert-legend--medium">
                  À surveiller <strong>{alertCounts.medium}</strong>
                </span>
                <span className="alert-legend-item alert-legend--low">
                  Attention <strong>{alertCounts.low}</strong>
                </span>
              </div>
            )}
          </div>
          <div className="alert-list">
            {alerts.length ? alerts.map((alert) => {
              const severity = alert.severity || normalizeAlertSeverity(alert).level
              const label = alert.priority || SEVERITY_META[severity]?.label || 'Moyen'
              return (
                <div
                  key={alert.id}
                  className={`alert-item alert-${severity}`}
                  data-severity={severity}
                >
                  <div className="alert-severity-bar" aria-hidden="true" />
                  <div className="alert-header">
                    <div className="alert-title-wrap">
                      <span className={`alert-level-tag alert-level-tag--${severity}`}>
                        Niveau {label}
                      </span>
                      <strong>{alert.title}</strong>
                    </div>
                    <span className={`alert-badge alert-badge-${severity}`}>
                      <span className="alert-badge-text">{label}</span>
                    </span>
                  </div>
                  <p>
                    {alert.is_infinite_consumption && (
                      <span className="alert-anomaly-prefix">Anomalie :</span>
                    )}
                    {renderAlertSubtitle(alert.subtitle)}
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
              )
            }) : (
              <div className="alert-empty">Aucune alerte majeure détectée pour le moment.</div>
            )}
          </div>
        </section>
      </main>
      </PageEnter>
    </div>
  )
}

export default DashboardPage