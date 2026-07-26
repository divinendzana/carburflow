import { useMemo } from 'react'
import { useTheme } from '../context/ThemeContext.jsx'

/** Couleurs Chart.js adaptées au thème clair / sombre. */
export function useChartPalette() {
  const { isDark } = useTheme()
  return useMemo(() => (
    isDark
      ? {
          text: '#9eb6c9',
          axis: '#9eb6c9',
          grid: 'rgba(158, 182, 201, 0.14)',
        }
      : {
          text: '#23466d',
          axis: '#123d6d',
          grid: 'rgba(13, 74, 99, 0.08)',
        }
  ), [isDark])
}
