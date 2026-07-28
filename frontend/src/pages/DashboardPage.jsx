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
    || raw === 'attention'
    || label.includes('faible')
    || label.includes('attention')
  ) return SEVERITY_META.low
  return SEVERITY_META.medium
}

function DashboardPage({ onNavigate }) {
  const [dashboardData, setDashboardData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [alertFilter, setAlertFilter] = useState('all')

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

  // Écart pour "Groupes les plus gourmands" : (dernière conso - moyenne) / moyenne
  // En relatif à la moyenne — positif = dernière conso > moyenne, négatif = en dessous.
  const renderConsumptionGapVsAvg = (latest, avg, fallback = '—') => {
    if (latest == null || avg == null || avg === 0) return fallback
    const gapPct = Number((((latest - avg) / avg) * 100).toFixed(1))
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
        setLoadError('')
        const payload = await apiFetch('/api/v1/dashboard/overview')
        setDashboardData(payload)
      } catch (error) {
        console.warn('Dashboard API unavailable.', error)
        setDashboardData(null)
        setLoadError(error.message || 'Impossible de charger le tableau de bord.')
      }
    }

    loadDashboardData()
  }, [])

  const goSites = (site = {}) => {
    const siteId = site.id ?? site.site_id
    onNavigate?.({
      view: 'sites',
      siteId,
      siteName: site.site_name || site.label || site.nom_site,
      mode: site.mode || (siteId ? 'details' : 'all'),
    })
  }

  const goGroups = (group = {}) => {
    const groupId = group.id ?? group.group_id
    onNavigate?.({
      view: 'groups',
      groupId,
      groupLabel: group.label || group.group_label,
      mode: group.mode || (groupId ? 'details' : 'all'),
    })
  }

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
      is_abnormal: !!group.is_abnormal,
      is_infinite_consumption: !!group.is_infinite_consumption,
      has_anomaly: !!(group.has_anomaly || group.is_abnormal || group.is_infinite_consumption),
      ecart_pct: group.ecart_pct != null ? Number(group.ecart_pct) : (group.variance_pct != null ? Number(group.variance_pct) : 0),
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

  const getGroupEcartPct = (g) => {
    // Écart de conso horaire uniquement (pas de fallback volume / « Non dispo. »)
    if (!(g.latest_hours > 0) || !(g.latest_consumption > 0)) return null
    if (g.latest_hourly_consumption == null || !(g.mean_hourly_consumption_deduite > 0)) return null
    return Math.abs(
      ((g.latest_hourly_consumption - g.mean_hourly_consumption_deduite) / g.mean_hourly_consumption_deduite) * 100,
    )
  }

  const isConsSansDelta = (g) => g.latest_consumption > 0 && !(g.latest_hours > 0)
  const isEcartConso = (g) => {
    const ecart = getGroupEcartPct(g)
    return ecart != null && ecart > 15.0
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

    // Anomalies = conso sans delta ∪ écarts (même périmètre que les alertes)
    const abnormalGroups = new Set(
      groupRows.filter((g) => isConsSansDelta(g) || isEcartConso(g) || g.has_anomaly).map((g) => g.id),
    ).size
    const totalConsumption = dashboardData.summary?.total_consumption ?? 0
    const previousTotalConsumption = dashboardData.summary?.previous_total_consumption ?? null
    const totalRuntime = dashboardData.summary?.total_runtime ?? 0
    const previousTotalRuntime = dashboardData.summary?.previous_total_runtime ?? null

    const consumptionDeviation = getDeviation(totalConsumption, previousTotalConsumption)
    const runtimeDeviation = getDeviation(totalRuntime, previousTotalRuntime)

    return [
      {
        label: 'Sites urgents',
        title: `${criticalAutonomySites}`,
        detail: 'Moins de 24 h de temps restant',
        hrefHint: 'Voir les sites',
        open: () => goSites(),
      },
      {
        label: 'Anomalies groupes',
        title: `${abnormalGroups}`,
        detail: 'Écart L/h ou conso sans delta horaire',
        hrefHint: 'Voir les groupes',
        open: () => goGroups({ mode: 'details' }),
      },
      {
        label: 'Consommation',
        title: formatValue(totalConsumption, ' L'),
        detail: 'Semaine N (vs semaine N-1)',
        deviation: {
          value: consumptionDeviation,
          isNegative: consumptionDeviation !== null && consumptionDeviation < 0,
          text: consumptionDeviation == null ? '—' : `${Math.abs(consumptionDeviation).toFixed(1)}%`,
        },
      },
      {
        label: 'Delta horaire',
        title: formatValue(totalRuntime, ' h'),
        detail: 'Semaine N (vs semaine N-1)',
        deviation: {
          value: runtimeDeviation,
          isNegative: runtimeDeviation !== null && runtimeDeviation < 0,
          text: runtimeDeviation == null ? '—' : `${Math.abs(runtimeDeviation).toFixed(1)}%`,
        },
      },
    ]
  }, [dashboardData, groupRows, siteRows, onNavigate])

  // 1. Sites avec autonomie — tous, triés par ordre croissant (les plus urgents en premier)
  // 0h (consommation sans heures) passe en tête, ∞ (pas de données) est exclu
  const lowAutonomySiteRows = useMemo(() => {
    if (!siteRows.length) return []
    return [...siteRows]
      .filter((s) => {
        // Exclure les sites sans aucune donnée (∞)
        if (s.is_infinite_autonomy) return false
        // Garder les 0h (consommation avérée sans heures)
        if (s.is_infinite_consumption) return true
        // Garder tous les sites avec une autonomie finie
        return s.autonomie_hours != null
      })
      // 0h passe en tête (pire cas), puis tri croissant par autonomie
      .sort((a, b) => {
        const aKey = a.is_infinite_consumption ? -1 : (a.autonomie_hours ?? 999)
        const bKey = b.is_infinite_consumption ? -1 : (b.autonomie_hours ?? 999)
        return aKey - bKey
      })
      .slice(0, 8)
  }, [siteRows])

  // 2. Écarts de conso horaire > 15 % — hors « Non dispo. », |écart| décroissant
  const abnormalGroupRows = useMemo(() => {
    if (!groupRows.length) return []
    return [...groupRows]
      .filter((g) => isEcartConso(g))
      .map((g) => ({ ...g, _ecart: getGroupEcartPct(g) || 0 }))
      .sort((a, b) => (b._ecart || 0) - (a._ecart || 0))
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
    // --- CAS 1 : Sites à autonomie critique ou sous surveillance ---
    const autonomyAlerts = siteRows
      .flatMap((site) => {
        if (site.is_infinite_autonomy) return []

        if (site.is_infinite_consumption) {
          return [{
            id: `site-critique-0h-${site.id}`,
            type: 'critique',
            target: 'site',
            priority: 'Critique',
            priority_level: 'critical',
            severity: 'critical',
            site_id: site.id,
            site_name: site.site_name,
            title: `Site ${site.site_name} — autonomie critique : 0 h`,
            subtitle: `Consommation de carburant détectée (moy. ${site.avg_consumption.toFixed(1)} L) mais aucun delta horaire enregistré — temps restant indéterminé.`,
            is_infinite_consumption: true,
          }]
        }

        if (site.autonomie_hours == null) return []

        if (site.autonomie_hours < 48) {
          return [{
            id: `site-critique-${site.id}`,
            type: 'critique',
            target: 'site',
            priority: 'Critique',
            priority_level: 'critical',
            severity: 'critical',
            site_id: site.id,
            site_name: site.site_name,
            title: `Site ${site.site_name} — autonomie critique : ${site.formatted_autonomy || formatAutonomy(site.autonomie_hours)}`,
            subtitle: `Moins de 48 h de carburant restant (${site.formatted_autonomy || formatAutonomy(site.autonomie_hours)}). Stock actuel : ${site.latest_volume.toFixed(0)} L. Réapprovisionner de toute urgence.`,
            is_infinite_consumption: false,
          }]
        }

        if (site.autonomie_hours < 120) {
          return [{
            id: `site-faible-${site.id}`,
            type: 'alerte',
            target: 'site',
            priority: 'À surveiller',
            priority_level: 'medium',
            severity: 'medium',
            site_id: site.id,
            site_name: site.site_name,
            title: `Site ${site.site_name} — autonomie sous surveillance : ${site.formatted_autonomy || formatAutonomy(site.autonomie_hours)}`,
            subtitle: `Autonomie sous 5 jours (${site.formatted_autonomy || formatAutonomy(site.autonomie_hours)}). Stock actuel : ${site.latest_volume.toFixed(0)} L. Planifier un réapprovisionnement.`,
            is_infinite_consumption: false,
          }]
        }

        return []
      })

    // --- CAS 2 : Delta horaire sans consommation → Attention ---
    const groupWithHoursNoConsumption = groupRows
      .filter((g) => g.latest_hours > 0 && !(g.latest_consumption > 0))
      .map((g) => ({
        id: `group-hours-no-cons-${g.id}`,
        type: 'anomalie',
        target: 'groups',
        priority: 'Attention',
        priority_level: 'low',
        severity: 'low',
        group_id: g.id,
        group_label: g.label,
        site_name: g.site_name,
        title: `Groupe ${g.label} — delta horaire sans consommation (semaine N)`,
        subtitle: `Delta horaire semaine N : ${g.latest_hours.toFixed(1)} h — aucune consommation de carburant enregistrée (0 L). Vérifier la jauge et la saisie des consommations.`,
        is_infinite_consumption: false,
        ecart_pct: 0,
      }))

    // --- CAS 3 : Consommation sans fonctionnement → Urgent ---
    const groupWithConsNoHours = groupRows
      .filter((g) => isConsSansDelta(g))
      .map((g) => ({
        id: `group-cons-no-hours-${g.id}`,
        type: 'anomalie',
        target: 'groups',
        priority: 'Urgent',
        priority_level: 'critical',
        severity: 'critical',
        group_id: g.id,
        group_label: g.label,
        site_name: g.site_name,
        title: `Groupe ${g.label} — consommation sans fonctionnement (semaine N)`,
        subtitle: `Consommation enregistrée en semaine N : ${g.latest_consumption.toFixed(1)} L — mais aucun delta horaire (0 h). Le groupe a consommé du carburant sans tourner.`,
        is_infinite_consumption: true,
        ecart_pct: 0,
      }))

    // --- CAS 4 : Écarts de conso horaire > 15% — triés par |écart| décroissant ---
    const groupWithHighVariance = groupRows
      .filter((g) => isEcartConso(g))
      .map((g) => {
        const signedEcart = ((g.latest_hourly_consumption - g.mean_hourly_consumption_deduite) / g.mean_hourly_consumption_deduite) * 100
        const sign = signedEcart >= 0 ? '▲' : '▼'
        const absEcart = Math.abs(signedEcart).toFixed(1)
        return {
          id: `group-variance-${g.id}`,
          type: 'ecart',
          target: 'groups',
          priority: 'À surveiller',
          priority_level: 'medium',
          severity: 'medium',
          group_id: g.id,
          group_label: g.label,
          site_name: g.site_name,
          title: `Groupe ${g.label} — écart consommation horaire ${sign}${absEcart}% (semaine N)`,
          subtitle: `Consommation horaire semaine N : ${g.latest_hourly_consumption.toFixed(2)} L/h — Moyenne habituelle : ${g.mean_hourly_consumption_deduite.toFixed(2)} L/h — Écart : ${sign}${absEcart}%.`,
          is_infinite_consumption: false,
          ecart_pct: Math.abs(signedEcart),
        }
      })
      .sort((a, b) => (b.ecart_pct || 0) - (a.ecart_pct || 0))

    // Éliminer d'éventuels doublons par ID
    const alertMap = new Map()
    ;[...autonomyAlerts, ...groupWithConsNoHours, ...groupWithHoursNoConsumption, ...groupWithHighVariance].forEach((item) => {
      if (!alertMap.has(item.id)) alertMap.set(item.id, item)
    })

    const combined = Array.from(alertMap.values())

    return combined.sort((a, b) => {
      const rank = { critical: 3, medium: 2, low: 1 }
      const bySeverity = (rank[b.severity] || 0) - (rank[a.severity] || 0)
      if (bySeverity !== 0) return bySeverity
      // À sévérité égale : écarts du plus grand au plus petit
      return (b.ecart_pct || 0) - (a.ecart_pct || 0)
    })
  }, [siteRows, groupRows, dashboardData])

  const alerts = alertItems
  const alertCounts = useMemo(() => ({
    critical: alerts.filter((a) => a.severity === 'critical').length,
    medium: alerts.filter((a) => a.severity === 'medium').length,
    low: alerts.filter((a) => a.severity === 'low').length,
  }), [alerts])

  const visibleAlerts = useMemo(() => {
    if (alertFilter === 'all') return alerts
    return alerts.filter((a) => a.severity === alertFilter)
  }, [alerts, alertFilter])

  const renderAlertSubtitle = (subtitle) => {
    if (!subtitle) return null
    // Colorisation des flèches ▲/▼ :
    // ▲ (augmentation de consommation) = rouge (#dc2626)
    // ▼ (diminution de consommation) = vert (#16a34a)
    const parts = subtitle.split(/(▲[\d.,]+%|▼[\d.,]+%)/)
    return parts.map((part, i) => {
      const arrowMatch = part.match(/^(▲|▼)([\d.,]+%)$/)
      if (arrowMatch) {
        const isUp = arrowMatch[1] === '▲'
        return (
          <span key={i} style={{ color: isUp ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
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
        {loadError ? (
          <div className="loading-state" style={{ marginTop: 24 }}>
            {loadError}
            <div style={{ marginTop: 12 }}>
              <button type="button" className="filter-submit" onClick={() => window.location.reload()}>
                Réessayer
              </button>
            </div>
          </div>
        ) : (
          <PageLoader label="Préparation du tableau de bord…" />
        )}
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
            <button
              key={card.label}
              type="button"
              className="metric-panel dashboard-summary-card dashboard-summary-card--link"
              onClick={card.open}
            >
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
              <span className="dashboard-card-cta">{card.hrefHint} →</span>
            </button>
          ))}
        </div>

        {/* 1. Sites à faible autonomie */}
        <section className="dashboard-table metric-panel">
          <div className="metric-title-row">
            <div>
              <span className="metric-label">Priorité stock</span>
              <h3>Sites bientôt à sec</h3>
            </div>
            <button type="button" className="dashboard-section-link" onClick={() => goSites()}>
              Ouvrir Sites →
            </button>
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
                    <tr
                      key={row.id}
                      className={`autonomy-row autonomy-row--${level} dashboard-row-link`}
                      onClick={() => goSites(row)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          goSites(row)
                        }
                      }}
                      tabIndex={0}
                      role="link"
                    >
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
            <button type="button" className="dashboard-section-link" onClick={() => goGroups({ mode: 'details' })}>
              Ouvrir Groupes →
            </button>
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
                  <tr
                    key={row.id}
                    className="dashboard-row-link"
                    onClick={() => goGroups(row)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        goGroups(row)
                      }
                    }}
                    tabIndex={0}
                    role="link"
                  >
                    <td style={{ textAlign: 'left' }}>{row.label}</td>
                    <td style={{ textAlign: 'left' }}>{row.site_name || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <strong className="text-danger">
                        {formatValue(row.mean_hourly_consumption_deduite, ' L/h')}
                      </strong>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {formatValue(row.latest_hourly_consumption, ' L/h')}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {renderDeviation(row.latest_hourly_consumption, row.mean_hourly_consumption_deduite, '—')}
                    </td>
                  </tr>
                ))}
                {abnormalGroupRows.length === 0 && (
                  <tr>
                    <td colSpan="5" className="empty-state-cell">
                      Aucun écart horaire au-dessus du seuil
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
            <button type="button" className="dashboard-section-link" onClick={() => goGroups()}>
              Ouvrir Groupes →
            </button>
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
                  <tr
                    key={row.id}
                    className="dashboard-row-link"
                    onClick={() => goGroups(row)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        goGroups(row)
                      }
                    }}
                    tabIndex={0}
                    role="link"
                  >
                    <td style={{ textAlign: 'left' }}>{row.label}</td>
                    <td style={{ textAlign: 'left' }}>{row.site_name || '—'}</td>
                    <td style={{ textAlign: 'right' }}><strong>{formatValue(row.avg_consumption, ' L')}</strong></td>
                    <td style={{ textAlign: 'right' }}>{formatValue(row.latest_consumption, ' L')}</td>
                    <td style={{ textAlign: 'center' }}>{renderConsumptionGapVsAvg(row.latest_consumption, row.avg_consumption, '—')}</td>
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
            <button type="button" className="dashboard-section-link" onClick={() => goSites()}>
              Ouvrir Sites →
            </button>
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
                  <tr
                    key={row.id}
                    className="dashboard-row-link"
                    onClick={() => goSites(row)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        goSites(row)
                      }
                    }}
                    tabIndex={0}
                    role="link"
                  >
                    <td style={{ textAlign: 'left' }}>{row.site_name || row.label}</td>
                    <td style={{ textAlign: 'right' }}><strong>{formatValue(row.avg_consumption, ' L')}</strong></td>
                    <td style={{ textAlign: 'right' }}>{formatValue(row.latest_consumption, ' L')}</td>
                    <td style={{ textAlign: 'center' }}>{renderConsumptionGapVsAvg(row.latest_consumption, row.avg_consumption, '—')}</td>
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
              <div className="alert-legend" role="tablist" aria-label="Filtrer les alertes">
                <button
                  type="button"
                  role="tab"
                  aria-selected={alertFilter === 'all'}
                  className={`alert-legend-item alert-legend--all${alertFilter === 'all' ? ' is-active' : ''}`}
                  onClick={() => setAlertFilter('all')}
                >
                  Tous <strong>{alerts.length}</strong>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={alertFilter === 'critical'}
                  className={`alert-legend-item alert-legend--critical${alertFilter === 'critical' ? ' is-active' : ''}`}
                  onClick={() => setAlertFilter('critical')}
                >
                  Urgent <strong>{alertCounts.critical}</strong>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={alertFilter === 'medium'}
                  className={`alert-legend-item alert-legend--medium${alertFilter === 'medium' ? ' is-active' : ''}`}
                  onClick={() => setAlertFilter('medium')}
                >
                  À surveiller <strong>{alertCounts.medium}</strong>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={alertFilter === 'low'}
                  className={`alert-legend-item alert-legend--low${alertFilter === 'low' ? ' is-active' : ''}`}
                  onClick={() => setAlertFilter('low')}
                >
                  Attention <strong>{alertCounts.low}</strong>
                </button>
              </div>
            )}
          </div>
          <div className="alert-list">
            {visibleAlerts.length ? visibleAlerts.map((alert) => {
              const severity = alert.severity || normalizeAlertSeverity(alert).level
              const label = alert.priority || SEVERITY_META[severity]?.label || 'Moyen'
              const openAlert = () => {
                if (!onNavigate) return
                if (alert.target === 'groups') {
                  goGroups({
                    id: alert.group_id,
                    label: alert.group_label,
                  })
                } else {
                  goSites({
                    id: alert.site_id,
                    site_name: alert.site_name,
                  })
                }
              }
              return (
                <button
                  key={alert.id}
                  type="button"
                  className={`alert-item alert-${severity} alert-item--link`}
                  data-severity={severity}
                  onClick={openAlert}
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
                    {renderAlertSubtitle(alert.subtitle, alert.type)}
                    <span className="alert-more">Ouvrir →</span>
                  </p>
                </button>
              )
            }) : (
              <div className="alert-empty">
                {alerts.length
                  ? 'Aucune alerte pour ce niveau.'
                  : 'Aucune alerte majeure détectée pour le moment.'}
              </div>
            )}
          </div>
        </section>
      </main>
      </PageEnter>
    </div>
  )
}

export default DashboardPage