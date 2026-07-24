import React from 'react'
import { ImportBlock } from '../components/ImportBlock'

export function ImportPage() {
  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>Gestion des Importations</h2>
      <p style={{ color: '#64748b' }}>
        Chargez vos fichiers CSV ou Excel contenant les relevés des cuves, groupes et consommations.
      </p>
      
      <ImportBlock />
    </div>
  )
}

export default ImportPage 