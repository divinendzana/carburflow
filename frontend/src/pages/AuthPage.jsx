import React, { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext.jsx'
import { publicSitesRequest } from '@/auth.js'
import { SignInPage } from '@/components/ui/sign-in'
import { SignUpPage } from '@/components/ui/sign-up'
import { Button } from '@/components/ui/button'

/* Login : contexte carburant / énergie (cuves, infrastructure) — même traitement photo que register */
const LOGIN_HERO =
  'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=2160&q=80'

/* Register : contexte terrain / opérations industrielles */
const REGISTER_HERO =
  'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=2160&q=80'

function AuthPage({ onNavigate, initialMode = 'login' }) {
  const { login, register, isAuthenticated, isAdmin } = useAuth()
  const [mode, setMode] = useState(initialMode === 'register' ? 'register' : 'login')
  const [sites, setSites] = useState([])
  const [form, setForm] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    password_confirm: '',
    site_id: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setMode(initialMode === 'register' ? 'register' : 'login')
  }, [initialMode])

  useEffect(() => {
    if (isAuthenticated) {
      onNavigate(isAdmin ? 'dashboard' : 'reports')
    }
  }, [isAuthenticated, isAdmin, onNavigate])

  useEffect(() => {
    if (mode !== 'register') return
    publicSitesRequest()
      .then((data) => setSites(Array.isArray(data) ? data : []))
      .catch(() => setSites([]))
  }, [mode])

  const updateField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
    if (error) setError('')
  }

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setError('')
    onNavigate(nextMode === 'register' ? 'register' : 'login')
  }

  const handleSignIn = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const formData = new FormData(event.currentTarget)
      const username = String(formData.get('username') || '').trim()
      const password = String(formData.get('password') || '')
      const user = await login(username, password)
      onNavigate(user.role === 'admin' || user.is_staff ? 'dashboard' : 'reports')
    } catch (err) {
      setError(err.message || 'Impossible de se connecter.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegister = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (form.password !== form.password_confirm) {
        setError('Les mots de passe ne correspondent pas.')
        return
      }
      await register({
        username: form.username.trim(),
        email: form.email.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        password: form.password,
        password_confirm: form.password_confirm,
        site_id: form.site_id ? Number(form.site_id) : null,
      })
      onNavigate('reports')
    } catch (err) {
      setError(err.message || 'Impossible de continuer.')
    } finally {
      setSubmitting(false)
    }
  }

  const fillDemoInputs = (username, password) => {
    requestAnimationFrame(() => {
      const userInput = document.getElementById('sign-in-username')
      const passInput = document.getElementById('sign-in-password')
      if (userInput) userInput.value = username
      if (passInput) passInput.value = password
    })
  }

  return (
    <div className="relative bg-background text-foreground">
      <div className="absolute left-4 top-4 z-20 sm:left-6 sm:top-6">
        <Button variant="ghost" size="sm" onClick={() => onNavigate('home')}>
          ← Retour
        </Button>
      </div>

      {mode === 'login' ? (
        <SignInPage
          title={
            <span className="font-display tracking-tight text-foreground">
              <span className="font-semibold text-petrol">CarburFlow</span>
              <span className="mt-2 block font-medium">Bon retour</span>
            </span>
          }
          description="Connectez-vous pour piloter vos stocks ou déposer un relevé terrain."
          heroImageSrc={LOGIN_HERO}
          heroHeadline="Chaque litre compte."
          heroSubline="Pilotez vos stocks multi-sites sans tableurs dispersés ni alertes trop tardives."
          heroPhrases={[
            'Une vision claire, site par site.',
            'Des relevés terrain qui arrivent à temps.',
            'Relever. Déposer. Piloter.',
          ]}
          onSignIn={handleSignIn}
          onCreateAccount={() => switchMode('register')}
          error={error}
          submitting={submitting}
          demoSlot={
            <div className="animate-element animate-delay-200 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fillDemoInputs('admin', 'admin123')}
              >
                Démo admin
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fillDemoInputs('user', 'user123')}
              >
                Démo opérateur
              </Button>
            </div>
          }
        />
      ) : (
        <SignUpPage
          heroImageSrc={REGISTER_HERO}
          heroHeadline="Votre relevé, enfin simple."
          heroSubline="Rejoignez les équipes qui déposent leurs rapports sans friction ni tableurs dispersés."
          heroPhrases={[
            'Norme Excel ou CSV, prête en quelques minutes.',
            'Historique clair de chaque envoi.',
            'L’admin pilote. Vous relevez et déposez.',
          ]}
          onSignUp={handleRegister}
          onSignIn={() => switchMode('login')}
          error={error}
          submitting={submitting}
          sites={sites}
          form={form}
          onFieldChange={updateField}
        />
      )}
    </div>
  )
}

export default AuthPage
