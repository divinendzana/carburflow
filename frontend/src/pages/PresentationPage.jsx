<<<<<<< HEAD
import React, { useEffect, useState } from 'react'
import Topbar from '../components/Topbar.jsx'

function PresentationPage({ onNavigate }) {
  const [siteCount, setSiteCount] = useState(null)
  const [groupCount, setGroupCount] = useState(null)
  const [lastReportLabel, setLastReportLabel] = useState('')

  useEffect(() => {
    const loadOverviewData = async () => {
      try {
        const [siteResponse, etatCuvesResponse] = await Promise.all([
          fetch('/api/v1/sites?limit=1'),
          fetch('/api/v1/dashboard/etat_cuves'),
        ])

        const siteData = await siteResponse.json()
        const etatCuvesData = await etatCuvesResponse.json()

        const count = typeof siteData.count === 'number'
          ? siteData.count
          : Array.isArray(siteData)
            ? siteData.length
            : typeof siteData.results?.length === 'number'
              ? siteData.results.length
              : 0
        setSiteCount(count)
        setGroupCount(etatCuvesData.groupes_count ?? 0)

        if (etatCuvesData.dernier_rapport?.date_debut && etatCuvesData.dernier_rapport?.date_fin) {
          setLastReportLabel(`${new Date(etatCuvesData.dernier_rapport.date_debut).toLocaleDateString('fr-FR')} → ${new Date(etatCuvesData.dernier_rapport.date_fin).toLocaleDateString('fr-FR')}`)
        } else if (etatCuvesData.dernier_rapport?.date_fin) {
          setLastReportLabel(new Date(etatCuvesData.dernier_rapport.date_fin).toLocaleDateString('fr-FR'))
        }
      } catch (error) {
        console.warn('Unable to load presentation overview data', error)
      }
    }

    loadOverviewData()
  }, [])

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
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-card-label">Sites actifs</div>
                <div className="stat-card-value">{siteCount ?? '—'}</div>
                <div className="stat-card-sub">Nombre de sites monitorés</div>
              </div>

              <div className="stat-card">
                <div className="stat-card-label">Groupes suivis</div>
                <div className="stat-card-value">{groupCount ?? '—'}</div>
                <div className="stat-card-sub">Groupes électrogènes couverts</div>
              </div>

              <div className="stat-card">
                <div className="stat-card-label">Dernier rapport</div>
                <div className="stat-card-value">{lastReportLabel || '—'}</div>
                <div className="stat-card-sub">Date du dernier rapport disponible</div>
              </div>
            </div>

            <div className="hero-actions">
              <button type="button" className="btn-primary" onClick={() => onNavigate('dashboard')}>Voir le dashboard</button>
              <button type="button" className="btn-ghost" onClick={() => onNavigate('site')}>Parcourir les sites</button>
            </div>
          </div>
        </section>
=======
import { useEffect, useState } from 'react'
import Topbar from '../components/Topbar'
import { DemoBanner, LoadingState } from '../components/PageState'
import { BarChart } from '../components/ChartCanvas'
import { fetchAlertes, fetchDashboardMetrics, fetchSiteCount } from '../lib/api'
import { fmt, fmtInt, fmtDate } from '../lib/format'

function fillTone(pct) {
  if (pct >= 50) return 'ok'
  if (pct >= 20) return 'warn'
  return 'danger'
}

function autonomyTone(days) {
  if (days == null) return 'ok'
  if (days < 30) return 'danger'
  if (days < 60) return 'warn'
  return 'ok'
}

export default function PresentationPage({ onNavigate }) {
  const [data, setData] = useState(null)
  const [demo, setDemo] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchSiteCount(), fetchDashboardMetrics(), fetchAlertes()]).then(([sites, metrics, alerts]) => {
      if (cancelled) return
      const etat = metrics.data.etatCuves
      const conso = metrics.data.consommation
      const rapport = etat.dernier_rapport
      setData({
        siteCount: sites.data,
        groupCount: etat.groupes_count ?? 0,
        stock: etat.total_volume_global,
        capacity: etat.total_capacity_global || metrics.data.evolutionVolumes.total_capacity,
        fillPct: etat.global_pct,
        lastReport: rapport?.date_debut && rapport?.date_fin
          ? `${fmtDate(rapport.date_debut)} → ${fmtDate(rapport.date_fin)}`
          : fmtDate(rapport?.date_fin),
        weeklyConso: conso.latest_total_liters ?? conso.global_consumption?.at(-1),
        hours: metrics.data.horairesGroupes.latest_total_hours ?? metrics.data.horairesGroupes.global_hours?.at(-1),
        alertes: alerts.data,
      })
      setDemo(sites.demo || metrics.demo || alerts.demo)
    })
    return () => { cancelled = true }
  }, [])

  if (!data) {
    return (
      <div className="app-shell">
        <Topbar activeView="presentation" onNavigate={onNavigate} />
        <main className="page-stack">
          <LoadingState label="Préparation du tableau stratégique…" />
        </main>
      </div>
    )
  }

  const { alertes } = data
  const autonomy = alertes.global_autonomy_days
  const aTone = autonomyTone(autonomy)
  const critical = alertes.critical || []
  const significant = alertes.significant || []
  const top = (alertes.top_consumers || []).slice(0, 5)

  return (
    <div className="app-shell home-shell">
      <Topbar activeView="presentation" onNavigate={onNavigate} />
      <DemoBanner visible={demo} />

      <main className="page-stack strategic-home">
        <header className="strategic-head">
          <div>
            <p className="brand-hero brand-hero-sm">CarburFlow</p>
            <h1 className="page-title">Situation stratégique</h1>
            <p className="page-description">
              Les informations capitales d’abord : autonomie, alertes, stock. Le détail analytique est dans la vue d’ensemble.
            </p>
          </div>
          <p className="strategic-period">Dernier relevé · {data.lastReport || '—'}</p>
        </header>

        {/* AUTONOMIE — information capitale */}
        <section className={`autonomy-hero autonomy-${aTone}`} aria-label="Autonomie globale">
          <div className="autonomy-hero-copy">
            <span className="eyebrow">Information capitale</span>
            <h2>Autonomie restante</h2>
            <p>Combien de jours avant la panne sèche, au rythme actuel, tous sites confondus.</p>
          </div>
          <div className="autonomy-hero-value">
            <strong>{autonomy != null ? fmt(autonomy) : '∞'}</strong>
            <span>jours</span>
          </div>
          <div className="autonomy-hero-meta">
            <div>
              <span>Stock disponible</span>
              <strong>{fmt(data.stock, 'L')}</strong>
            </div>
            <div>
              <span>Conso. journalière</span>
              <strong>{fmt(alertes.daily_consumption, 'L/j')}</strong>
            </div>
            <div>
              <span>Remplissage</span>
              <strong className={`text-${fillTone(data.fillPct)}`}>{fmt(data.fillPct, '%')}</strong>
            </div>
          </div>
        </section>

        {/* ALERTES + ACTIONS */}
        <section className="strategic-grid">
          <article className="strategic-card strategic-alerts">
            <div className="strategic-card-head">
              <h2>Alertes à traiter</h2>
              <button type="button" className="btn-ghost btn-sm" onClick={() => onNavigate('alertes')}>
                Tout voir →
              </button>
            </div>
            <div className="alert-count-row">
              <button type="button" className="alert-count danger" onClick={() => onNavigate('alertes')}>
                <strong>{fmtInt(critical.length)}</strong>
                <span>critiques (&lt; 20 %)</span>
              </button>
              <button type="button" className="alert-count warn" onClick={() => onNavigate('alertes')}>
                <strong>{fmtInt(significant.length)}</strong>
                <span>à surveiller</span>
              </button>
            </div>
            <ul className="strategic-list">
              {[...critical, ...significant].slice(0, 4).map((item) => (
                <li key={item.label}>
                  <span className={`pill pill-${item.level === 'critical' ? 'danger' : 'warn'}`}>
                    {fmt(item.pct, '%')}
                  </span>
                  <span>{item.label}</span>
                </li>
              ))}
              {!critical.length && !significant.length && (
                <li className="strategic-empty">Aucune alerte — stock sous contrôle.</li>
              )}
            </ul>
          </article>

          <article className="strategic-card">
            <div className="strategic-card-head">
              <h2>Chiffres clés</h2>
            </div>
            <div className="key-figures">
              <div>
                <span>Sites</span>
                <strong>{fmtInt(data.siteCount)}</strong>
              </div>
              <div>
                <span>Groupes</span>
                <strong>{fmtInt(data.groupCount)}</strong>
              </div>
              <div>
                <span>Conso. (dernier relevé)</span>
                <strong>{fmt(data.weeklyConso, 'L')}</strong>
              </div>
              <div>
                <span>Heures de marche</span>
                <strong>{fmt(data.hours, 'h')}</strong>
              </div>
              <div>
                <span>Capacité installée</span>
                <strong>{fmt(data.capacity, 'L')}</strong>
              </div>
              <div>
                <span>Stock / capacité</span>
                <strong>{fmt(data.stock, 'L')} · {fmt(data.fillPct, '%')}</strong>
              </div>
            </div>
          </article>
        </section>

        <section className="strategic-grid strategic-grid-2">
          <article className="strategic-card">
            <div className="strategic-card-head">
              <h2>Sites les plus gourmands</h2>
              <button type="button" className="btn-ghost btn-sm" onClick={() => onNavigate('dashboard')}>
                Analyser →
              </button>
            </div>
            {top.length ? (
              <BarChart
                labels={top.map((item) => item.site)}
                datasets={[{
                  label: 'Consommation',
                  data: top.map((item) => item.consumption),
                  backgroundColor: top.map((_, i) => (i === 0 ? '#c23b3b' : '#e8a317')),
                }]}
                unit="L"
                horizontal
                height={Math.max(180, top.length * 42)}
              />
            ) : (
              <p className="strategic-empty">Pas encore assez de relevés.</p>
            )}
            <ul className="strategic-list compact">
              {top.map((item, index) => (
                <li key={item.site}>
                  <span className="rank">#{index + 1}</span>
                  <span>{item.site}</span>
                  <strong>{fmt(item.consumption, 'L')}</strong>
                  <em>autonomie {item.autonomy_days != null ? fmt(item.autonomy_days, 'j') : '∞'}</em>
                </li>
              ))}
            </ul>
          </article>

          <article className="strategic-card strategic-cta-card">
            <h2>Aller plus loin</h2>
            <p>La vue d’ensemble et les pages Sites / Cuves / Groupes servent à creuser. L’accueil garde uniquement le capital.</p>
            <div className="cta-stack">
              <button type="button" className="btn-primary" onClick={() => onNavigate('dashboard')}>
                Analyses & graphiques
              </button>
              <button type="button" className="btn-ghost" onClick={() => onNavigate('groups')}>
                Autonomie des groupes
              </button>
              <button type="button" className="btn-ghost" onClick={() => onNavigate('alertes')}>
                Centre d’alertes
              </button>
            </div>
          </article>
        </section>
>>>>>>> ca3bd4de8a234e2cd373acff4e527b51d19ddaa7
      </main>
    </div>
  )
}
<<<<<<< HEAD

export default PresentationPage
=======
>>>>>>> ca3bd4de8a234e2cd373acff4e527b51d19ddaa7
