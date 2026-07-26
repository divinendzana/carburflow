import React, { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useAuth } from '../context/AuthContext.jsx'
import { getDisplayFirstName } from '../utils/userDisplay.js'

gsap.registerPlugin(useGSAP)

/**
 * Bandeau de bienvenue.
 * - Par défaut : « Un bonjour Prénom ! »
 * - variant="admin-import" : message responsable (pas de bonjour)
 */
function WelcomeBanner({
  variant = 'hello',
  title,
  subtitle,
  className = '',
}) {
  const { user, isAdmin } = useAuth()
  const ref = useRef(null)
  const firstName = getDisplayFirstName(user)

  useGSAP(() => {
    if (!ref.current) return
    gsap.from(ref.current, {
      opacity: 0,
      y: 16,
      duration: 0.55,
      ease: 'power2.out',
    })
  }, { scope: ref })

  const isAdminImport = variant === 'admin-import'
  const heading = title || (
    isAdminImport
      ? 'Espace responsable — relevés des équipes'
      : `Un bonjour ${firstName} !`
  )
  const sub = subtitle || (
    isAdminImport
      ? 'Téléchargez, corrigez et suivez les fichiers envoyés par les opérateurs.'
      : isAdmin
        ? 'Voici votre tableau de bord CarburFlow. Tout est prêt pour piloter vos sites.'
        : 'Bienvenue dans votre espace. Suivez les étapes pour envoyer votre relevé.'
  )

  return (
    <section
      ref={ref}
      className={`welcome-banner ${isAdminImport ? 'welcome-banner--admin' : ''} ${className}`.trim()}
      aria-label="Bienvenue"
    >
      <div className="welcome-banner-glow" aria-hidden="true" />
      <div className="welcome-banner-body">
        <p className="welcome-banner-kicker">
          {isAdminImport ? 'Relevés · Responsable' : 'CarburFlow'}
        </p>
        <h1 className="welcome-banner-title">{heading}</h1>
        <p className="welcome-banner-sub">{sub}</p>
      </div>
    </section>
  )
}

export default WelcomeBanner
