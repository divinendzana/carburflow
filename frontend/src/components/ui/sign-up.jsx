import React, { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { AuthHeroPanel } from '@/components/ui/auth-hero-panel'
import { cn } from '@/lib/utils'

function GlassInputWrapper({ children }) {
  return (
    <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-sm transition-colors focus-within:border-petrol-mid/70 focus-within:bg-petrol/5">
      {children}
    </div>
  )
}

export function SignUpPage({
  title = (
    <span className="font-display tracking-tight text-foreground">
      <span className="font-semibold text-petrol">CarburFlow</span>
      <span className="mt-2 block font-medium">Créer un compte</span>
    </span>
  ),
  description = 'Les inscriptions ouvrent un compte opérateur pour déposer les relevés.',
  heroImageSrc,
  heroHeadline = 'Votre relevé, enfin simple.',
  heroSubline = 'Rejoignez les équipes qui déposent leurs rapports sans friction ni tableurs dispersés.',
  heroPhrases = [
    'Norme Excel ou CSV, prête en quelques minutes.',
    'Historique clair de chaque envoi.',
    'L’admin pilote. Vous relevez et déposez.',
  ],
  onSignUp,
  onSignIn,
  error,
  submitting = false,
  sites = [],
  form,
  onFieldChange,
}) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="flex h-[100dvh] w-[100dvw] flex-col overflow-hidden font-sans md:flex-row">
      <section className="flex flex-1 items-center justify-center overflow-y-auto p-6 sm:p-8">
        <div className="w-full max-w-md py-4">
          <div className="flex flex-col gap-5">
            <h1 className="animate-element animate-delay-100 font-display text-4xl font-semibold leading-tight md:text-5xl">
              {title}
            </h1>
            <p className="animate-element animate-delay-200 text-muted-foreground">{description}</p>

            <form className="flex flex-col gap-4" onSubmit={onSignUp} noValidate>
              <div className="animate-element animate-delay-300 grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-muted-foreground" htmlFor="sign-up-first">
                    Prénom
                  </label>
                  <GlassInputWrapper>
                    <input
                      id="sign-up-first"
                      name="first_name"
                      value={form.first_name}
                      onChange={onFieldChange('first_name')}
                      placeholder="Amina"
                      className="w-full rounded-2xl bg-transparent p-4 text-sm text-foreground focus:outline-none"
                    />
                  </GlassInputWrapper>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-muted-foreground" htmlFor="sign-up-last">
                    Nom
                  </label>
                  <GlassInputWrapper>
                    <input
                      id="sign-up-last"
                      name="last_name"
                      value={form.last_name}
                      onChange={onFieldChange('last_name')}
                      placeholder="Ngono"
                      className="w-full rounded-2xl bg-transparent p-4 text-sm text-foreground focus:outline-none"
                    />
                  </GlassInputWrapper>
                </div>
              </div>

              <div className="animate-element animate-delay-400 flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground" htmlFor="sign-up-username">
                  Nom d’utilisateur
                </label>
                <GlassInputWrapper>
                  <input
                    id="sign-up-username"
                    name="username"
                    required
                    autoComplete="username"
                    value={form.username}
                    onChange={onFieldChange('username')}
                    placeholder="ex. agent.douala"
                    className="w-full rounded-2xl bg-transparent p-4 text-sm text-foreground focus:outline-none"
                  />
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-400 flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground" htmlFor="sign-up-email">
                  Email
                </label>
                <GlassInputWrapper>
                  <input
                    id="sign-up-email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={onFieldChange('email')}
                    placeholder="vous@entreprise.cm"
                    className="w-full rounded-2xl bg-transparent p-4 text-sm text-foreground focus:outline-none"
                  />
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-500 flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground" htmlFor="sign-up-site">
                  Site rattaché (optionnel)
                </label>
                <GlassInputWrapper>
                  <select
                    id="sign-up-site"
                    name="site_id"
                    value={form.site_id}
                    onChange={onFieldChange('site_id')}
                    className={cn(
                      'w-full appearance-none rounded-2xl bg-transparent p-4 text-sm text-foreground focus:outline-none',
                    )}
                  >
                    <option value="">— Aucun —</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.nom_site}
                      </option>
                    ))}
                  </select>
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-500 flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground" htmlFor="sign-up-password">
                  Mot de passe
                </label>
                <GlassInputWrapper>
                  <div className="relative">
                    <input
                      id="sign-up-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={form.password}
                      onChange={onFieldChange('password')}
                      placeholder="••••••••"
                      className="w-full rounded-2xl bg-transparent p-4 pr-12 text-sm text-foreground focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-3 flex items-center"
                      aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    >
                      {showPassword ? (
                        <EyeOff className="size-5 text-muted-foreground transition-colors hover:text-foreground" />
                      ) : (
                        <Eye className="size-5 text-muted-foreground transition-colors hover:text-foreground" />
                      )}
                    </button>
                  </div>
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-600 flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground" htmlFor="sign-up-confirm">
                  Confirmer le mot de passe
                </label>
                <GlassInputWrapper>
                  <input
                    id="sign-up-confirm"
                    name="password_confirm"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={form.password_confirm}
                    onChange={onFieldChange('password_confirm')}
                    placeholder="••••••••"
                    className="w-full rounded-2xl bg-transparent p-4 text-sm text-foreground focus:outline-none"
                  />
                </GlassInputWrapper>
              </div>

              {error ? (
                <div
                  role="alert"
                  className="rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
                >
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="animate-element animate-delay-700 cf-interactive-btn w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground transition-all hover:bg-primary/90 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
              >
                {submitting ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <span className="reports-spinner" style={{ width: 18, height: 18 }} aria-hidden="true">
                      <span className="reports-spinner-ring" />
                    </span>
                    Création…
                  </span>
                ) : (
                  'Créer mon compte'
                )}
              </button>
            </form>

            <p className="animate-element animate-delay-800 text-center text-sm text-muted-foreground">
              Déjà inscrit ?{' '}
              <a
                href="#login"
                onClick={(e) => {
                  e.preventDefault()
                  onSignIn?.()
                }}
                className="text-petrol-mid transition-colors hover:underline"
              >
                Se connecter
              </a>
            </p>
          </div>
        </div>
      </section>

      <AuthHeroPanel
        imageSrc={heroImageSrc}
        headline={heroHeadline}
        subline={heroSubline}
        phrases={heroPhrases}
      />
    </div>
  )
}

export default SignUpPage
