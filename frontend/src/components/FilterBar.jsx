/**
 * Filtres période + site, libellés en français courant.
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
  hint = 'Choisissez la période des relevés à afficher.',
}) {
  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit?.(event)
  }

  return (
    <form className="filter-bar" onSubmit={handleSubmit}>
      <div className="filter-bar-intro">
        <strong>Filtrer</strong>
        <span>{hint}</span>
      </div>

      <div className="filter-fields">
        <div className="filter-field">
          <label htmlFor={`${idPrefix}-start`}>Du</label>
          <select id={`${idPrefix}-start`} value={startValue} onChange={(event) => onStartChange(event.target.value)}>
            {reportChoices.map((choice, index) => (
              <option key={`${choice.id ?? index}`} value={String(choice.id ?? index)}>
                {choice.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor={`${idPrefix}-end`}>Au</label>
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
            Afficher
          </button>
        )}
      </div>
    </form>
  )
}
