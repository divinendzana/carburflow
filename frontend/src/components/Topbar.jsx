import React from 'react'
import logo from '../../../logo/logo_clair_navbar.jpeg'

function Topbar({ activeView, onNavigate }) {
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
        <button type="button" className={`nav-link ${activeView === 'presentation' ? 'active' : ''}`} onClick={() => onNavigate('presentation')}>Présentation</button>
        <button type="button" className={`nav-link ${activeView === 'dashboard' ? 'active' : ''}`} onClick={() => onNavigate('dashboard')}>Dashboard</button>
        <button type="button" className={`nav-link ${activeView === 'sites' ? 'active' : ''}`} onClick={() => onNavigate('sites')}>Sites</button>
        <button type="button" className={`nav-link ${activeView === 'cuves' ? 'active' : ''}`} onClick={() => onNavigate('cuves')}>Cuves</button>
        <button type="button" className={`nav-link ${activeView === 'groups' ? 'active' : ''}`} onClick={() => onNavigate('groups')}>Groupes</button>
      </nav>
    </header>
  )
}

export default Topbar
