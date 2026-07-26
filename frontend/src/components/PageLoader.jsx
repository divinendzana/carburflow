import React from 'react'
import MetaBalls from './reactbits/MetaBalls.jsx'
import ShinyText from './reactbits/ShinyText.jsx'
import BrandLogo from './BrandLogo.jsx'
import { useTheme } from '../context/ThemeContext.jsx'

/**
 * Loader plein écran — MetaBalls (liquide carburant) + ShinyText.
 */
function PageLoader({
  label = 'Chargement en cours…',
  fullscreen = true,
  className = '',
}) {
  const { isDark } = useTheme()
  const ballColor = isDark ? '#4aa3c5' : '#0d4a63'
  const textColor = isDark ? '#93a4b5' : '#5b6b7c'
  const shine = isDark ? '#e7eef4' : '#0d4a63'

  return (
    <div
      className={`cf-page-loader ${fullscreen ? 'cf-page-loader--full' : 'cf-page-loader--inline'} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="cf-page-loader-visual" aria-hidden="true">
        <MetaBalls
          color={ballColor}
          cursorBallColor={ballColor}
          cursorBallSize={2}
          ballCount={12}
          animationSize={28}
          enableMouseInteraction={false}
          enableTransparency
          hoverSmoothness={0.12}
          clumpFactor={0.9}
          speed={0.35}
        />
      </div>
      <BrandLogo variant="icon" className="cf-page-loader-logo" />
      <ShinyText
        text={label}
        speed={2.2}
        color={textColor}
        shineColor={shine}
        className="cf-page-loader-text"
      />
    </div>
  )
}

export default PageLoader
