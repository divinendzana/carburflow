import React from 'react'

/** Dominant industrial visual for the hero — full-bleed plane content, no overlays/chips. */
function HeroVisual() {
  return (
    <div className="hero-visual relative h-full min-h-[320px] w-full overflow-hidden bg-[linear-gradient(145deg,#0f4c6e_0%,#1a6b8a_55%,#2a7fa0_100%)] sm:min-h-[420px] lg:min-h-full">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
        aria-hidden="true"
      />

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 640 520"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Illustration de cuve et pilotage multi-sites"
      >
        <rect x="72" y="90" width="220" height="340" rx="28" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
        <rect x="92" y="118" width="180" height="284" rx="18" fill="rgba(15,40,60,0.35)" />
        <rect x="92" y="230" width="180" height="172" rx="0" fill="url(#fuelGradient)" opacity="0.95" />
        <path d="M92 250 C122 238, 152 262, 182 248 C212 234, 242 258, 272 246 L272 402 L92 402 Z" fill="rgba(255,255,255,0.12)" />
        <line x1="98" y1="190" x2="166" y2="190" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
        <line x1="98" y1="260" x2="156" y2="260" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
        <line x1="98" y1="330" x2="146" y2="330" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />

        <rect x="340" y="120" width="220" height="280" rx="16" fill="rgba(255,255,255,0.96)" />
        <rect x="360" y="148" width="100" height="10" rx="5" fill="#0f4c6e" opacity="0.85" />
        <rect x="360" y="172" width="160" height="8" rx="4" fill="#94a3b8" opacity="0.5" />
        <rect x="360" y="210" width="80" height="56" rx="10" fill="#e4eef4" />
        <rect x="452" y="210" width="80" height="56" rx="10" fill="#e4eef4" />
        <rect x="360" y="284" width="172" height="88" rx="10" fill="#f1f5f9" />
        <path d="M376 348 L412 320 L440 334 L492 300" stroke="#1a6b8a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="492" cy="300" r="4" fill="#0f4c6e" />

        <defs>
          <linearGradient id="fuelGradient" x1="182" y1="230" x2="182" y2="402" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7dd3c0" />
            <stop offset="1" stopColor="#1a6b8a" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

export default HeroVisual
