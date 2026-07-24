import React from 'react'

function MetricPanel({ label, title, children }) {
  return (
    <article className="metric-panel">
      <span className="metric-label">{label}</span>
      <h3>{title}</h3>
      {children}
    </article>
  )
}

export default MetricPanel
