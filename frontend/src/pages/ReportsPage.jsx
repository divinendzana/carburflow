import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Topbar from '../components/Topbar.jsx'
import WelcomeBanner from '../components/WelcomeBanner.jsx'
import RapportEditModal from '../components/RapportEditModal.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import {
  deleteRapport,
  downloadNorme,
  downloadRapport,
  listMesRapports,
  normeMeta,
  uploadRapport,
} from '../auth.js'

const SIMPLE_COLUMNS = [
  {
    name: 'date_debut',
    label: 'Date de début',
    required: true,
    example: '13/07/2026',
    help: 'Premier jour de votre période de relevé.',
  },
  {
    name: 'date_fin',
    label: 'Date de fin',
    required: true,
    example: '17/07/2026',
    help: 'Dernier jour de votre période de relevé (même période sur toutes les lignes).',
  },
  {
    name: 'id_cuve_principale',
    label: 'N° cuve principale',
    required: false,
    example: '6001',
    help: 'Le numéro de la grande cuve (voir l’écran Cuves).',
  },
  {
    name: 'id_cuve_journaliere',
    label: 'N° cuve journalière',
    required: false,
    example: '7001',
    help: 'Le numéro de la petite cuve du jour, si vous en avez une.',
  },
  {
    name: 'id_groupe',
    label: 'N° groupe électrogène',
    required: false,
    example: '8001',
    help: 'Le numéro du groupe concerné (voir l’écran Groupes).',
  },
  {
    name: 'quantite_gasoil_cuve_principale',
    label: 'Gasoil cuve principale (litres)',
    required: false,
    example: '4500',
    help: 'Combien de litres restent dans la grande cuve.',
  },
  {
    name: 'quantite_gasoil_cuve_journaliere',
    label: 'Gasoil cuve journalière (litres)',
    required: false,
    example: '300',
    help: 'Combien de litres restent dans la cuve journalière.',
  },
  {
    name: 'compteur_horaire',
    label: 'Compteur horaire',
    required: false,
    example: '1210',
    help: 'Le chiffre lu sur le compteur du groupe.',
  },
  {
    name: 'depotage',
    label: 'Dépotage (litres)',
    required: false,
    example: '0',
    help: 'Litres ajoutés pendant la période. Mettez 0 s’il n’y en a pas.',
  },
  {
    name: 'etat_fonctionnement',
    label: 'État',
    required: false,
    example: 'F',
    help: 'En général : F (fonctionne).',
  },
  {
    name: 'observations',
    label: 'Observations',
    required: false,
    example: 'RAS',
    help: 'Un court commentaire si besoin (panne, RAS…).',
  },
]

function formatDate(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('fr-FR')
  } catch {
    return String(value)
  }
}

function Spinner({ size = 18, label }) {
  return (
    <span className="reports-spinner" style={{ width: size, height: size }} role="status" aria-label={label || 'Chargement'}>
      <span className="reports-spinner-ring" />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  )
}

