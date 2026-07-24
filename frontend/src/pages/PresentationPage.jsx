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
      </main>
    </div>
  )
}

export default PresentationPage
