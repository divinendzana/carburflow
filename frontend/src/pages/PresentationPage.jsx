import React, { useEffect, useState } from 'react'
import Topbar from '../components/Topbar.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { apiFetch } from '../auth.js'

function PresentationPage({ onNavigate }) {
  const { isAuthenticated, isAdmin } = useAuth()
  const [siteCount, setSiteCount] = useState(null)
  const [groupCount, setGroupCount] = useState(null)
  const [lastReportLabel, setLastReportLabel] = useState('')

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return

    const loadOverviewData = async () => {
      try {
        const [siteData, etatCuvesData] = await Promise.all([
          apiFetch('/api/v1/sites'),
          apiFetch('/api/v1/dashboard/etat_cuves'),
        ])

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
  }, [isAuthenticated, isAdmin])

  return (
    <div className="app-shell">
      <Topbar activeView="presentation" onNavigate={onNavigate} />
      <main className="content-grid">
        <section className="hero-panel">
          <div className="hero-copy">
            <span className="eyebrow">CarburFlow</span>
            <h1>Supervision du carburant dans les sites</h1>
            <p>
              Plateforme de suivi et de pilotage des sites, groupes électrogènes et niveaux de stock.
              Les opérateurs déposent leurs relevés ; les administrateurs pilotent les alertes et analyses.
            </p>
          </div>

          <div className="hero-stats">
            {isAuthenticated && isAdmin ? (
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-card-label">Sites actifs</div>
                  <div className="stat-card-value">{siteCount ?? '—'}</div>
                  <div className="stat-card-sub">Sites monitorés</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">Groupes suivis</div>
                  <div className="stat-card-value">{groupCount ?? '—'}</div>
                  <div className="stat-card-sub">Groupes électrogènes</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">Dernier rapport</div>
                  <div className="stat-card-value">{lastReportLabel || '—'}</div>
                  <div className="stat-card-sub">Période disponible</div>
                </div>
              </div>
            ) : (
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-card-label">Admin</div>
                  <div className="stat-card-value">Pilotage</div>
                  <div className="stat-card-sub">Dashboard, alertes, sites</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">Opérateur</div>
                  <div className="stat-card-value">Relevés</div>
                  <div className="stat-card-sub">Norme Excel / CSV</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">Norme</div>
                  <div className="stat-card-value">.xlsx</div>
                  <div className="stat-card-sub">Convertible en CSV</div>
                </div>
              </div>
            )}

            <div className="hero-actions">
              {isAuthenticated && isAdmin ? (
                <>
                  <button type="button" className="btn-primary" onClick={() => onNavigate('dashboard')}>
                    Ouvrir le dashboard
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => onNavigate('reports')}>
                    Voir les rapports
                  </button>
                </>
              ) : isAuthenticated ? (
                <button type="button" className="btn-primary" onClick={() => onNavigate('reports')}>
                  Aller aux rapports
                </button>
              ) : (
                <>
                  <button type="button" className="btn-primary" onClick={() => onNavigate('login')}>
                    Se connecter
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => onNavigate('register')}>
                    Créer un compte
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default PresentationPage
