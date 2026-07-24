<<<<<<< HEAD
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
        <button type="button" className={`nav-link ${activeView === 'importation' ? 'active' : ''}`} onClick={() => onNavigate('importation')}>Importation</button>
        <button type="button" className={`nav-link ${activeView === 'dashboard' ? 'active' : ''}`} onClick={() => onNavigate('dashboard')}>Dashboard</button>
        <button type="button" className={`nav-link ${activeView === 'sites' ? 'active' : ''}`} onClick={() => onNavigate('sites')}>Sites</button>
        <button type="button" className={`nav-link ${activeView === 'cuves' ? 'active' : ''}`} onClick={() => onNavigate('cuves')}>Cuves</button>
        <button type="button" className={`nav-link ${activeView === 'groups' ? 'active' : ''}`} onClick={() => onNavigate('groups')}>Groupes</button>
=======
import { useEffect, useState } from 'react'
import logo from '../../../logo/logo_clair_navbar.jpeg'
import { toggleTheme, useTheme } from '../lib/theme'

const NAV_ITEMS = [
  { id: 'presentation', label: 'Accueil', hint: 'Présentation' },
  { id: 'dashboard', label: 'Vue d’ensemble', hint: 'Indicateurs clés' },
  { id: 'site', label: 'Sites', hint: 'Par site' },
  { id: 'cuves', label: 'Cuves', hint: 'Niveaux de stock' },
  { id: 'groups', label: 'Groupes', hint: 'Groupes électrogènes' },
  { id: 'alertes', label: 'Alertes', hint: 'À surveiller' },
]

export default function Topbar({ activeView, onNavigate }) {
  const theme = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [activeView])

  return (
    <header className="topbar">
      <div className="brand-wrap">
        <button type="button" className="brand-button" onClick={() => onNavigate('presentation')} aria-label="Retour à l’accueil">
          <img src={logo} alt="" className="brand-logo" />
          <div className="brand-text">
            <span className="brand-name">CarburFlow</span>
            <span className="brand-subtitle">Suivi du carburant</span>
          </div>
        </button>
      </div>

      <button
        type="button"
        className={`nav-burger ${menuOpen ? 'open' : ''}`}
        aria-expanded={menuOpen}
        aria-controls="main-nav"
        aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span />
        <span />
        <span />
      </button>

      <nav id="main-nav" className={`topbar-actions ${menuOpen ? 'open' : ''}`} aria-label="Navigation principale">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-link ${activeView === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
            title={item.hint}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Thème clair' : 'Thème sombre'}
          aria-label="Changer de thème"
        >
          {theme === 'dark' ? 'Clair' : 'Sombre'}
        </button>
>>>>>>> ca3bd4de8a234e2cd373acff4e527b51d19ddaa7
      </nav>
    </header>
  )
}
<<<<<<< HEAD

export default Topbar
=======
>>>>>>> ca3bd4de8a234e2cd373acff4e527b51d19ddaa7
