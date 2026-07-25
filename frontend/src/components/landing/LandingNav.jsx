import React, { useState } from 'react'
import { Menu, X } from 'lucide-react'
import logo from '../../../../logo/logo_clair_navbar.jpeg'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext.jsx'
import { cn } from '@/lib/utils'

function LandingNav({ onNavigate }) {
  const { isAuthenticated, isAdmin, logout } = useAuth()
  const [open, setOpen] = useState(false)

  const go = (view) => {
    setOpen(false)
    onNavigate(view)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => go('home')}
          className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <img src={logo} alt="" className="size-9 rounded-md object-cover" />
          <span className="font-display text-lg font-semibold tracking-tight text-petrol">
            CarburFlow
          </span>
        </button>

        <nav className="hidden items-center gap-2 md:flex" aria-label="Navigation principale">
          {isAuthenticated ? (
            <>
              {isAdmin && (
                <Button variant="ghost" onClick={() => go('dashboard')}>
                  Dashboard
                </Button>
              )}
              <Button variant="ghost" onClick={() => go('reports')}>
                Rapports
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  await logout()
                  go('home')
                }}
              >
                Déconnexion
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => go('login')}>
                Se connecter
              </Button>
              <Button onClick={() => go('register')}>Créer un compte</Button>
            </>
          )}
        </nav>

        <Button
          variant="outline"
          size="icon"
          className="md:hidden"
          aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>

      <div
        className={cn(
          'border-t border-border bg-card md:hidden',
          open ? 'block' : 'hidden',
        )}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4">
          {isAuthenticated ? (
            <>
              {isAdmin && (
                <Button variant="ghost" className="justify-start" onClick={() => go('dashboard')}>
                  Dashboard
                </Button>
              )}
              <Button variant="ghost" className="justify-start" onClick={() => go('reports')}>
                Rapports
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                onClick={async () => {
                  await logout()
                  go('home')
                }}
              >
                Déconnexion
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" className="justify-start" onClick={() => go('login')}>
                Se connecter
              </Button>
              <Button className="justify-start" onClick={() => go('register')}>
                Créer un compte
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export default LandingNav
