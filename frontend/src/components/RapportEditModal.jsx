import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import {
  getRapport,
  listLignesRapport,
  updateLigneRapport,
  updateRapport,
} from '../auth.js'

function toInputDate(value) {
  if (!value) return ''
  const s = String(value)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  try {
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return ''
    return d.toISOString().slice(0, 10)
  } catch {
    return ''
  }
}

function RapportEditModal({ rapportId, onClose, onSaved }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [lignes, setLignes] = useState([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [rapport, allLignes] = await Promise.all([
          getRapport(rapportId),
          listLignesRapport(rapportId),
        ])
        if (cancelled) return
        setDateDebut(toInputDate(rapport.date_debut))
        setDateFin(toInputDate(rapport.date_fin))
        setLignes(
          (allLignes || []).map((l) => ({
            id: l.id,
            quantite_gasoil_cuve_principale: l.quantite_gasoil_cuve_principale ?? '',
            quantite_gasoil_cuve_journaliere: l.quantite_gasoil_cuve_journaliere ?? '',
            compteur_horaire: l.compteur_horaire ?? '',
            depotage: l.depotage ?? '',
            etat_fonctionnement: l.etat_fonctionnement ?? '',
            observations: l.observations ?? '',
            cuve_principale: l.cuve_principale,
            cuve_journaliere: l.cuve_journaliere,
            groupe_electrogene: l.groupe_electrogene,
          })),
        )
      } catch (err) {
        if (!cancelled) setError(err.message || 'Impossible de charger ce rapport.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [rapportId])

  const updateLine = (id, field, value) => {
    setLignes((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)))
  }

  const handleSave = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      if (!dateDebut || !dateFin) {
        throw new Error('Indiquez la date de début et la date de fin.')
      }
      await updateRapport(rapportId, {
        date_debut: dateDebut,
        date_fin: dateFin,
      })
      await Promise.all(
        lignes.map((l) => updateLigneRapport(l.id, {
          quantite_gasoil_cuve_principale: l.quantite_gasoil_cuve_principale === '' ? null : Number(l.quantite_gasoil_cuve_principale),
          quantite_gasoil_cuve_journaliere: l.quantite_gasoil_cuve_journaliere === '' ? null : Number(l.quantite_gasoil_cuve_journaliere),
          compteur_horaire: l.compteur_horaire === '' ? null : Number(l.compteur_horaire),
          depotage: l.depotage === '' ? null : Number(l.depotage),
          etat_fonctionnement: l.etat_fonctionnement || null,
          observations: l.observations || null,
        })),
      )
      setMessage('Modifications enregistrées.')
      onSaved?.()
    } catch (err) {
      setError(err.message || 'Enregistrement impossible pour le moment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rapport-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="rapport-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rapport-edit-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="rapport-modal-head">
          <div>
            <p className="rapport-modal-kicker">Modification</p>
            <h2 id="rapport-edit-title">Corriger le rapport n°{rapportId}</h2>
            <p>Changez les dates ou les chiffres, puis enregistrez.</p>
          </div>
          <button type="button" className="rapport-modal-close" onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </button>
        </header>

        {loading ? (
          <div className="rapport-modal-loading">Chargement du rapport…</div>
        ) : (
          <form className="rapport-modal-form" onSubmit={handleSave}>
            <fieldset className="rapport-modal-fieldset">
              <legend>Période du relevé</legend>
              <div className="rapport-modal-dates">
                <label>
                  <span>Date de début</span>
                  <input
                    type="date"
                    value={dateDebut}
                    onChange={(e) => setDateDebut(e.target.value)}
                    required
                  />
                </label>
                <label>
                  <span>Date de fin</span>
                  <input
                    type="date"
                    value={dateFin}
                    onChange={(e) => setDateFin(e.target.value)}
                    required
                  />
                </label>
              </div>
            </fieldset>

            {lignes.length === 0 ? (
              <p className="rapport-modal-empty">Aucune ligne de relevé dans ce rapport.</p>
            ) : (
              <div className="rapport-modal-lignes">
                {lignes.map((l, idx) => (
                  <fieldset key={l.id} className="rapport-modal-fieldset">
                    <legend>
                      Ligne {idx + 1}
                      {(l.cuve_principale || l.groupe_electrogene) ? (
                        <span className="rapport-modal-refs">
                          {l.cuve_principale ? ` · Cuve ${l.cuve_principale}` : ''}
                          {l.groupe_electrogene ? ` · Groupe ${l.groupe_electrogene}` : ''}
                        </span>
                      ) : null}
                    </legend>
                    <div className="rapport-modal-grid">
                      <label>
                        <span>Gasoil cuve principale (L)</span>
                        <input
                          type="number"
                          step="any"
                          value={l.quantite_gasoil_cuve_principale}
                          onChange={(e) => updateLine(l.id, 'quantite_gasoil_cuve_principale', e.target.value)}
                        />
                      </label>
                      <label>
                        <span>Gasoil cuve journalière (L)</span>
                        <input
                          type="number"
                          step="any"
                          value={l.quantite_gasoil_cuve_journaliere}
                          onChange={(e) => updateLine(l.id, 'quantite_gasoil_cuve_journaliere', e.target.value)}
                        />
                      </label>
                      <label>
                        <span>Compteur horaire</span>
                        <input
                          type="number"
                          step="any"
                          value={l.compteur_horaire}
                          onChange={(e) => updateLine(l.id, 'compteur_horaire', e.target.value)}
                        />
                      </label>
                      <label>
                        <span>Dépotage (L)</span>
                        <input
                          type="number"
                          step="any"
                          value={l.depotage}
                          onChange={(e) => updateLine(l.id, 'depotage', e.target.value)}
                        />
                      </label>
                      <label>
                        <span>État</span>
                        <input
                          type="text"
                          value={l.etat_fonctionnement}
                          onChange={(e) => updateLine(l.id, 'etat_fonctionnement', e.target.value)}
                          placeholder="ex. F"
                        />
                      </label>
                      <label className="rapport-modal-span2">
                        <span>Observations</span>
                        <input
                          type="text"
                          value={l.observations}
                          onChange={(e) => updateLine(l.id, 'observations', e.target.value)}
                          placeholder="ex. RAS"
                        />
                      </label>
                    </div>
                  </fieldset>
                ))}
              </div>
            )}

            {error && <div className="reports-error" role="alert">{error}</div>}
            {message && <div className="reports-success" role="status">{message}</div>}

            <footer className="rapport-modal-actions">
              <button type="button" className="reports-btn reports-btn--ghost" onClick={onClose} disabled={saving}>
                Annuler
              </button>
              <button type="submit" className="reports-btn reports-btn--primary" disabled={saving}>
                {saving ? 'Enregistrement…' : 'Enregistrer les corrections'}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  )
}

export default RapportEditModal
