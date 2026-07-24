import React, { useEffect, useState } from 'react'
import Topbar from '../components/Topbar.jsx'

function HomePage({ onNavigate }) {
  const [siteCount, setSiteCount] = useState(null)
  const [groupCount, setGroupCount] = useState(null)
  const [lastReportLabel, setLastReportLabel] = useState('')

  useEffect(() => {
    const loadOverviewData = async () => {
      try {
        const response = await fetch('/api/v1/dashboard/overview')
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const overviewData = await response.json()
        setSiteCount(overviewData.sites?.length ?? 0)
        setGroupCount(overviewData.groups?.length ?? 0)

        const lastReport = overviewData.reports?.[overviewData.reports.length - 1]
        if (lastReport?.label) {
          setLastReportLabel(lastReport.label)
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
              <button type="button" className="btn-ghost" onClick={() => onNavigate('sites')}>Parcourir les sites</button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default HomePage
