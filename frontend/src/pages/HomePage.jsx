import React, { useEffect, useState } from 'react'
import Topbar from '../components/Topbar.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { apiFetch } from '../auth.js'

const STEPS = [
  {
    num: '01',
    title: 'Relever sur le terrain',
    text: 'L’opérateur complète la norme Excel ou CSV, une ligne par cuve et groupe.',
  },
  {
    num: '02',
    title: 'Déposer le rapport',
    text: 'Le fichier est importé en quelques secondes, avec historique des envois.',
  },
  {
    num: '03',
    title: 'Piloter les stocks',
    text: 'L’admin voit les niveaux, les alertes et la consommation sur tous les sites.',
  },
]

function HomePage({ onNavigate }) {
  const { isAuthenticated, isAdmin } = useAuth()
  const [siteCount, setSiteCount] = useState(null)
  const [groupCount, setGroupCount] = useState(null)
  const [lastReportLabel, setLastReportLabel] = useState('')

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return

    const loadOverviewData = async () => {
      try {
        const overviewData = await apiFetch('/api/v1/dashboard/overview')
        setSiteCount(Array.isArray(overviewData.sites) ? overviewData.sites.length : 0)
        setGroupCount(Array.isArray(overviewData.groups) ? overviewData.groups.length : 0)
        if (Array.isArray(overviewData.reports) && overviewData.reports.length > 0) {
          const last = overviewData.reports[overviewData.reports.length - 1]
          setLastReportLabel(last.label || '—')
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
        {/* Section Hero adaptée au style existant */}
        <section className="hero-panel">
          <div className="hero-copy">
            <span className="eyebrow">CarburFlow Mark</span>
            <h1>Le carburant de vos sites, enfin sous contrôle.</h1>
            <p className="landing-lead">
              Suivez les stocks, déposez les relevés Excel et pilotez chaque site sans tableurs dispersés.
            </p>

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

          <div className="hero-stats-wrap" style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
            {/* Si admin connecté, on montre les stats dynamiques à côté de la cuve */}
            {isAuthenticated && isAdmin ? (
              <div className="stat-grid" style={{ width: '100%' }}>
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
            ) : null}

            {/* La cuve interactive (tank) */}
            <div className="hero-tank-container">
              <div className="hero-tank">
                <div className="hero-tank-shell">
                  <div className="hero-tank-fluid">
                    <span className="hero-tank-wave" />
                  </div>
                  <div className="hero-tank-marks">
                    <span>100</span>
                    <span>75</span>
                    <span>50</span>
                    <span>25</span>
                  </div>
                </div>
                <div className="hero-tank-caption">
                  <strong>72 %</strong>
                  <span>niveau moyen des cuves</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section flux terrain */}
        <section className="landing-section">
          <div className="landing-section-head">
            <h2>Du terrain au tableau de bord</h2>
            <p>Trois gestes simples, un flux unique pour toute l’équipe.</p>
          </div>
          <ol className="landing-steps">
            {STEPS.map((step) => (
              <li key={step.num} className="landing-step">
                <span className="landing-step-num">{step.num}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Section des rôles */}
        <section className="landing-section">
          <div className="landing-section-head">
            <h2>Deux rôles, une même plateforme</h2>
            <p>Chacun voit exactement ce dont il a besoin.</p>
          </div>
          <div className="landing-roles-grid">
            <article className="landing-role">
              <h3>Administrateur</h3>
              <p>
                Tableau de bord, sites, cuves, groupes et vision globale des rapports déposés.
              </p>
              <button type="button" className="text-btn" onClick={() => onNavigate('login')}>
                Connexion admin →
              </button>
            </article>
            <article className="landing-role">
              <h3>Opérateur</h3>
              <p>
                Télécharge la norme, remplit le relevé et dépose le fichier Excel ou CSV en quelques clics.
              </p>
              <button type="button" className="text-btn" onClick={() => onNavigate('register')}>
                Créer un compte →
              </button>
            </article>
          </div>
        </section>

        {/* Bandeau de fin d'inscription/connexion (si non connecté) */}
        {!isAuthenticated && (
          <section className="landing-cta-band">
            <h2>Reprenez la main sur vos stocks</h2>
            <p>Connectez-vous pour piloter, ou créez un compte opérateur pour envoyer votre premier rapport.</p>
            <div className="landing-cta-row landing-cta-row-center">
              <button type="button" className="btn-primary" onClick={() => onNavigate('login')}>
                Accéder à CarburFlow
              </button>
              <button type="button" className="btn-ghost landing-cta-ghost" onClick={() => onNavigate('register')}>
                S’inscrire
              </button>
            </div>
          </section>
        )}
      </main>

      <footer className="landing-footer">
        <span className="landing-footer-copy">© {new Date().getFullYear()} — Gestion de carburant multi-sites</span>
      </footer>
    </div>
  )
}

export default HomePage
