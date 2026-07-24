import React from 'react'
import logo from '../../../logo/logo_clair_navbar.jpeg'
import { useAuth } from '../context/AuthContext.jsx'

function Topbar({ activeView, onNavigate }) {
  const { user, isAuthenticated, isAdmin, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
    onNavigate('login')
  }

  return (
    <header className="topbar">
      <div className="brand-wrap">
        <img src={logo} alt="Logo CarburFlow" className="brand-logo" />
        <div className="brand-text">
          <span className="brand-name">CarburFlow</span>
          <span className="brand-subtitle">
            {isAdmin ? 'Pilotage carburant' : 'Envoi des relevés'}
          </span>
        </div>
      </div>

      <nav className="topbar-actions" aria-label="Navigation principale">
        {isAuthenticated && isAdmin && (
          <>
            <button type="button" className={`nav-link ${activeView === 'presentation' ? 'active' : ''}`} onClick={() => onNavigate('presentation')}>Accueil</button>
            <button type="button" className={`nav-link ${activeView === 'dashboard' ? 'active' : ''}`} onClick={() => onNavigate('dashboard')}>Dashboard</button>
            <button type="button" className={`nav-link ${activeView === 'sites' ? 'active' : ''}`} onClick={() => onNavigate('sites')}>Sites</button>
            <button type="button" className={`nav-link ${activeView === 'cuves' ? 'active' : ''}`} onClick={() => onNavigate('cuves')}>Cuves</button>
            <button type="button" className={`nav-link ${activeView === 'groups' ? 'active' : ''}`} onClick={() => onNavigate('groups')}>Groupes</button>
          </>
        )}

        {isAuthenticated && (
          <button type="button" className={`nav-link ${activeView === 'reports' ? 'active' : ''}`} onClick={() => onNavigate('reports')}>
            Rapports
          </button>
        )}

        {!isAuthenticated && (
          <button type="button" className={`nav-link ${activeView === 'presentation' ? 'active' : ''}`} onClick={() => onNavigate('presentation')}>
            Présentation
          </button>
        )}

        {isAuthenticated ? (
          <div className="topbar-user">
            <div className="topbar-user-meta">
              <span className="topbar-user-name">{user?.full_name || user?.username}</span>
              <span className={`role-chip ${isAdmin ? 'admin' : 'user'}`}>
                {isAdmin ? 'Admin' : 'Opérateur'}
              </span>
            </div>
            <button type="button" className="nav-link nav-link-logout" onClick={handleLogout}>
              Déconnexion
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={`nav-link ${(activeView === 'login' || activeView === 'register') ? 'active' : ''}`}
            onClick={() => onNavigate('login')}
          >
            Connexion
          </button>
        )}
      </nav>
    </header>
  )
}

export default Topbar
