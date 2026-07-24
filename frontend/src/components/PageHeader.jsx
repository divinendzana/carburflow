/**
 * En-tête de page : un titre clair + une phrase qui explique à quoi sert la page.
 */
export default function PageHeader({ eyebrow, title, description, children }) {
  return (
    <header className="page-header">
      <div className="page-header-copy">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {children && <div className="page-header-actions">{children}</div>}
    </header>
  )
}
