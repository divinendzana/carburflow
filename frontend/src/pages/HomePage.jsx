import React, { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import {
  ArrowRight,
  ClipboardList,
  FileUp,
  Gauge,
  Layers3,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import LandingNav from '@/components/landing/LandingNav.jsx'
import HeroVisual from '@/components/landing/HeroVisual.jsx'
import DashboardShowcase from '@/components/landing/DashboardShowcase.jsx'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/context/AuthContext.jsx'

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText)

const STEPS = [
  {
    icon: ClipboardList,
    title: 'Relever',
    text: 'L’opérateur complète la norme Excel ou CSV, une ligne par cuve et par groupe.',
  },
  {
    icon: FileUp,
    title: 'Déposer',
    text: 'Le fichier est importé en quelques secondes, avec un historique clair des envois.',
  },
  {
    icon: Gauge,
    title: 'Piloter',
    text: 'L’administrateur suit les niveaux, les alertes et la consommation sur tous les sites.',
  },
]

const BENEFITS = [
  {
    icon: Layers3,
    title: 'Une source unique',
    text: 'Remplacez les tableurs dispersés par un flux commun, traçable et partagé.',
  },
  {
    icon: TriangleAlert,
    title: 'Alertes au bon moment',
    text: 'Repérez les cuves critiques avant la rupture, site par site.',
  },
  {
    icon: ShieldCheck,
    title: 'Rôles clairement séparés',
    text: 'L’admin pilote ; l’opérateur relève et dépose — sans friction ni jargon.',
  },
]

function HomePage({ onNavigate }) {
  const { isAuthenticated, isAdmin } = useAuth()
  const rootRef = useRef(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(
          [
            '.hero-brand',
            '.hero-title',
            '.hero-lead',
            '.hero-cta',
            '.hero-visual',
            '.reveal-head',
            '.reveal-item',
            '.showcase-panel',
            '.final-cta-inner',
          ],
          { clearProps: 'all', autoAlpha: 1 },
        )
      })

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const heroTitle = rootRef.current?.querySelector('.hero-title')
        let split
        if (heroTitle) {
          split = SplitText.create(heroTitle, {
            type: 'words,lines',
            linesClass: 'hero-line',
            wordsClass: 'hero-word',
            aria: 'auto',
          })
        }

        const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } })
        heroTl
          .from('.landing-nav-anim', { autoAlpha: 0, y: -12, duration: 0.55 })
          .from('.hero-brand', { autoAlpha: 0, y: 18, duration: 0.55 }, '-=0.25')
          .from(
            split?.words || '.hero-title',
            {
              autoAlpha: 0,
              yPercent: 110,
              duration: 0.75,
              stagger: 0.045,
              ease: 'power4.out',
            },
            '-=0.2',
          )
          .from('.hero-lead', { autoAlpha: 0, y: 22, duration: 0.55 }, '-=0.4')
          .from(
            '.hero-cta',
            { autoAlpha: 0, y: 18, duration: 0.45, stagger: 0.08 },
            '-=0.3',
          )
          .from(
            '.hero-visual',
            { autoAlpha: 0, scale: 1.06, x: 36, duration: 1.05, ease: 'power3.out' },
            '-=0.75',
          )

        gsap.to('.hero-visual-inner', {
          yPercent: 8,
          ease: 'none',
          scrollTrigger: {
            trigger: '.hero-section',
            start: 'top top',
            end: 'bottom top',
            scrub: 1.1,
          },
        })

        gsap.utils.toArray('.reveal-section').forEach((section) => {
          const head = section.querySelectorAll('.reveal-head')
          const items = section.querySelectorAll('.reveal-item')

          if (head.length) {
            gsap.from(head, {
              autoAlpha: 0,
              y: 36,
              duration: 0.7,
              ease: 'power3.out',
              stagger: 0.08,
              scrollTrigger: {
                trigger: section,
                start: 'top 78%',
                once: true,
              },
            })
          }

          if (items.length) {
            gsap.from(items, {
              autoAlpha: 0,
              y: 40,
              duration: 0.65,
              ease: 'power2.out',
              stagger: 0.12,
              scrollTrigger: {
                trigger: section,
                start: 'top 72%',
                once: true,
              },
            })
          }
        })

        gsap.from('.showcase-panel', {
          autoAlpha: 0,
          y: 48,
          scale: 0.98,
          duration: 0.85,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.showcase-section',
            start: 'top 75%',
            once: true,
          },
        })

        gsap.to('.showcase-parallax', {
          y: -28,
          ease: 'none',
          scrollTrigger: {
            trigger: '.showcase-section',
            start: 'top bottom',
            end: 'bottom top',
            scrub: 1.2,
          },
        })

        gsap.from('.final-cta-inner', {
          autoAlpha: 0,
          y: 32,
          duration: 0.7,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.final-cta-section',
            start: 'top 80%',
            once: true,
          },
        })

        return () => {
          split?.revert?.()
        }
      })

      return () => mm.revert()
    },
    { scope: rootRef },
  )

  const renderHeroCtas = () => {
    if (isAuthenticated && isAdmin) {
      return (
        <>
          <Button size="lg" className="hero-cta" onClick={() => onNavigate('dashboard')}>
            Ouvrir le dashboard
          </Button>
          <Button size="lg" variant="outline" className="hero-cta" onClick={() => onNavigate('reports')}>
            Voir les relevés
          </Button>
        </>
      )
    }
    if (isAuthenticated) {
      return (
        <Button size="lg" className="hero-cta" onClick={() => onNavigate('reports')}>
          Aller aux relevés
          <ArrowRight data-icon="inline-end" />
        </Button>
      )
    }
    return (
      <>
        <Button size="lg" className="hero-cta" onClick={() => onNavigate('register')}>
          Commencer
        </Button>
        <Button size="lg" variant="secondary" className="hero-cta" onClick={() => onNavigate('register')}>
          Créer un compte
        </Button>
        <Button size="lg" variant="outline" className="hero-cta" onClick={() => onNavigate('login')}>
          Se connecter
        </Button>
      </>
    )
  }

  return (
    <div ref={rootRef} className="cf-grid-bg relative min-h-screen">
      <div className="cf-noise absolute inset-0" aria-hidden="true" />
      <div className="landing-nav-anim">
        <LandingNav onNavigate={onNavigate} />
      </div>

      <main>
        <section className="hero-section relative overflow-hidden border-b border-border/60">
          <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl lg:grid-cols-[1.05fr_0.95fr]">
            <div className="relative z-10 flex flex-col justify-center gap-6 px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
              <p className="hero-brand font-display text-sm font-semibold uppercase tracking-[0.18em] text-petrol-mid">
                CarburFlow
              </p>
              <h1 className="hero-title font-display max-w-xl text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-[3.25rem]">
                Le carburant de vos sites, enfin sous contrôle.
              </h1>
              <p className="hero-lead max-w-lg text-lg leading-relaxed text-muted-foreground">
                Suivez les stocks, déposez les relevés et pilotez chaque site — sans tableurs dispersés.
              </p>
              <div className="flex flex-wrap items-center gap-3">{renderHeroCtas()}</div>
            </div>

            <div className="hero-visual relative min-h-[320px] overflow-hidden lg:min-h-full">
              <div className="hero-visual-inner h-full will-change-transform">
                <HeroVisual />
              </div>
            </div>
          </div>
        </section>

        <section className="reveal-section mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <h2 className="reveal-head font-display text-3xl font-semibold tracking-tight text-foreground">
              Ce qui freine vos opérations aujourd’hui
            </h2>
            <p className="reveal-head mt-3 text-lg text-muted-foreground">
              Une seule friction à la fois — trois réalités terrain que CarburFlow unifie.
            </p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                title: 'Tableurs dispersés',
                text: 'Chaque site envoie son fichier, dans son format, à son rythme. La consolidation arrive trop tard.',
              },
              {
                title: 'Alertes différées',
                text: 'Les seuils critiques se découvrent en réunion, pas au moment où il faut réapprovisionner.',
              },
              {
                title: 'Vision fragmentée',
                text: 'Impossible de comparer sites, cuves et consommation dans une vue unique et fiable.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="reveal-item flex flex-col gap-2 border-l-2 border-petrol-mid/40 pl-4"
              >
                <h3 className="font-display text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="showcase-section reveal-section border-y border-border/70 bg-card/60 py-16 lg:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <h2 className="reveal-head font-display text-3xl font-semibold tracking-tight text-foreground">
                Une vue claire pour piloter
              </h2>
              <p className="reveal-head mt-3 text-lg text-muted-foreground">
                Niveaux, tendances et priorités — le tableau de bord que vos managers attendent.
              </p>
            </div>
            <div className="showcase-parallax mt-10 will-change-transform">
              <DashboardShowcase />
            </div>
          </div>
        </section>

        <section className="reveal-section mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <h2 className="reveal-head font-display text-3xl font-semibold tracking-tight text-foreground">
              Du terrain au pilotage
            </h2>
            <p className="reveal-head mt-3 text-lg text-muted-foreground">
              Trois gestes simples. Un flux unique pour toute l’équipe.
            </p>
          </div>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, index) => {
              const Icon = step.icon
              return (
                <li
                  key={step.title}
                  className="reveal-item flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-petrol-soft text-petrol">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="font-display text-sm font-semibold text-muted-foreground">
                      0{index + 1}
                    </span>
                  </div>
                  <h3 className="font-display text-xl font-semibold text-foreground">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                </li>
              )
            })}
          </ol>
        </section>

        <section className="reveal-section cf-landing-band border-y border-border/70 py-16 lg:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <h2 className="reveal-head font-display text-3xl font-semibold tracking-tight text-foreground">
                Pourquoi les équipes choisissent CarburFlow
              </h2>
              <p className="reveal-head mt-3 text-lg text-muted-foreground">
                Clarté opérationnelle pour les administrateurs, simplicité pour les opérateurs.
              </p>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {BENEFITS.map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.title} className="reveal-item flex flex-col gap-3">
                    <Icon className="size-5 text-petrol-mid" aria-hidden="true" />
                    <h3 className="font-display text-lg font-semibold text-foreground">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="reveal-section mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <h2 className="reveal-head font-display text-3xl font-semibold tracking-tight text-foreground">
              Deux rôles, une même plateforme
            </h2>
            <p className="reveal-head mt-3 text-lg text-muted-foreground">
              Chacun accède exactement à ce dont il a besoin.
            </p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <Card className="reveal-item">
              <CardHeader>
                <CardTitle>Administrateur</CardTitle>
                <CardDescription>
                  Tableau de bord, sites, cuves, groupes et vision globale des rapports déposés.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => onNavigate('login')}>
                  Connexion admin
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </CardContent>
            </Card>
            <Card className="reveal-item">
              <CardHeader>
                <CardTitle>Opérateur</CardTitle>
                <CardDescription>
                  Téléchargez la norme, renseignez le relevé et déposez le fichier Excel ou CSV en quelques clics.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="secondary" onClick={() => onNavigate('register')}>
                  Créer un compte opérateur
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {!isAuthenticated && (
          <section className="final-cta-section border-t border-border bg-petrol px-4 py-16 text-primary-foreground sm:px-6 lg:px-8">
            <div className="final-cta-inner mx-auto flex max-w-6xl flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-xl">
                <h2 className="font-display text-3xl font-semibold tracking-tight">
                  Reprenez la main sur vos stocks
                </h2>
                <p className="mt-3 text-base text-white/80">
                  Connectez-vous pour piloter, ou créez un compte opérateur pour envoyer votre premier rapport.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  size="lg"
                  className="cf-cta-light bg-white text-petrol hover:bg-white/90"
                  onClick={() => onNavigate('login')}
                >
                  Accéder à CarburFlow
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
                  onClick={() => onNavigate('register')}
                >
                  S’inscrire
                </Button>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span className="font-display font-semibold text-petrol">CarburFlow</span>
          <Separator className="sm:hidden" />
          <span>© {new Date().getFullYear()} — Gestion de carburant multi-sites</span>
        </div>
      </footer>
    </div>
  )
}

export default HomePage
