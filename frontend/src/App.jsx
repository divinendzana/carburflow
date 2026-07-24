<<<<<<< HEAD
import React, { useEffect, useState } from 'react'
import PresentationPage from './pages/PresentationPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import SitesPage from './pages/SitesPage.jsx'
import CuvesPage from './pages/CuvesPage.jsx'
import GroupsPage from './pages/GroupsPage.jsx'
import ImportPage from './pages/ImportPage.jsx'

// Fonction utilitaire de style (déclarée HORS du composant)
function getTabStyle(isActive) {
  return {
    padding: '8px 16px',
    borderRadius: '20px',
    border: 'none',
    backgroundColor: isActive ? '#2563eb' : '#f1f5f9',
    color: isActive ? '#ffffff' : '#475569',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  }
}

function App() {
  const [view, setView] = useState('presentation')

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
      importation: '/importation/'
    }

    if (!nextView) {
      nextView = 'presentation'
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
      if (params.length) {
        nextPath += `?${params.join('&')}`
      }
    }

    window.history.pushState({}, '', nextPath)
    setView(nextView)
  }

  useEffect(() => {
    const syncViewFromLocation = () => {
      const pathname = window.location.pathname
      if (pathname.startsWith('/groupes')) {
        setView('groups')
        return
      }
      if (pathname.startsWith('/sites')) {
        setView('sites')
        return
      }
      if (pathname.startsWith('/cuves')) {
        setView('cuves')
        return
      }
      if (pathname.startsWith('/dashboard')) {
        setView('dashboard')
        return
      }
      if (pathname.startsWith('/importation')) {
        setView('importation')
        return
      }
      setView('presentation')
    }

    syncViewFromLocation()
    window.addEventListener('popstate', syncViewFromLocation)
    return () => window.removeEventListener('popstate', syncViewFromLocation)
  }, [])

  return (
    <>
      {view === 'presentation' && <PresentationPage onNavigate={navigate} />}
      {view === 'dashboard' && <DashboardPage onNavigate={navigate} />}
      {view === 'sites' && <SitesPage onNavigate={navigate} />}
      {view === 'cuves' && <CuvesPage onNavigate={navigate} />}
      {view === 'groups' && <GroupsPage onNavigate={navigate} />}
      {view === 'importation' && <ImportPage onNavigate={navigate} />}
    </>
  )
}

export default App
=======
import { useEffect, useState } from 'react'
import PresentationPage from './pages/PresentationPage'
import DashboardPage from './pages/DashboardPage'
import SitePage from './pages/SitePage'
import CuvesPage from './pages/CuvesPage'
import GroupsPage from './pages/GroupsPage'
import AlertesPage from './pages/AlertesPage'

const PATHS = {
  presentation: '/',
  dashboard: '/dashboard/',
  site: '/site/',
  cuves: '/cuves/',
  groups: '/groupes/',
  alertes: '/alertes/',
}

function viewFromLocation() {
  const pathname = window.location.pathname
  if (pathname.startsWith('/alertes')) return 'alertes'
  if (pathname.startsWith('/groupes')) return 'groups'
  if (pathname.startsWith('/site')) return 'site'
  if (pathname.startsWith('/cuves')) return 'cuves'
  if (pathname.startsWith('/dashboard')) return 'dashboard'
  return 'presentation'
}

const PAGES = {
  presentation: PresentationPage,
  dashboard: DashboardPage,
  site: SitePage,
  cuves: CuvesPage,
  groups: GroupsPage,
  alertes: AlertesPage,
}

export default function App() {
  const [view, setView] = useState(viewFromLocation)

  const navigate = (nextView) => {
    window.history.pushState({}, '', PATHS[nextView] || '/')
    setView(nextView)
    window.scrollTo({ top: 0 })
  }

  useEffect(() => {
    const sync = () => setView(viewFromLocation())
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  const Page = PAGES[view] || PresentationPage
  return <Page onNavigate={navigate} />
}
>>>>>>> ca3bd4de8a234e2cd373acff4e527b51d19ddaa7
