import React, { useState } from 'react'
import { Menu, Moon, Sun, X } from 'lucide-react'
import BrandLogo from '../BrandLogo.jsx'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext.jsx'
import { useTheme } from '@/context/ThemeContext.jsx'
import { cn } from '@/lib/utils'

function LandingNav({ onNavigate }) {
  const { isAuthenticated, isAdmin, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [open, setOpen] = useState(false)

  const go = (view) => {
    setOpen(false)
    onNavigate(view)
  }

  const isDark = theme === 'dark'

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => go('home')}
          className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BrandLogo variant="icon" className="size-9 rounded-md object-cover" />
          <span className="font-display text-lg font-semibold tracking-tight text-petrol">
            CarburFlow
          </span>
        </button>

        <nav className="hidden items-center gap-2 md:flex" aria-label="Navigation principale">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => { e.preventDefault(); toggleTheme() }}
            aria-label={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
          >
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          {isAuthenticated ? (
            <>
              {isAdmin && (
                <Button variant="ghost" onClick={() => go('dashboard')}>
                  Tableau de bord
                </Button>
              )}
              <Button variant="ghost" onClick={() => go('reports')}>
                Relevés
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

        <div className="flex items-center gap-2 md:hidden">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={(e) => { e.preventDefault(); toggleTheme() }}
            aria-label={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
          >
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
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
                  Tableau de bord
                </Button>
              )}
              <Button variant="ghost" className="justify-start" onClick={() => go('reports')}>
                Relevés
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
