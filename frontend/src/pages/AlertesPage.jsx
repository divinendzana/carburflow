import { useEffect, useState } from 'react'
import Topbar from '../components/Topbar'
import { BarChart } from '../components/ChartCanvas'
import { LoadingState, DemoBanner } from '../components/PageState'
import {
  fetchAlertes,
  fetchSites,
  fetchGroupes,
  createSite,
  deleteSite,
  createGroupe,
  deleteGroupe,
} from '../lib/api'
import { fmt, fmtInt } from '../lib/format'

function AlertCard({ alert }) {
  return (
    <div className={`alert-card alert-${alert.level}`}>
      <div className="alert-card-head">
        <span className="alert-type">{alert.type}</span>
        <span className="alert-pct">{fmt(alert.pct, '%')}</span>
      </div>
      <strong className="alert-label">{alert.label}</strong>
      <div className="alert-fill">
        <span style={{ width: `${Math.min(100, Math.max(2, alert.pct))}%` }} />
      </div>
      <span className="alert-detail">
        {fmt(alert.volume, 'L')} / {fmt(alert.capacity, 'L')}
      </span>
    </div>
  )
}

function ManagementPanel({ onChanged }) {
  const [sites, setSites] = useState([])
  const [groupes, setGroupes] = useState([])
  const [siteForm, setSiteForm] = useState({ nom_site: '', localisation: '' })
  const [groupeForm, setGroupeForm] = useState({ marque: '', puissance: '', consommation_horaire: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const reload = async () => {
    const [s, g] = await Promise.all([fetchSites(), fetchGroupes()])
    setSites(s.data)
    setGroupes(g.data)
  }

  useEffect(() => {
    reload()
  }, [])

  const guarded = async (action) => {
    setBusy(true)
    setError('')
    try {
      await action()
      await reload()
      onChanged?.()
    } catch (err) {
      setError("Opération impossible (backend indisponible ou données invalides).")
      console.warn(err)
    } finally {
      setBusy(false)
    }
  }

  const addSite = (event) => {
    event.preventDefault()
    if (!siteForm.nom_site.trim()) return
    guarded(async () => {
      await createSite({ nom_site: siteForm.nom_site.trim(), localisation: siteForm.localisation.trim() })
      setSiteForm({ nom_site: '', localisation: '' })
    })
  }

  const addGroupe = (event) => {
    event.preventDefault()
    if (!groupeForm.marque.trim()) return
    guarded(async () => {
      await createGroupe({
        marque: groupeForm.marque.trim(),
        puissance: groupeForm.puissance.trim(),
        consommation_horaire: Number(groupeForm.consommation_horaire) || 0,
        compteur_horaire: 0,
      })
      setGroupeForm({ marque: '', puissance: '', consommation_horaire: '' })
    })
  }

  return (
    <section className="metric-section">
      <div className="section-title-wrap">
        <span className="metric-label">Gestion</span>
        <h2>Ajout et retrait de sites / groupes</h2>
        <p className="group-header-meta">Création et suppression du parc supervisé via l'API REST.</p>
      </div>

      {error && <div className="demo-banner" role="alert">{error}</div>}

      <div className="management-grid">
        <div className="management-col">
          <h3 className="management-title">Sites ({sites.length})</h3>
          <form className="management-form" onSubmit={addSite}>
            <input
              type="text"
              placeholder="Nom du site"
              value={siteForm.nom_site}
              onChange={(e) => setSiteForm({ ...siteForm, nom_site: e.target.value })}
            />
            <input
              type="text"
              placeholder="Localisation"
              value={siteForm.localisation}
              onChange={(e) => setSiteForm({ ...siteForm, localisation: e.target.value })}
            />
            <button type="submit" className="filter-submit" disabled={busy}>Ajouter</button>
          </form>
          <ul className="management-list">
            {sites.map((site) => (
              <li key={site.id}>
                <span>{site.nom_site}{site.localisation ? ` — ${site.localisation}` : ''}</span>
                <button type="button" className="btn-delete" disabled={busy} onClick={() => guarded(() => deleteSite(site.id))}>
                  Supprimer
                </button>
              </li>
            ))}
            {!sites.length && <li className="management-empty">Aucun site.</li>}
          </ul>
        </div>

        <div className="management-col">
          <h3 className="management-title">Groupes électrogènes ({groupes.length})</h3>
          <form className="management-form" onSubmit={addGroupe}>
            <input
              type="text"
              placeholder="Marque"
              value={groupeForm.marque}
              onChange={(e) => setGroupeForm({ ...groupeForm, marque: e.target.value })}
            />
            <input
              type="text"
              placeholder="Puissance (ex. 250kVA)"
              value={groupeForm.puissance}
              onChange={(e) => setGroupeForm({ ...groupeForm, puissance: e.target.value })}
            />
            <input
              type="number"
              step="0.1"
              placeholder="Conso. L/h"
              value={groupeForm.consommation_horaire}
              onChange={(e) => setGroupeForm({ ...groupeForm, consommation_horaire: e.target.value })}
            />
            <button type="submit" className="filter-submit" disabled={busy}>Ajouter</button>
          </form>
          <ul className="management-list">
            {groupes.map((groupe) => (
              <li key={groupe.id}>
                <span>G#{groupe.id} — {groupe.marque || '—'} {groupe.puissance || ''} ({fmt(groupe.consommation_horaire, 'L/h')})</span>
                <button type="button" className="btn-delete" disabled={busy} onClick={() => guarded(() => deleteGroupe(groupe.id))}>
                  Supprimer
                </button>
              </li>
            ))}
            {!groupes.length && <li className="management-empty">Aucun groupe.</li>}
          </ul>
        </div>
      </div>
    </section>
  )
}

export default function AlertesPage({ onNavigate }) {
  const [alertes, setAlertes] = useState(null)
  const [demo, setDemo] = useState(false)

  const load = async () => {
    const { data, demo: isDemo } = await fetchAlertes()
    setAlertes(data)
    setDemo(isDemo)
  }

  useEffect(() => {
    load()
  }, [])

  if (!alertes) {
    return (
      <div className="app-shell dashboard-shell">
        <Topbar activeView="alertes" onNavigate={onNavigate} />
        <main className="groups-grid">
          <LoadingState label="Analyse des alertes…" />
        </main>
      </div>
    )
  }

  const kpis = [
    { label: 'Autonomie globale', value: alertes.global_autonomy_days != null ? fmt(alertes.global_autonomy_days, 'jours') : '∞', sub: 'stock total ÷ conso. journalière', tone: alertes.global_autonomy_days != null && alertes.global_autonomy_days < 30 ? 'danger' : 'ok' },
    { label: 'Stock global', value: fmt(alertes.total_stock, 'L'), sub: `sur ${fmt(alertes.total_capacity, 'L')}` },
    { label: 'Remplissage global', value: fmt(alertes.global_pct, '%'), sub: 'toutes cuves', tone: alertes.global_pct >= 50 ? 'ok' : alertes.global_pct >= 20 ? 'warn' : 'danger' },
    { label: 'Conso. journalière', value: fmt(alertes.daily_consumption, 'L/j'), sub: `dernier rapport (${alertes.latest_period_label || '—'})` },
    { label: 'Alertes critiques', value: fmtInt(alertes.critical.length), sub: 'niveaux < 20 %', tone: alertes.critical.length ? 'danger' : 'ok' },
  ]

  return (
    <div className="app-shell dashboard-shell">
      <Topbar activeView="alertes" onNavigate={onNavigate} />
      <DemoBanner visible={demo} />

      <main className="groups-grid">
        <section className="kpi-strip kpi-strip-5">
          {kpis.map((kpi) => (
            <div key={kpi.label} className={`kpi-card ${kpi.tone ? `kpi-${kpi.tone}` : ''}`}>
              <span className="kpi-label">{kpi.label}</span>
              <strong className="kpi-value">{kpi.value}</strong>
              <span className="kpi-sub">{kpi.sub}</span>
            </div>
          ))}
        </section>

        <section className="alerts-columns">
          <div className="alerts-block">
            <div className="section-title-wrap">
              <span className="metric-label alert-title-critical">Critiques</span>
              <h2>Niveaux critiques (&lt; 20 %)</h2>
            </div>
            <div className="alerts-list">
              {alertes.critical.length ? (
                alertes.critical.map((alert) => <AlertCard key={alert.label} alert={alert} />)
              ) : (
                <p className="management-empty">Aucune alerte critique. 🎉</p>
              )}
            </div>
          </div>

          <div className="alerts-block">
            <div className="section-title-wrap">
              <span className="metric-label alert-title-significant">Significatives</span>
              <h2>Niveaux à surveiller (20–50 %)</h2>
            </div>
            <div className="alerts-list">
              {alertes.significant.length ? (
                alertes.significant.map((alert) => <AlertCard key={alert.label} alert={alert} />)
              ) : (
                <p className="management-empty">Aucune alerte significative.</p>
              )}
            </div>
          </div>
        </section>

        <section className="metric-panel">
          <span className="metric-label">Classement</span>
          <h3>Top 10 des sites les plus gourmands</h3>
          <p className="group-header-meta">
            Consommation sur le dernier rapport ({alertes.latest_period_label || '—'}).
          </p>
          <div className="chart-card" style={{ marginTop: 12 }}>
            <BarChart
              labels={alertes.top_consumers.map((item) => item.site)}
              datasets={[{
                label: 'Consommation',
                data: alertes.top_consumers.map((item) => item.consumption),
                backgroundColor: '#f59e0b',
              }]}
              unit="L"
              height={300}
            />
          </div>
          <div className="ranking-list">
            {alertes.top_consumers.map((item, index) => (
              <div key={item.site} className="ranking-row">
                <span className="ranking-pos">#{index + 1}</span>
                <span className="ranking-name">{item.site}</span>
                <span className="ranking-value">{fmt(item.consumption, 'L')}</span>
                <span className="ranking-auto">
                  autonomie {item.autonomy_days != null ? fmt(item.autonomy_days, 'j') : '∞'}
                </span>
              </div>
            ))}
            {!alertes.top_consumers.length && <p className="management-empty">Pas de consommation calculable (un seul rapport).</p>}
          </div>
        </section>

        <ManagementPanel onChanged={load} />
      </main>
    </div>
  )
}
