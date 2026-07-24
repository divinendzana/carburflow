import React, { useEffect, useState } from 'react'
import HomePage from './pages/HomePage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import SitesPage from './pages/SitesPage.jsx'
import CuvesPage from './pages/CuvesPage.jsx'
import GroupsPage from './pages/GroupsPage.jsx'

function App() {
  const [view, setView] = useState('home')

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
    }

    if (!nextView) {
      nextView = 'home'
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
    if (nextView === 'groups') {
      const params = []
      if (options.groupId != null && options.groupId !== '') {
        params.push(`groupId=${encodeURIComponent(options.groupId)}`)
      }
      if (options.groupLabel != null && options.groupLabel !== '') {
        params.push(`groupLabel=${encodeURIComponent(options.groupLabel)}`)
      }
      if (options.mode != null && options.mode !== '') {
        params.push(`mode=${encodeURIComponent(options.mode)}`)
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
      setView('home')
    }

    syncViewFromLocation()
    window.addEventListener('popstate', syncViewFromLocation)
    return () => window.removeEventListener('popstate', syncViewFromLocation)
  }, [])

  return (
    <>
      {view === 'home' && <HomePage onNavigate={navigate} />}
      {view === 'dashboard' && <DashboardPage onNavigate={navigate} />}
      {view === 'sites' && <SitesPage onNavigate={navigate} />}
      {view === 'cuves' && <CuvesPage onNavigate={navigate} />}
      {view === 'groups' && <GroupsPage onNavigate={navigate} />}
    </>
  )
}

export default App
