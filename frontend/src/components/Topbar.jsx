import React from 'react'
import logo from '../../../logo/logo_clair_navbar.jpeg'
import { useAuth } from '../context/AuthContext.jsx'

function Topbar({ activeView, onNavigate }) {
  const { isAuthenticated, isAdmin, logout } = useAuth()

  return (
    <header className="topbar">
      <div className="brand-wrap">
        <img src={logo} alt="Logo CarburFlow" className="brand-logo" />
        <div className="brand-text">
          <span className="brand-name">CarburFlow</span>
          <span className="brand-subtitle">Dashboard de suivi carburant</span>
        </div>
      </div>

      <nav className="topbar-actions" aria-label="Navigation principale">
        {!isAuthenticated ? (
          <>
            <button
              type="button"
              className={`nav-link ${activeView === 'presentation' ? 'active' : ''}`}
              onClick={() => onNavigate('home')}
            >
              Home
            </button>
            <button
              type="button"
              className={`nav-link ${activeView === 'login' ? 'active' : ''}`}
              onClick={() => onNavigate('login')}
            >
              Connexion
            </button>
          </>
        ) : isAdmin ? (
          <>
            <button
              type="button"
              className={`nav-link ${activeView === 'presentation' ? 'active' : ''}`}
              onClick={() => onNavigate('home')}
            >
              Home
            </button>
            <button
              type="button"
              className={`nav-link ${activeView === 'dashboard' ? 'active' : ''}`}
              onClick={() => onNavigate('dashboard')}
            >
              Dashboard
            </button>
            <button
              type="button"
              className={`nav-link ${activeView === 'sites' ? 'active' : ''}`}
              onClick={() => onNavigate('sites')}
            >
              Sites
            </button>
            <button
              type="button"
              className={`nav-link ${activeView === 'groups' ? 'active' : ''}`}
              onClick={() => onNavigate('groups')}
            >
              Groupes
            </button>
            <button
              type="button"
              className={`nav-link ${activeView === 'reports' ? 'active' : ''}`}
              onClick={() => onNavigate('reports')}
            >
              Import
            </button>
            <button
              type="button"
              className="nav-link"
              onClick={logout}
            >
              Déconnexion
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`nav-link ${activeView === 'reports' ? 'active' : ''}`}
              onClick={() => onNavigate('reports')}
            >
              Import
            </button>
            <button
              type="button"
              className="nav-link"
              onClick={logout}
            >
              Déconnexion
            </button>
          </>
        )}
      </nav>
    </header>
  )
}

export default Topbar
