import React, { useCallback, useEffect, useRef, useState } from 'react'
import Topbar from '../components/Topbar.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import {
  downloadNorme,
  listMesRapports,
  listSoumissions,
  normeMeta,
  uploadRapport,
} from '../auth.js'

function ReportsPage({ onNavigate }) {
  const { user, isAdmin } = useAuth()
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [meta, setMeta] = useState(null)
  const [soumissions, setSoumissions] = useState([])
  const [rapports, setRapports] = useState([])

  const refresh = useCallback(async () => {
    try {
      const [m, s, r] = await Promise.all([
        normeMeta(),
        listSoumissions(),
        listMesRapports(),
      ])
      setMeta(m)
      setSoumissions(Array.isArray(s) ? s : [])
      setRapports(Array.isArray(r) ? r : [])
    } catch (err) {
      setError(err.message || 'Impossible de charger l’historique.')
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleFiles = async (fileList) => {
    const file = fileList?.[0]
    if (!file) return
    setError('')
    setMessage('')
    setUploading(true)
    try {
      const result = await uploadRapport(file)
      setMessage(result.detail || 'Rapport importé.')
      await refresh()
    } catch (err) {
      setError(err.message || 'Échec de l’import.')
      await refresh()
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="app-shell">
      <Topbar activeView="reports" onNavigate={onNavigate} />
      <main className="reports-layout">
        <section className="reports-hero">
          <div>
            <div className="reports-stub-badge">Rapports</div>
            <h1>Envoi des relevés</h1>
            <p>
              Téléchargez la norme Excel, complétez-la (ou exportez en CSV), puis déposez le fichier.
              {isAdmin ? ' En tant qu’admin, vous voyez tous les envois.' : ' Vous ne voyez que vos envois.'}
            </p>
            <p className="reports-stub-meta">
              Connecté : <strong>{user?.full_name || user?.username}</strong>
              {' · '}
              {user?.role === 'admin' ? 'Administrateur' : 'Opérateur'}
              {user?.site_name ? ` · ${user.site_name}` : ''}
            </p>
          </div>
          <div className="reports-download-row">
            <button type="button" className="btn-primary" onClick={() => downloadNorme('xlsx')}>
              Norme Excel (.xlsx)
            </button>
            <button type="button" className="btn-ghost" onClick={() => downloadNorme('csv')}>
              Norme CSV
            </button>
          </div>
        </section>

        {meta && (
          <section className="reports-meta-panel">
            <h2>{meta.format}</h2>
            <p>{meta.description}</p>
            <div className="reports-columns">
              {(meta.column_names || []).map((col) => (
                <code key={col}>{col}</code>
              ))}
            </div>
          </section>
        )}

        <section
          className={`reports-dropzone ${dragging ? 'dragging' : ''} ${uploading ? 'busy' : ''}`}
          onDragEnter={(e) => { e.preventDefault(); setDragging(true) }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            handleFiles(e.dataTransfer.files)
          }}
          onClick={() => !uploading && inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className="reports-dropzone-title">
            {uploading ? 'Import en cours…' : 'Glissez-déposez votre fichier ici'}
          </div>
          <p>Formats acceptés : .xlsx ou .csv — cliquez pour parcourir</p>
        </section>

        {message && <div className="reports-success">{message}</div>}
        {error && <div className="reports-error">{error}</div>}

        <section className="reports-history">
          <h2>Historique des envois</h2>
          {soumissions.length === 0 ? (
            <p className="reports-empty">Aucun envoi pour le moment.</p>
          ) : (
            <div className="reports-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Fichier</th>
                    <th>Statut</th>
                    <th>Lignes</th>
                    {isAdmin && <th>Auteur</th>}
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {soumissions.map((item) => (
                    <tr key={item.id}>
                      <td>{new Date(item.created_at).toLocaleString('fr-FR')}</td>
                      <td>{item.filename}</td>
                      <td>
                        <span className={`status-pill ${item.status}`}>
                          {item.status === 'success' ? 'OK' : 'Erreur'}
                        </span>
                      </td>
                      <td>{item.rows_imported}</td>
                      {isAdmin && <td>{item.username}</td>}
                      <td>{item.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="reports-history">
          <h2>Rapports {isAdmin ? 'enregistrés' : 'que j’ai déposés'}</h2>
          {rapports.length === 0 ? (
            <p className="reports-empty">Aucun rapport.</p>
          ) : (
            <ul className="reports-list">
              {rapports.map((r) => (
                <li key={r.id}>
                  <strong>#{r.id}</strong>
                  {' — '}
                  {new Date(r.date_debut).toLocaleDateString('fr-FR')}
                  {' → '}
                  {new Date(r.date_fin).toLocaleDateString('fr-FR')}
                  {r.created_by_username ? ` · ${r.created_by_username}` : ''}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}

export default ReportsPage
