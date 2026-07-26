import React from 'react'
import AnimatedContent from './reactbits/AnimatedContent.jsx'
import FadeContent from './reactbits/FadeContent.jsx'

/**
 * Entrée de page dynamique (React Bits AnimatedContent + FadeContent).
 */
function PageEnter({ children, className = '', delay = 0.05 }) {
  return (
    <FadeContent blur duration={700} delay={delay * 1000} threshold={0.05} className={className}>
      <AnimatedContent
        distance={28}
        direction="vertical"
        duration={0.55}
        delay={delay}
        threshold={0.05}
        ease="power2.out"
      >
        {children}
      </AnimatedContent>
    </FadeContent>
  )
}

export default PageEnter
