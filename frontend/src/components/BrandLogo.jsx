import React from 'react'
import logoIcon from '../../../logo/logo_clair_navbar.jpeg'
import logoLight from '../../../logo/clair.jpeg'
import logoDark from '../../../logo/sombre.jpeg'
import { useTheme } from '../context/ThemeContext.jsx'

/**
 * Logo CarburFlow officiel (dossier /logo).
 * - icon : pastille navbar (logo_clair_navbar.jpeg)
 * - full : wordmark clair.jpeg / sombre.jpeg selon le thème
 */
function BrandLogo({
  variant = 'icon',
  className = '',
  alt = 'CarburFlow',
}) {
  const { isDark } = useTheme()
  const src = variant === 'full'
    ? (isDark ? logoDark : logoLight)
    : logoIcon

  return (
    <img
      src={src}
      alt={alt}
      className={`brand-logo brand-logo--${variant} ${className}`.trim()}
      draggable={false}
    />
  )
}

export default BrandLogo
