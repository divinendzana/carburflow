import { useEffect, useState } from 'react'
import Topbar from '../components/Topbar'
import { DemoBanner } from '../components/PageState'
import { fetchEtatCuves, fetchSiteCount } from '../lib/api'
import { fmt, fmtInt, fmtDate } from '../lib/format'

export default function PresentationPage({ onNavigate }) {
  const [overview, setOverview] = useState(null)
  const [demo, setDemo] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [siteCount, etatCuves] = await Promise.all([fetchSiteCount(), fetchEtatCuves()])
      if (cancelled) return

      const rapport = etatCuves.data.dernier_rapport
      setOverview({
        siteCount: siteCount.data,
        groupCount: etatCuves.data.groupes_count ?? 0,
        lastReportLabel: rapport?.date_debut && rapport?.date_fin
          ? `${fmtDate(rapport.date_debut)} → ${fmtDate(rapport.date_fin)}`
          : fmtDate(rapport?.date_fin),
        totalVolume: etatCuves.data.total_volume_global,
        globalPct: etatCuves.data.global_pct,
      })
      setDemo(siteCount.demo || etatCuves.demo)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="app-shell">
      <Topbar activeView="presentation" onNavigate={onNavigate} />
      <DemoBanner visible={demo} />

      <main className="content-grid">
        <section className="hero-panel">
          <div className="hero-copy">
            <span className="eyebrow">Vision globale</span>
            <h1>Supervision du carburant dans les sites</h1>
            <p>
              Plateforme de suivi et de pilotage des sites, groupes électrogènes et niveaux de stock.
              Centralisez les relevés hebdomadaires, visualisez les niveaux de cuves en temps réel et
              détectez les anomalies de consommation avant la panne sèche.
            </p>
            <div className="hero-actions">
              <button type="button" className="btn-primary" onClick={() => onNavigate('dashboard')}>
                Voir le dashboard
              </button>
              <button type="button" className="btn-ghost" onClick={() => onNavigate('site')}>
                Parcourir les sites
              </button>
            </div>
          </div>

          <div className="hero-stats">
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-card-label">Sites actifs</div>
                <div className="stat-card-value">{overview ? fmtInt(overview.siteCount) : '—'}</div>
                <div className="stat-card-sub">Nombre de sites monitorés</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Groupes suivis</div>
                <div className="stat-card-value">{overview ? fmtInt(overview.groupCount) : '—'}</div>
                <div className="stat-card-sub">Groupes électrogènes couverts</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Dernier rapport</div>
                <div className="stat-card-value stat-card-value-small">{overview?.lastReportLabel || '—'}</div>
                <div className="stat-card-sub">Période du dernier relevé</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Stock global</div>
                <div className="stat-card-value">{overview ? fmt(overview.totalVolume, 'L') : '—'}</div>
                <div className="stat-card-sub">Volume total en cuves</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Remplissage global</div>
                <div className="stat-card-value">{overview ? fmt(overview.globalPct, '%') : '—'}</div>
                <div className="stat-card-sub">Toutes cuves confondues</div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
