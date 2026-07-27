import React, { useEffect, useState } from 'react'
import HomePage from './pages/HomePage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import SitesPage from './pages/SitesPage.jsx'
import CuvesPage from './pages/CuvesPage.jsx'
import GroupsPage from './pages/GroupsPage.jsx'
import AuthPage from './pages/AuthPage.jsx'
import ReportsPage from './pages/ReportsPage.jsx'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import InteractionShell from './components/InteractionShell.jsx'
import PageLoader from './components/PageLoader.jsx'

const USER_VIEWS = new Set(['reports'])
const PUBLIC_VIEWS = new Set(['home', 'login', 'register'])

function resolveViewFromPath(pathname) {
  if (pathname.startsWith('/groupes')) return 'groups'
  if (pathname.startsWith('/sites')) return 'sites'
  if (pathname.startsWith('/cuves')) return 'cuves'
  if (pathname.startsWith('/dashboard')) return 'dashboard'
  if (pathname.startsWith('/rapports')) return 'reports'
  if (pathname.startsWith('/register')) return 'register'
  if (pathname.startsWith('/login')) return 'login'
  return 'home'
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
      home: '/',
      dashboard: '/dashboard/',
      sites: '/sites/',
      cuves: '/cuves/',
      groups: '/groupes/',
      reports: '/rapports/',
      login: '/login/',
      register: '/register/',
    }

    if (!nextView || nextView === 'presentation') nextView = 'home'

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
      if (options.siteId != null && options.siteId !== '') params.push(`siteId=${encodeURIComponent(options.siteId)}`)
      if (options.siteName != null && options.siteName !== '') params.push(`siteName=${encodeURIComponent(options.siteName)}`)
      if (options.mode != null && options.mode !== '') params.push(`mode=${encodeURIComponent(options.mode)}`)
      if (params.length) nextPath += `?${params.join('&')}`
    }
    if (nextView === 'groups') {
      const params = []
      if (options.groupId != null && options.groupId !== '') params.push(`groupId=${encodeURIComponent(options.groupId)}`)
      if (options.groupLabel != null && options.groupLabel !== '') params.push(`groupLabel=${encodeURIComponent(options.groupLabel)}`)
      if (options.mode != null && options.mode !== '') params.push(`mode=${encodeURIComponent(options.mode)}`)
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
    return <PageLoader label="Ouverture de votre session…" />
  }

  if (view === 'login' || view === 'register') {
    return <AuthPage onNavigate={navigate} initialMode={view} />
  }

  if (!isAuthenticated) {
    if (view === 'home') {
      return <HomePage onNavigate={navigate} />
    }
    return <AuthPage onNavigate={navigate} initialMode="login" />
  }

  if (!isAdmin) {
    if (view === 'home') {
      return <HomePage onNavigate={navigate} />
    }
    return <ReportsPage onNavigate={navigate} />
  }

  // Une seule vue à la fois — éviter d’empiler HomePage sous Rapports / Dashboard
  if (view === 'dashboard') return <DashboardPage onNavigate={navigate} />
  if (view === 'sites') return <SitesPage onNavigate={navigate} />
  if (view === 'cuves') return <CuvesPage onNavigate={navigate} />
  if (view === 'groups') return <GroupsPage onNavigate={navigate} />
  if (view === 'reports') return <ReportsPage onNavigate={navigate} />
  return <HomePage onNavigate={navigate} />
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <InteractionShell>
          <AppRoutes />
        </InteractionShell>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
