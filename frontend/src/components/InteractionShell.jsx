import React from 'react'
import ClickSpark from './reactbits/ClickSpark.jsx'
import { useTheme } from '../context/ThemeContext.jsx'

/**
 * Enveloppe globale : étincelles au clic (React Bits ClickSpark).
 */
function InteractionShell({ children }) {
  const { isDark } = useTheme()
  return (
    <div className="cf-interaction-shell">
      <ClickSpark
        sparkColor={isDark ? '#6bb6d2' : '#0d4a63'}
        sparkSize={9}
        sparkRadius={18}
        sparkCount={9}
        duration={420}
        extraScale={1.05}
      >
        {children}
      </ClickSpark>
    </div>
  )
}

export default InteractionShell
