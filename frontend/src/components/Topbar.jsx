import logo from '../../../logo/logo_clair_navbar.jpeg'
import { toggleTheme, useTheme } from '../lib/theme'

const NAV_ITEMS = [
  { id: 'presentation', label: 'Présentation' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'site', label: 'Sites' },
  { id: 'cuves', label: 'Cuves' },
  { id: 'groups', label: 'Groupes' },
  { id: 'alertes', label: 'Alertes' },
]

export default function Topbar({ activeView, onNavigate }) {
  const theme = useTheme()

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
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-link ${activeView === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'}
          aria-label="Changer de thème"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </nav>
    </header>
  )
}