function LoadingButton({
  children,
  loading = false,
  loadingText,
  className = '',
  disabled,
  ...props
}) {
  return (
    <button
      type="button"
      className={`reports-btn ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? (
        <span className="reports-btn-loading">
          <Spinner size={16} />
          <span>{loadingText || 'Patientez…'}</span>
        </span>
      ) : (
        children
      )}
    </button>
  )
}

function ReportsPage({ onNavigate }) {
  const { isAdmin } = useAuth()
  const inputRef = useRef(null)
  const errorRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadName, setUploadName] = useState('')
  const [downloadingNorme, setDownloadingNorme] = useState('')
  const [downloadingRapport, setDownloadingRapport] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [importErrors, setImportErrors] = useState([])
  const [meta, setMeta] = useState(null)
  const [rapports, setRapports] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [showAllColumns, setShowAllColumns] = useState(false)
  const [query, setQuery] = useState('')
  const [editingRapportId, setEditingRapportId] = useState(null)
  const [deletingRapportId, setDeletingRapportId] = useState(null)

  const busy = uploading
    || Boolean(downloadingNorme)
    || Boolean(downloadingRapport)
    || deletingRapportId != null

  const columns = useMemo(() => {
    const byName = Object.fromEntries(SIMPLE_COLUMNS.map((c) => [c.name, c]))
    if (Array.isArray(meta?.columns) && meta.columns.length) {
      return meta.columns.map((col) => {
        const simple = byName[col.name] || {}
        return {
          name: col.name,
          label: simple.label || col.label || col.name,
          required: Boolean(col.required),
          example: simple.example || col.example || '',
          help: simple.help || col.help || '',
        }
      })
    }
    return SIMPLE_COLUMNS
  }, [meta])

  const visibleColumns = showAllColumns ? columns : columns.filter((c) => c.required).concat(
    columns.filter((c) => !c.required).slice(0, 3),
  )

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoadingList(true)
    try {
      const [m, r] = await Promise.all([normeMeta(), listMesRapports()])
      setMeta(m)
      setRapports(Array.isArray(r) ? r : [])
    } catch (err) {
      setError(err.message || 'Impossible de charger la page pour le moment.')
    } finally {
      if (!silent) setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if ((error || importErrors.length) && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [error, importErrors])

  const filteredRapports = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rapports
    return rapports.filter((r) => {
      const author = (r.created_by_username || '').toLowerCase()
      return (
        String(r.id).includes(q)
        || author.includes(q)
        || String(r.date_debut || '').includes(q)
        || String(r.date_fin || '').includes(q)
      )
    })
  }, [rapports, query])

  const clearFeedback = () => {
    setError('')
    setMessage('')
    setImportErrors([])
  }

  const handleDownloadNorme = async (format) => {
    clearFeedback()
    setDownloadingNorme(format)
    try {
      await downloadNorme(format)
      setMessage(
        format === 'xlsx'
          ? 'Fichier modèle téléchargé. Ouvrez-le, remplacez la ligne d’exemple, puis envoyez-le à l’étape 3.'
          : 'Fichier modèle CSV téléchargé. Complétez-le puis envoyez-le à l’étape 3.',
      )
    } catch (err) {
      setError(err.message || 'Le téléchargement n’a pas fonctionné. Réessayez.')
    } finally {
      setDownloadingNorme('')
    }
  }

  const handleDownloadRapport = async (rapportId, format) => {
    clearFeedback()
    setDownloadingRapport(`${rapportId}:${format}`)
    try {
      await downloadRapport(rapportId, format)
      setMessage(`Le rapport n°${rapportId} a été téléchargé sur votre ordinateur.`)
    } catch (err) {
      setError(err.message || 'Impossible de télécharger ce rapport.')
    } finally {
      setDownloadingRapport('')
    }
  }

  const handleDeleteRapport = async (rapport) => {
    if (!isAdmin) return
    const ok = window.confirm(
      `Supprimer le rapport n°${rapport.id} ?\n\n`
      + `Période : ${formatDate(rapport.date_debut)} → ${formatDate(rapport.date_fin)}\n`
      + 'Cette action est définitive : les lignes de relevé liées seront aussi retirées.',
    )
    if (!ok) return
    clearFeedback()
    setDeletingRapportId(rapport.id)
    try {
      const result = await deleteRapport(rapport.id)
      setMessage(result.detail || `Le rapport n°${rapport.id} a été supprimé.`)
      await refresh({ silent: true })
    } catch (err) {
      setError(err.message || 'Impossible de supprimer ce rapport.')
    } finally {
      setDeletingRapportId(null)
    }
  }

  const handleFiles = async (fileList) => {
    const file = fileList?.[0]
    if (!file || uploading) return
    clearFeedback()
    setUploadName(file.name)
    setUploading(true)
    try {
      const result = await uploadRapport(file)
      setMessage(result.detail || 'Votre fichier a bien été enregistré.')
      await refresh({ silent: true })
    } catch (err) {
      setError(err.message || 'Votre fichier n’a pas pu être importé.')
      setImportErrors(Array.isArray(err.errors) ? err.errors : (err.data?.errors || []))
    } finally {
      setUploading(false)
      setUploadName('')
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="app-shell">
      <Topbar activeView="reports" onNavigate={onNavigate} />
      <main className="reports-layout reports-layout--simple">
        {(uploading || downloadingNorme || downloadingRapport) && (
          <div className="reports-toast-loading" role="status" aria-live="polite">
            <Spinner size={22} />
            <div>
              <strong>
                {uploading && 'Envoi du fichier…'}
                {downloadingNorme && 'Préparation du modèle…'}
                {downloadingRapport && 'Préparation du téléchargement…'}
              </strong>
              <p>
                {uploading && (uploadName ? `Fichier : ${uploadName}` : 'Vérification en cours')}
                {downloadingNorme && 'Quelques secondes…'}
                {downloadingRapport && 'Votre fichier arrive…'}
              </p>
            </div>
          </div>
        )}

        {isAdmin ? (
          <WelcomeBanner variant="admin-import" />
        ) : (
          <WelcomeBanner
            subtitle="Pas besoin d’être informaticien. Suivez les 3 cases ci-dessous, dans l’ordre."
          />
        )}

        <section className="reports-hero reports-hero--simple">
          <div className="reports-stub-badge">
            {isAdmin ? 'Import des relevés' : 'Envoi des relevés'}
          </div>
          <h2>
            {isAdmin
              ? 'Recevoir et corriger les fichiers'
              : 'Envoyer mon fichier de relevé'}
          </h2>
          <p>
            {isAdmin
              ? 'Téléchargez le modèle si besoin, puis suivez les envois des opérateurs. Vous pouvez aussi corriger un rapport déjà reçu.'
              : 'Remplissez le modèle, déposez-le ici, puis corrigez-le si besoin depuis la liste plus bas.'}
          </p>
        </section>

        <section className="reports-howto" aria-label="Comment faire">
          <article className="reports-howto-card">
            <div className="reports-howto-num">1</div>
            <h2>Récupérer le modèle</h2>
            <p>Téléchargez le fichier prêt à remplir. C’est le bon format pour CarburFlow.</p>
            <div className="reports-download-row">
              <LoadingButton
                className="reports-btn--primary reports-btn--lg"
                loading={downloadingNorme === 'xlsx'}
                loadingText="Téléchargement…"
                disabled={busy && downloadingNorme !== 'xlsx'}
                onClick={() => handleDownloadNorme('xlsx')}
              >
                Télécharger le modèle Excel
              </LoadingButton>
              <LoadingButton
                className="reports-btn--ghost"
                loading={downloadingNorme === 'csv'}
                loadingText="Téléchargement…"
                disabled={busy && downloadingNorme !== 'csv'}
                onClick={() => handleDownloadNorme('csv')}
              >
                Ou en CSV
              </LoadingButton>
            </div>
          </article>

          <article className="reports-howto-card">
            <div className="reports-howto-num">2</div>
            <h2>Remplir le fichier</h2>
            <p>
              Ouvrez le modèle, <strong>gardez les titres tels quels</strong>,
              et remplacez la ligne d’exemple par vos relevés.
              Une ligne = une cuve / un groupe pour la période.
            </p>
            <ul className="reports-plain-list">
              <li>Mettez les mêmes dates de début et de fin sur toutes les lignes.</li>
              <li>Utilisez les numéros de cuves et de groupes déjà connus dans l’application.</li>
              <li>Les litres et le compteur se remplissent avec des nombres simples.</li>
            </ul>

            <button
              type="button"
              className="reports-linkish"
              onClick={() => setShowAllColumns((v) => !v)}
            >
              {showAllColumns ? 'Masquer le détail des colonnes' : 'Voir quoi mettre dans chaque colonne'}
            </button>

            {showAllColumns && (
              <div className="reports-table-wrap reports-guide-table">
                <table>
                  <thead>
                    <tr>
                      <th>Nom dans le fichier</th>
                      <th>En français</th>
                      <th>Que mettre ?</th>
                      <th>Exemple</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleColumns.map((col) => (
                      <tr key={col.name}>
                        <td><code>{col.name}</code></td>
                        <td>
                          <strong>{col.label}</strong>
                          {col.required ? (
                            <div className="reports-need">Obligatoire</div>
                          ) : (
                            <div className="reports-optional">Facultatif</div>
                          )}
                        </td>
                        <td>{col.help}</td>
                        <td>{col.example}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article className="reports-howto-card">
            <div className="reports-howto-num">3</div>
            <h2>Envoyer le fichier</h2>
            <p>Quand c’est rempli, déposez-le ici. On vous dira tout de suite s’il y a un souci.</p>

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
              onClick={() => !uploading && !busy && inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
              }}
              aria-label="Déposer le fichier de relevé"
              aria-busy={uploading}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                hidden
                disabled={uploading}
                onChange={(e) => handleFiles(e.target.files)}
              />
              {uploading ? (
                <div className="reports-dropzone-loading">
                  <Spinner size={36} label="Envoi en cours" />
                  <div className="reports-dropzone-title">Envoi en cours…</div>
                  <p>{uploadName || 'Vérification de votre fichier'}</p>
                  <div className="reports-progress-bar" aria-hidden="true">
                    <span className="reports-progress-bar-fill" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="reports-dropzone-title">Déposez votre fichier ici</div>
                  <p>ou cliquez pour le choisir · Excel (.xlsx) ou CSV</p>
                </>
              )}
            </section>
          </article>
        </section>

        {message && (
          <div className="reports-success" role="status">
            <strong>C’est bon.</strong> {message}
          </div>
        )}

        {(error || importErrors.length > 0) && (
          <div className="reports-error-panel" ref={errorRef} role="alert">
            <div className="reports-error-panel-head">
              <strong>À corriger dans votre fichier</strong>
              <p>{error || 'Voici les points à reprendre, puis renvoyez le fichier.'}</p>
            </div>
            {importErrors.length > 0 ? (
              <ul className="reports-error-list">
                {importErrors.map((item, idx) => (
                  <li key={`${item.row}-${item.column}-${idx}`}>
                    <div className="reports-error-where">
                      {item.row ? `Ligne ${item.row}` : 'Fichier'}
                      {item.column_label || item.column
                        ? ` · ${item.column_label || item.column}`
                        : ''}
                    </div>
                    <div className="reports-error-msg">{item.message}</div>
                    {item.how_to_fix ? (
                      <div className="reports-error-fix">
                        <span>Que faire :</span> {item.how_to_fix}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="reports-error-foot">
              Corrigez ces points dans Excel, enregistrez, puis renvoyez le fichier à l’étape 3.
            </p>
          </div>
        )}

        <section className={`reports-history ${isAdmin ? 'reports-history--admin' : ''}`}>
          <div className="reports-history-head">
            <div>
              <h2>
                {isAdmin
                  ? 'Télécharger les rapports des équipes'
                  : 'Mes rapports envoyés'}
              </h2>
              <p className="reports-history-sub">
                {isAdmin
                  ? 'Chaque ligne = un fichier déjà reçu. Cliquez sur « Télécharger » pour l’ouvrir sur votre ordinateur.'
                  : 'Retrouvez ici vos envois. Vous pouvez les re-télécharger si besoin.'}
              </p>
            </div>
            <div className="reports-history-tools">
              <LoadingButton
                className="reports-btn--ghost"
                loading={loadingList}
                loadingText="Actualisation…"
                onClick={() => refresh()}
                disabled={busy && !loadingList}
              >
                Actualiser la liste
              </LoadingButton>
              {isAdmin && (
                <label className="reports-search">
                  <span className="sr-only">Rechercher</span>
                  <input
                    type="search"
                    placeholder="Chercher un nom ou une date…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              )}
            </div>
          </div>

          {isAdmin && !loadingList && filteredRapports.length > 0 && (
            <div className="reports-admin-banner">
              <strong>Zone responsable</strong>
              <span>
                Téléchargez un rapport avec <em>Télécharger Excel</em>,
                corrigez-le avec <em>Modifier</em>, ou retirez-le avec <em>Supprimer</em>.
              </span>
            </div>
          )}

          {loadingList ? (
            <div className="reports-skeleton" aria-busy="true" aria-label="Chargement">
              {[1, 2, 3].map((i) => (
                <div key={i} className="reports-skeleton-row">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              ))}
            </div>
          ) : filteredRapports.length === 0 ? (
            <p className="reports-empty">
              {query
                ? 'Aucun résultat pour cette recherche.'
                : 'Aucun rapport pour l’instant. Commencez par l’étape 1 ci-dessus.'}
            </p>
          ) : (
            <div className="reports-cards">
              {filteredRapports.map((r) => {
                const keyX = `${r.id}:xlsx`
                const keyC = `${r.id}:csv`
                return (
                  <article key={r.id} className="reports-card">
                    <div className="reports-card-main">
                      <div className="reports-card-title">Rapport n°{r.id}</div>
                      <div className="reports-card-meta">
                        Période : <strong>{formatDate(r.date_debut)} → {formatDate(r.date_fin)}</strong>
                      </div>
                      <div className="reports-card-meta">
                        {r.lignes_count ?? 0} ligne(s) de relevé
                        {isAdmin ? (
                          <>
                            {' · '}
                            Envoyé par : <strong>{r.created_by_username || 'Non indiqué'}</strong>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="reports-card-actions">
                      <LoadingButton
                        className="reports-btn--primary reports-btn--download"
                        loading={downloadingRapport === keyX}
                        loadingText="Téléchargement…"
                        disabled={busy && downloadingRapport !== keyX}
                        onClick={() => handleDownloadRapport(r.id, 'xlsx')}
                      >
                        Télécharger Excel
                      </LoadingButton>
                      <LoadingButton
                        className="reports-btn--ghost"
                        loading={downloadingRapport === keyC}
                        loadingText="Téléchargement…"
                        disabled={busy && downloadingRapport !== keyC}
                        onClick={() => handleDownloadRapport(r.id, 'csv')}
                      >
                        CSV
                      </LoadingButton>
                      <LoadingButton
                        className="reports-btn--edit"
                        disabled={busy}
                        onClick={() => setEditingRapportId(r.id)}
                      >
                        Modifier
                      </LoadingButton>
                      {isAdmin && (
                        <LoadingButton
                          className="reports-btn--danger"
                          loading={deletingRapportId === r.id}
                          loadingText="Suppression…"
                          disabled={busy && deletingRapportId !== r.id}
                          onClick={() => handleDeleteRapport(r)}
                        >
                          Supprimer
                        </LoadingButton>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        {editingRapportId != null && (
          <RapportEditModal
            rapportId={editingRapportId}
            onClose={() => setEditingRapportId(null)}
            onSaved={() => refresh({ silent: true })}
          />
        )}
      </main>
    </div>
  )
}

export default ReportsPage
