import React, { useEffect, useState } from 'react'
import PresentationPage from './pages/PresentationPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import SitesPage from './pages/SitesPage.jsx'
import CuvesPage from './pages/CuvesPage.jsx'
import GroupsPage from './pages/GroupsPage.jsx'
import AuthPage from './pages/AuthPage.jsx'
import ReportsPage from './pages/ReportsPage.jsx'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'

const ADMIN_VIEWS = new Set(['presentation', 'dashboard', 'sites', 'cuves', 'groups', 'reports'])
const USER_VIEWS = new Set(['reports'])
const PUBLIC_VIEWS = new Set(['presentation', 'login', 'register'])

function resolveViewFromPath(pathname) {
  if (pathname.startsWith('/groupes')) return 'groups'
  if (pathname.startsWith('/sites')) return 'sites'
  if (pathname.startsWith('/cuves')) return 'cuves'
  if (pathname.startsWith('/dashboard')) return 'dashboard'
  if (pathname.startsWith('/rapports')) return 'reports'
  if (pathname.startsWith('/register')) return 'register'
  if (pathname.startsWith('/login')) return 'login'
  return 'presentation'
}

function AppRoutes() {
  const { isAuthenticated, isAdmin, loading } = useAuth()
  const [view, setView] = useState(() => resolveViewFromPath(window.location.pathname))

  const navigate = (nextView, options = {}) => {
    if (typeof nextView === 'object' && nextView !== null) {
      options = { ...options, ...nextView }
      nextView = nextView.view
    }

    const pathMap = {
      presentation: '/',
      dashboard: '/dashboard/',
      sites: '/sites/',
      cuves: '/cuves/',
      groups: '/groupes/',
      reports: '/rapports/',
      login: '/login/',
      register: '/register/',
    }

    if (!nextView) nextView = 'presentation'

    if (!loading) {
      if (!isAuthenticated && !PUBLIC_VIEWS.has(nextView)) {
        nextView = 'login'
      } else if (isAuthenticated && !isAdmin && !USER_VIEWS.has(nextView) && nextView !== 'login' && nextView !== 'register') {
        nextView = 'reports'
      }
    }

    let nextPath = pathMap[nextView] || '/'
    if (nextView === 'sites') {
      const params = []
      if (options.siteId != null && options.siteId !== '') {
        params.push(`siteId=${encodeURIComponent(options.siteId)}`)
      }
      if (options.siteName != null && options.siteName !== '') {
        params.push(`siteName=${encodeURIComponent(options.siteName)}`)
      }
      if (params.length) nextPath += `?${params.join('&')}`
    }

    window.history.pushState({}, '', nextPath)
    setView(nextView)
  }

  useEffect(() => {
    const sync = () => setView(resolveViewFromPath(window.location.pathname))
    sync()
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  useEffect(() => {
    if (loading) return
    if (!isAuthenticated && !PUBLIC_VIEWS.has(view)) {
      window.history.replaceState({}, '', '/login/')
      setView('login')
      return
    }
    if (isAuthenticated && !isAdmin && !USER_VIEWS.has(view) && view !== 'login' && view !== 'register') {
      window.history.replaceState({}, '', '/rapports/')
      setView('reports')
    }
  }, [loading, view, isAuthenticated, isAdmin])

  if (loading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-card">Chargement de votre session…</div>
      </div>
    )
  }

  if (view === 'login' || view === 'register') {
    return <AuthPage onNavigate={navigate} initialMode={view} />
  }

  if (view === 'presentation') {
    return <PresentationPage onNavigate={navigate} />
  }

  if (!isAuthenticated) {
    return <AuthPage onNavigate={navigate} initialMode="login" />
  }

  if (!isAdmin) {
    return <ReportsPage onNavigate={navigate} />
  }

  return (
    <>
      {view === 'dashboard' && <DashboardPage onNavigate={navigate} />}
      {view === 'sites' && <SitesPage onNavigate={navigate} />}
      {view === 'cuves' && <CuvesPage onNavigate={navigate} />}
      {view === 'groups' && <GroupsPage onNavigate={navigate} />}
      {view === 'reports' && <ReportsPage onNavigate={navigate} />}
      {!ADMIN_VIEWS.has(view) && <PresentationPage onNavigate={navigate} />}
    </>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App
