import React, { useState } from 'react'

export function ImportBlock() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setFeedback(null)
    }
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) return

    setLoading(true)
    setFeedback(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('http://localhost:8000/api/import-rapport/', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        setFeedback({
          type: 'success',
          message: `Importation réussie ! ${data.lignes_importees} ligne(s) enregistrée(s).`,
          erreurs: data.erreurs || []
        })
        setFile(null)
      } else {
        setFeedback({
          type: 'error',
          message: data.error || "Une erreur est survenue lors de l'importation."
        })
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: 'Impossible de contacter le serveur backend (Django).'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      padding: '24px',
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      maxWidth: '600px',
      margin: '20px 0'
    }}>
      <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#1e293b' }}>
        📥 Importation de fichier de rapport
      </h3>
      
      <form onSubmit={handleUpload}>
        <div style={{ marginBottom: '16px' }}>
          <input
            type="file"
            accept=".csv, .xlsx, .xls"
            onChange={handleFileChange}
            style={{
              padding: '8px',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              width: '100%'
            }}
          />
        </div>

        <button
          type="submit"
          disabled={!file || loading}
          style={{
            backgroundColor: file && !loading ? '#2563eb' : '#94a3b8',
            color: '#ffffff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '6px',
            cursor: file && !loading ? 'pointer' : 'not-allowed',
            fontWeight: '600'
          }}
        >
          {loading ? 'Analyse et importation en cours...' : 'Téléverser le rapport'}
        </button>
      </form>

      {feedback && (
        <div style={{
          marginTop: '20px',
          padding: '12px 16px',
          borderRadius: '6px',
          backgroundColor: feedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          color: feedback.type === 'success' ? '#166534' : '#991b1b'
        }}>
          <p style={{ margin: 0, fontWeight: '500' }}>{feedback.message}</p>
          {feedback.erreurs && feedback.erreurs.length > 0 && (
            <ul style={{ marginTop: '8px', paddingLeft: '20px', fontSize: '14px' }}>
              {feedback.erreurs.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}