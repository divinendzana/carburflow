import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'carburflow-theme'
const ThemeContext = createContext(null)

function readStoredTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* ignore */
  }
  return null
}

function getPreferredTheme() {
  const stored = readStoredTheme()
  if (stored) return stored
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

export function applyTheme(theme) {
  const root = document.documentElement
  const next = theme === 'dark' ? 'dark' : 'light'

  root.setAttribute('data-theme', next)
  root.classList.remove('dark', 'light', 'theme-dark', 'theme-light')
  root.classList.add(next === 'dark' ? 'dark' : 'light')
  root.classList.add(next === 'dark' ? 'theme-dark' : 'theme-light')
  root.style.colorScheme = next

  if (document.body) {
    document.body.setAttribute('data-theme', next)
    document.body.style.colorScheme = next
  }

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', next === 'dark' ? '#0b1218' : '#0d4a63')
  }

  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* ignore */
  }

  return next
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === 'undefined') return 'light'
    const initial = getPreferredTheme()
    applyTheme(initial)
    return initial
  })

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event) => {
      // Ne suit le système que si l'utilisateur n'a jamais choisi manuellement
      if (readStoredTheme()) return
      setThemeState(event.matches ? 'dark' : 'light')
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const setTheme = useCallback((next) => {
    const resolved = typeof next === 'function' ? next(theme) : next
    const applied = applyTheme(resolved === 'dark' ? 'dark' : 'light')
    setThemeState(applied)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      return next
    })
  }, [])

  const value = useMemo(() => ({
    theme,
    isDark: theme === 'dark',
    setTheme,
    toggleTheme,
  }), [theme, setTheme, toggleTheme])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    return {
      theme: 'light',
      isDark: false,
      setTheme: () => {},
      toggleTheme: () => {},
    }
  }
  return ctx
}
