import React, { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { AuthHeroPanel } from '@/components/ui/auth-hero-panel'

function GlassInputWrapper({ children }) {
  return (
    <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-sm transition-colors focus-within:border-petrol-mid/70 focus-within:bg-petrol/5">
      {children}
    </div>
  )
}

/**
 * Premium split sign-in layout (shadcn / Tailwind).
 * Testimonials intentionally omitted for CarburFlow.
 */
export function SignInPage({
  title = <span className="font-light tracking-tighter text-foreground">Bon retour</span>,
  description = 'Accédez à votre espace et continuez le pilotage de vos sites.',
  heroImageSrc,
  heroHeadline = 'Chaque litre compte.',
  heroSubline = 'Pilotez vos stocks multi-sites sans tableurs dispersés ni alertes trop tardives.',
  heroPhrases = [
    'Une vision claire, site par site.',
    'Des relevés terrain qui arrivent à temps.',
    'Relever. Déposer. Piloter.',
  ],
  onSignIn,
  onGoogleSignIn,
  onResetPassword,
  onCreateAccount,
  error,
  submitting = false,
  demoSlot,
  usernameName = 'username',
  usernameLabel = "Nom d'utilisateur",
  usernamePlaceholder = 'ex. agent.douala',
  usernameType = 'text',
  usernameAutoComplete = 'username',
  submitLabel = 'Se connecter',
}) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="flex h-[100dvh] w-[100dvw] flex-col font-sans md:flex-row">
      <section className="flex flex-1 items-center justify-center overflow-y-auto p-6 sm:p-8">
        <div className="w-full max-w-md">
          <div className="flex flex-col gap-6">
            <h1 className="animate-element animate-delay-100 font-display text-4xl font-semibold leading-tight md:text-5xl">
              {title}
            </h1>
            <p className="animate-element animate-delay-200 text-muted-foreground">{description}</p>

            {demoSlot}

            <form className="flex flex-col gap-5" onSubmit={onSignIn}>
              <div className="animate-element animate-delay-300 flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground" htmlFor="sign-in-username">
                  {usernameLabel}
                </label>
                <GlassInputWrapper>
                  <input
                    id="sign-in-username"
                    name={usernameName}
                    type={usernameType}
                    autoComplete={usernameAutoComplete}
                    required
                    placeholder={usernamePlaceholder}
                    className="w-full rounded-2xl bg-transparent p-4 text-sm text-foreground focus:outline-none"
                  />
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-400 flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground" htmlFor="sign-in-password">
                  Mot de passe
                </label>
                <GlassInputWrapper>
                  <div className="relative">
                    <input
                      id="sign-in-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      minLength={6}
                      placeholder="Entrez votre mot de passe"
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

              <div className="animate-element animate-delay-500 flex items-center justify-between text-sm">
                <label className="flex cursor-pointer items-center gap-3">
                  <input type="checkbox" name="rememberMe" className="custom-checkbox" />
                  <span className="text-foreground/90">Rester connecté</span>
                </label>
                {onResetPassword ? (
                  <a
                    href="#reset"
                    onClick={(e) => {
                      e.preventDefault()
                      onResetPassword()
                    }}
                    className="text-petrol-mid transition-colors hover:underline"
                  >
                    Réinitialiser
                  </a>
                ) : (
                  <span />
                )}
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
                className="animate-element animate-delay-600 cf-interactive-btn w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground transition-all hover:bg-primary/90 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
              >
                {submitting ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <span className="reports-spinner" style={{ width: 18, height: 18 }} aria-hidden="true">
                      <span className="reports-spinner-ring" />
                    </span>
                    Connexion…
                  </span>
                ) : submitLabel}
              </button>
            </form>

            {onGoogleSignIn ? (
              <>
                <div className="animate-element animate-delay-700 relative flex items-center justify-center">
                  <span className="w-full border-t border-border" />
                  <span className="absolute bg-background px-4 text-sm text-muted-foreground">
                    Ou continuer avec
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onGoogleSignIn}
                  className="animate-element animate-delay-800 flex w-full items-center justify-center gap-3 rounded-2xl border border-border py-4 transition-colors hover:bg-secondary"
                >
                  Continuer avec Google
                </button>
              </>
            ) : null}

            <p className="animate-element animate-delay-900 text-center text-sm text-muted-foreground">
              Nouveau sur CarburFlow ?{' '}
              <a
                href="#register"
                onClick={(e) => {
                  e.preventDefault()
                  onCreateAccount?.()
                }}
                className="text-petrol-mid transition-colors hover:underline"
              >
                Créer un compte
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

export default SignInPage
