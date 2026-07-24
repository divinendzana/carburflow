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
