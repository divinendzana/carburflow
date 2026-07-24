/**
 * Barre de filtres période (rapport début / fin) + site, réutilisée sur les
 * pages Dashboard, Sites, Cuves et Groupes.
 */
export default function FilterBar({
  reportChoices = [],
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  sites,
  siteValue,
  onSiteChange,
  onSubmit,
  idPrefix = 'filter',
}) {
  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit?.(event)
  }

  return (
    <form className="groups-filter-bar" onSubmit={handleSubmit}>
      <div className="filter-field">
        <label htmlFor={`${idPrefix}-start`}>Rapport début</label>
        <select id={`${idPrefix}-start`} value={startValue} onChange={(event) => onStartChange(event.target.value)}>
          {reportChoices.map((choice, index) => (
            <option key={`${choice.id ?? index}`} value={String(choice.id ?? index)}>
              {choice.label}
            </option>
          ))}
        </select>
      </div>
      <div className="filter-field">
        <label htmlFor={`${idPrefix}-end`}>Rapport fin</label>
        <select id={`${idPrefix}-end`} value={endValue} onChange={(event) => onEndChange(event.target.value)}>
          {reportChoices.map((choice, index) => (
            <option key={`${choice.id ?? index}`} value={String(choice.id ?? index)}>
              {choice.label}
            </option>
          ))}
        </select>
      </div>
      {sites && (
        <div className="filter-field">
          <label htmlFor={`${idPrefix}-site`}>Site</label>
          <select id={`${idPrefix}-site`} value={siteValue ?? ''} onChange={(event) => onSiteChange(event.target.value)}>
            {sites.map((site) => (
              <option key={site.id} value={String(site.id)}>
                {site.nom_site}
              </option>
            ))}
          </select>
        </div>
      )}
      {onSubmit && (
        <button type="submit" className="filter-submit">
          Appliquer
        </button>
      )}
    </form>
  )
}
