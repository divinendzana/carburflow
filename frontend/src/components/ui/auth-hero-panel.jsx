import React from 'react'
import { cn } from '@/lib/utils'
import BrandLogo from '../BrandLogo.jsx'

/**
 * Panneau illustration + phrases fortes pour login / register.
 */
export function AuthHeroPanel({
  imageSrc,
  brand = 'CarburFlow',
  headline,
  subline,
  phrases = [],
  className,
}) {
  return (
    <section className={cn('relative hidden min-h-[100dvh] flex-1 p-4 md:block', className)}>
      <div className="absolute inset-4 overflow-hidden rounded-3xl">
        <div
          className="auth-hero-image absolute inset-0 scale-105 bg-cover bg-center"
          style={{
            backgroundImage: `url(${imageSrc})`,
            backgroundColor: '#0f4c6e',
          }}
          role="img"
          aria-label={headline || brand}
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(165deg,rgba(8,32,48,0.88)_0%,rgba(15,76,110,0.58)_40%,rgba(15,76,110,0.28)_68%,rgba(8,32,48,0.55)_100%)]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
          aria-hidden="true"
        />
      </div>

      <div className="absolute inset-4 z-10 flex flex-col justify-between p-8 lg:p-10">
        <div className="animate-element animate-delay-400 flex items-center gap-3">
          <BrandLogo variant="icon" className="size-11 rounded-xl object-cover shadow-lg" />
          <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-white/80">
            {brand}
          </p>
        </div>

        <div className="max-w-md">
          <h2 className="animate-element animate-delay-500 font-display text-3xl font-semibold leading-tight tracking-tight text-white lg:text-4xl">
            {headline}
          </h2>
          {subline ? (
            <p className="animate-element animate-delay-600 mt-4 text-base leading-relaxed text-white/85 lg:text-lg">
              {subline}
            </p>
          ) : null}

          {phrases.length > 0 ? (
            <ul className="animate-element animate-delay-700 mt-8 flex flex-col gap-3">
              {phrases.map((phrase) => (
                <li
                  key={phrase}
                  className="flex items-start gap-3 text-sm font-medium text-white/90 lg:text-base"
                >
                  <span
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-[#7dd3c0]"
                    aria-hidden="true"
                  />
                  <span>{phrase}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export default AuthHeroPanel
