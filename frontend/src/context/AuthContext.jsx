import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  clearAuth,
  getStoredToken,
  getStoredUser,
  loginRequest,
  logoutRequest,
  meRequest,
  persistAuth,
  registerRequest,
} from '../auth.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser())
  const [token, setToken] = useState(() => getStoredToken())
  const [loading, setLoading] = useState(Boolean(getStoredToken()))

  useEffect(() => {
    let cancelled = false
    const hydrate = async () => {
      if (!getStoredToken()) {
        setLoading(false)
        return
      }
      try {
        const me = await meRequest()
        if (!cancelled) {
          setUser(me)
          persistAuth(getStoredToken(), me)
        }
      } catch {
        if (!cancelled) {
          clearAuth()
          setUser(null)
          setToken(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    hydrate()
    return () => { cancelled = true }
  }, [])

  const applyAuth = useCallback((payload) => {
    persistAuth(payload.token, payload.user)
    setToken(payload.token)
    setUser(payload.user)
  }, [])

  const login = useCallback(async (username, password) => {
    const payload = await loginRequest(username, password)
    applyAuth(payload)
    return payload.user
  }, [applyAuth])

  const register = useCallback(async (form) => {
    const payload = await registerRequest(form)
    applyAuth(payload)
    return payload.user
  }, [applyAuth])

  const logout = useCallback(async () => {
    await logoutRequest()
    setUser(null)
    setToken(null)
  }, [])

  const isAdmin = user?.role === 'admin' || Boolean(user?.is_staff)

  const value = useMemo(() => ({
    user,
    token,
    loading,
    isAuthenticated: Boolean(user && token),
    isAdmin,
    login,
    register,
    logout,
  }), [user, token, loading, isAdmin, login, register, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return ctx
}
