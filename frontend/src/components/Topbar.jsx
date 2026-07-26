import React, { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  MapPinned,
  Zap,
  Upload,
  Home,
  LogOut,
  LogIn,
  Menu,
  X,
  Fuel,
  Sun,
  Moon,
} from 'lucide-react'
import BrandLogo from './BrandLogo.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { getDisplayFullName } from '../utils/userDisplay.js'

function Topbar({ activeView, onNavigate }) {
  const { isAuthenticated, isAdmin, logout, user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [activeView])

  const go = (view) => {
    setMenuOpen(false)
    onNavigate(view)
  }

  const handleLogout = async () => {
    setMenuOpen(false)
    await logout()
    onNavigate('home')
  }

  const handleThemeToggle = (event) => {
    event.preventDefault()
    event.stopPropagation()
    toggleTheme()
  }

  const adminLinks = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'sites', label: 'Sites', icon: MapPinned },
    { id: 'groups', label: 'Groupes', icon: Zap },
    { id: 'reports', label: 'Relevés', icon: Upload },
  ]

  const userLinks = [
    { id: 'reports', label: 'Mes relevés', icon: Upload },
  ]

  const links = !isAuthenticated
    ? [
        { id: 'home', label: 'Accueil', icon: Home },
        { id: 'login', label: 'Connexion', icon: LogIn },
      ]
    : isAdmin
      ? adminLinks
      : userLinks

  const isDark = theme === 'dark'

  return (
    <header className="topbar">
      <button
        type="button"
        className="brand-wrap brand-wrap--btn"
        onClick={() => go(isAuthenticated ? (isAdmin ? 'dashboard' : 'reports') : 'home')}
        aria-label="CarburFlow — accueil"
      >
        <BrandLogo variant="icon" className="brand-logo" />
        <div className="brand-text">
          <span className="brand-name">CarburFlow</span>
          <span className="brand-subtitle">
            {isAuthenticated
              ? (isAdmin ? 'Pilotage carburant' : 'Mes relevés')
              : 'Suivi carburant'}
          </span>
        </div>
      </button>

      <div className="topbar-right">
        <nav
          className={`topbar-actions ${menuOpen ? 'is-open' : ''}`}
          aria-label="Navigation principale"
        >
          {links.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`nav-link ${activeView === id || (id === 'home' && activeView === 'presentation') ? 'active' : ''}`}
              onClick={() => go(id === 'home' ? 'home' : id)}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}

          {isAuthenticated && (
            <div className="topbar-user">
              <div className="topbar-user-meta">
                <span className="topbar-user-name">{getDisplayFullName(user)}</span>
                <span className={`role-chip ${isAdmin ? 'admin' : 'user'}`}>
                  {isAdmin ? 'Responsable' : 'Opérateur'}
                </span>
              </div>
              <button
                type="button"
                className="nav-link nav-link-logout"
                onClick={handleLogout}
              >
                <LogOut size={16} aria-hidden="true" />
                <span>Déconnexion</span>
              </button>
            </div>
          )}
        </nav>

        <button
          type="button"
          className="theme-toggle"
          onClick={handleThemeToggle}
          aria-label={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
          title={isDark ? 'Mode clair' : 'Mode sombre'}
        >
          {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
        </button>

        <button
          type="button"
          className="topbar-burger"
          aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
    </header>
  )
}

export default Topbar
