/** États de page : chargement (squelette) et bandeau « mode démonstration ». */

export function LoadingState({ label = 'Chargement des données…' }) {
  return (
    <div className="loading-state" role="status">
      <span className="loading-spinner" aria-hidden="true" />
      {label}
    </div>
  )
}

export function DemoBanner({ visible }) {
  if (!visible) return null
  return (
    <div className="demo-banner" role="alert">
      ⚠️ Backend injoignable — affichage de données de démonstration.
    </div>
  )
}
