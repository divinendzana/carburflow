import React, { useEffect, useState } from 'react'
import logo from '../../../logo/logo_clair_navbar.jpeg'
import { useAuth } from '../context/AuthContext.jsx'
import { publicSitesRequest } from '../auth.js'

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
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setMode(initialMode === 'register' ? 'register' : 'login')
  }, [initialMode])

  useEffect(() => {
    if (isAuthenticated) {
      onNavigate(isAdmin ? 'presentation' : 'reports')
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

  const fillDemo = (kind) => {
    if (kind === 'admin') {
      setForm((prev) => ({ ...prev, username: 'admin', password: 'admin123' }))
    } else {
      setForm((prev) => ({ ...prev, username: 'user', password: 'user123' }))
    }
    setMode('login')
    onNavigate('login')
    setError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (mode === 'login') {
        const user = await login(form.username.trim(), form.password)
        onNavigate(user.role === 'admin' || user.is_staff ? 'presentation' : 'reports')
      } else {
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
      }
    } catch (err) {
      setError(err.message || 'Impossible de continuer.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-atmosphere" aria-hidden="true" />
      <section className="auth-panel">
        <aside className="auth-brand">
          <div className="auth-brand-glow" aria-hidden="true" />
          <button type="button" className="auth-back" onClick={() => onNavigate('presentation')}>
            ← Retour
          </button>
          <div className="auth-brand-content">
            <img src={logo} alt="Logo CarburFlow" className="auth-logo" />
            <p className="auth-brand-kicker">CarburFlow</p>
            <h1>Le carburant de vos sites, sous contrôle.</h1>
            <p className="auth-brand-copy">
              Espace sécurisé pour les administrateurs et les opérateurs terrain qui déposent les relevés hebdomadaires.
            </p>
            <ul className="auth-points">
              <li><span className="auth-point-dot" />Admin — pilotage &amp; alertes</li>
              <li><span className="auth-point-dot" />Opérateur — envoi des rapports</li>
              <li><span className="auth-point-dot" />Norme Excel ↔ CSV</li>
            </ul>
          </div>
        </aside>

        <div className="auth-form-side">
          <div className="auth-form-card">
            <div className="auth-mode-switch" role="tablist">
              <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>
                Connexion
              </button>
              <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>
                Inscription
              </button>
            </div>

            <header className="auth-form-header">
              <h2>{mode === 'login' ? 'Bon retour' : 'Créer un compte'}</h2>
              <p>
                {mode === 'login'
                  ? 'Accédez à votre espace CarburFlow.'
                  : 'Les inscriptions créent un compte opérateur (envoi de rapports).'}
              </p>
            </header>

            {mode === 'login' && (
              <div className="auth-demo-row">
                <button type="button" className="auth-demo-chip" onClick={() => fillDemo('admin')}>Démo admin</button>
                <button type="button" className="auth-demo-chip" onClick={() => fillDemo('user')}>Démo opérateur</button>
              </div>
            )}

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              {mode === 'register' && (
                <div className="auth-row">
                  <label className="auth-field">
                    <span>Prénom</span>
                    <input type="text" value={form.first_name} onChange={updateField('first_name')} placeholder="Amina" />
                  </label>
                  <label className="auth-field">
                    <span>Nom</span>
                    <input type="text" value={form.last_name} onChange={updateField('last_name')} placeholder="Ngono" />
                  </label>
                </div>
              )}

              <label className="auth-field">
                <span>Nom d’utilisateur</span>
                <input type="text" required autoComplete="username" value={form.username} onChange={updateField('username')} placeholder="ex. agent.douala" />
              </label>

              {mode === 'register' && (
                <>
                  <label className="auth-field">
                    <span>Email</span>
                    <input type="email" value={form.email} onChange={updateField('email')} placeholder="vous@entreprise.cm" />
                  </label>
                  <label className="auth-field">
                    <span>Site rattaché (optionnel)</span>
                    <select value={form.site_id} onChange={updateField('site_id')}>
                      <option value="">— Aucun —</option>
                      {sites.map((site) => (
                        <option key={site.id} value={site.id}>{site.nom_site}</option>
                      ))}
                    </select>
                  </label>
                </>
              )}

              <label className="auth-field">
                <span>Mot de passe</span>
                <div className="auth-password-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={form.password}
                    onChange={updateField('password')}
                    placeholder="••••••••"
                  />
                  <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((v) => !v)}>
                    {showPassword ? 'Masquer' : 'Voir'}
                  </button>
                </div>
              </label>

              {mode === 'register' && (
                <label className="auth-field">
                  <span>Confirmer</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={form.password_confirm}
                    onChange={updateField('password_confirm')}
                    placeholder="••••••••"
                  />
                </label>
              )}

              {error && <div className="auth-error" role="alert">{error}</div>}

              <button type="submit" className="auth-submit" disabled={submitting}>
                {submitting ? 'Patientez…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
              </button>
            </form>

            <p className="auth-footnote">
              {mode === 'login' ? (
                <>Pas encore de compte ? <button type="button" className="auth-inline-link" onClick={() => switchMode('register')}>S’inscrire</button></>
              ) : (
                <>Déjà inscrit ? <button type="button" className="auth-inline-link" onClick={() => switchMode('login')}>Se connecter</button></>
              )}
            </p>

            <p className="auth-demo-hint">
              Comptes démo : <code>admin / admin123</code> · <code>user / user123</code>
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default AuthPage
