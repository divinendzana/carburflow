/**
 * Accès aux endpoints analytiques du backend CarburFlow.
 * Chaque fonction renvoie { data, demo } : `demo` vaut true si le backend est
 * injoignable et que des données de démonstration sont utilisées à la place.
 */

/**
 * Toutes les requêtes passent par le préfixe versionné /api/v1 afin de ne pas
 * entrer en conflit avec les routes du SPA (/dashboard/, /sites/, …).
 */
const API_BASE = '/api/v1'

async function getJson(path) {
  const response = await fetch(`${API_BASE}${path}`)
  if (!response.ok) {
    throw new Error(`Backend error ${response.status} on ${path}`)
  }
  return response.json()
}

async function sendJson(method, path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Backend error ${response.status} on ${path} ${detail}`)
  }
  return response.status === 204 ? null : response.json()
}

export const demoData = {
  etatCuves: {
    groupes_count: 3,
    dernier_rapport: { date_debut: '2026-07-13', date_fin: '2026-07-17' },
    total_volume_global: 6300,
    total_capacity_global: 12000,
    global_pct: 52.5,
    cp_chart_labels: ['CP #1 (BUF Bepanda)', 'CP #2 (BUF Bonaberi)', 'CP #3 (BUF Yaounde)'],
    cp_chart_pcts: [62, 40, 55],
    cp_chart_quantities: [2400, 1800, 2100],
    sites_cj_chart_data: {
      1: {
        labels: ['CJ #1', 'CJ #2', 'CJ #3'],
        percentages: [72, 88, 80],
        quantities: [720, 880, 800],
        colors: ['#0b3d7a', '#3b82f6', '#60a5fa'],
      },
    },
  },
  evolutionVolumes: {
    labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jui'],
    global_volumes: [1800, 2100, 2050, 2350, 2600, 2820],
    cp_volumes: [1400, 1600, 1550, 1800, 2000, 2200],
    total_capacity: 12000,
    period_days: [7, 7, 7, 7, 7, 7],
    sites_series: [
      { id: 1, nom_site: 'BUF Bepanda', label: 'BUF Bepanda', data: [700, 780, 760, 850, 920, 1000], borderColor: '#0b3d7a', backgroundColor: '#0b3d7a22' },
      { id: 2, nom_site: 'BUF Bonaberi', label: 'BUF Bonaberi', data: [560, 620, 610, 720, 760, 820], borderColor: '#3b82f6', backgroundColor: '#3b82f622' },
      { id: 3, nom_site: 'BUF Yaounde', label: 'BUF Yaounde', data: [540, 700, 680, 780, 920, 1000], borderColor: '#60a5fa', backgroundColor: '#60a5fa22' },
    ],
  },
  horairesGroupes: {
    labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jui'],
    global_hours: [42, 48, 54, 61, 58, 66],
    latest_total_hours: 66,
    default_site_id: 1,
    sites_data: {
      1: {
        nom_site: 'BUF Bepanda',
        datasets: [
          { label: 'G#1 (Perkins 250kVA)', data: [18, 21, 22, 24, 23, 26], borderColor: '#0b3d7a', backgroundColor: '#0b3d7a22' },
          { label: 'G#2 (Cummins 150kVA)', data: [12, 13, 15, 17, 16, 18], borderColor: '#3b82f6', backgroundColor: '#3b82f622' },
        ],
      },
      2: {
        nom_site: 'BUF Bonaberi',
        datasets: [
          { label: 'G#3 (SDMO 830kVA)', data: [10, 14, 17, 20, 19, 22], borderColor: '#60a5fa', backgroundColor: '#60a5fa22' },
        ],
      },
    },
  },
  consommation: {
    labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jui'],
    global_consumption: [380, 420, 460, 490, 520, 570],
    latest_total_liters: 570,
    sites_series: [
      { id: 1, nom_site: 'BUF Bepanda', label: 'BUF Bepanda', data: [130, 150, 170, 180, 190, 220], borderColor: '#0b3d7a', backgroundColor: '#0b3d7a22' },
      { id: 2, nom_site: 'BUF Bonaberi', label: 'BUF Bonaberi', data: [115, 130, 145, 150, 160, 175], borderColor: '#3b82f6', backgroundColor: '#3b82f622' },
      { id: 3, nom_site: 'BUF Yaounde', label: 'BUF Yaounde', data: [135, 140, 145, 160, 170, 175], borderColor: '#60a5fa', backgroundColor: '#60a5fa22' },
    ],
  },
  groupes: {
    period_label: 'Période de démonstration',
    previous_period_label: null,
    selected_site_id: 1,
    rapport_choices: [
      { id: 1, label: '01/01 au 07/01' },
      { id: 2, label: '08/01 au 14/01' },
    ],
    sites: [{ id: 1, nom_site: 'BUF Bepanda' }],
    site_hours: { total: 140.0, mean: 28.0, previous_total: 120.0, previous_mean: 24.0, variation_pct: 16.7, mean_variation_pct: 16.7, all_time_mean: 27.0, all_time_stddev: 5.2, has_previous_period: true },
    site_consumption: { total: 560.0, mean: 112.0, previous_total: 500.0, previous_mean: 100.0, variation_pct: 12.0, mean_variation_pct: 12.0, all_time_mean: 105.0, all_time_stddev: 9.8, has_previous_period: true },
    labels: ['01/01 au 07/01', '08/01 au 14/01'],
    group_blocks: [
      {
        id: 1,
        label: 'G#100 (Perkins 250kVA)',
        marque: 'Perkins',
        puissance: '250kVA',
        rate: 15.5,
        color: '#0d6efd',
        autonomie_hours: 42.3,
        hours: { total: 29.5, mean: 7.4, previous_total: null, previous_mean: null, variation_pct: null, mean_variation_pct: null, all_time_mean: 14.8, all_time_stddev: 3.6, has_previous_period: false },
        consumption_stats: { total: 457.3, mean: 114.3, previous_total: null, previous_mean: null, variation_pct: null, mean_variation_pct: null, all_time_mean: 228.7, all_time_stddev: 43.2, has_previous_period: false },
        hours_run: [15, 17],
        consumption: [95, 115],
        compteurs: [240, 300],
      },
    ],
  },
  cuves: {
    period_label: 'Période de démonstration',
    selected_site_id: 1,
    rapport_choices: [
      { id: 1, label: '01/01 au 07/01' },
      { id: 2, label: '08/01 au 14/01' },
    ],
    sites: [{ id: 1, nom_site: 'BUF Bepanda' }],
    site_principal_stats: { total: 18000, mean: 9000, previous_total: 16000, previous_mean: 8000, variation_pct: 12.5, mean_variation_pct: 12.5, all_time_mean: 8500, all_time_stddev: 1200, has_previous_period: true },
    site_journalier_stats: { total: 9200, mean: 4600, previous_total: 8400, previous_mean: 4200, variation_pct: 9.5, mean_variation_pct: 9.5, all_time_mean: 4300, all_time_stddev: 650, has_previous_period: true },
    labels: ['01/01 au 07/01', '08/01 au 14/01'],
    principal_blocks: [
      { id: 1, label: 'CP #1 (BUF Bepanda)', capacity: 500000, color: '#0d6efd', values: [9000, 9600], stats: { total: 9600, mean: 4800, previous_total: 8500, previous_mean: 4250, variation_pct: 12.9, mean_variation_pct: 12.9, all_time_mean: 4500, all_time_stddev: 700, has_previous_period: true } },
      { id: 2, label: 'CP #2 (BUF Bepanda)', capacity: 450000, color: '#198754', values: [8000, 8400], stats: { total: 8400, mean: 4200, previous_total: 7500, previous_mean: 3750, variation_pct: 12.0, mean_variation_pct: 12.0, all_time_mean: 3900, all_time_stddev: 500, has_previous_period: true } },
    ],
    journalier_blocks: [
      { id: 1, label: 'CJ #1 (BUF Bepanda)', capacity: 150000, color: '#ffc107', values: [4700, 5000], stats: { total: 5000, mean: 2500, previous_total: 4700, previous_mean: 2350, variation_pct: 6.4, mean_variation_pct: 6.4, all_time_mean: 2400, all_time_stddev: 320, has_previous_period: true } },
      { id: 2, label: 'CJ #2 (BUF Bepanda)', capacity: 140000, color: '#dc3545', values: [3700, 4200], stats: { total: 4200, mean: 2100, previous_total: 3700, previous_mean: 1850, variation_pct: 13.5, mean_variation_pct: 13.5, all_time_mean: 2000, all_time_stddev: 280, has_previous_period: true } },
    ],
  },
}

demoData.alertes = {
  latest_period_label: '13/07/2026 → 17/07/2026',
  total_stock: 6300,
  total_capacity: 12000,
  global_pct: 52.5,
  daily_consumption: 114,
  global_autonomy_days: 55.3,
  critical: [
    { level: 'critical', type: 'Cuve principale', label: 'CP #3 — BUF Yaoundé', site: 'BUF Yaoundé', pct: 12, volume: 240, capacity: 2000 },
    { level: 'critical', type: 'Cuve journalière', label: 'CJ #5 — BUF Bonaberi', site: 'BUF Bonaberi', pct: 8, volume: 80, capacity: 1000 },
  ],
  significant: [
    { level: 'significant', type: 'Cuve principale', label: 'CP #2 — BUF Bonaberi', site: 'BUF Bonaberi', pct: 40, volume: 800, capacity: 2000 },
  ],
  top_consumers: [
    { site: 'BUF Bepanda', consumption: 220, daily_consumption: 44, stock: 2400, autonomy_days: 54.5 },
    { site: 'BUF Bonaberi', consumption: 175, daily_consumption: 35, stock: 1800, autonomy_days: 51.4 },
    { site: 'BUF Yaoundé', consumption: 130, daily_consumption: 26, stock: 900, autonomy_days: 34.6 },
  ],
}

export async function fetchEtatCuves() {
  try {
    return { data: await getJson('/dashboard/etat_cuves'), demo: false }
  } catch (error) {
    console.warn('etat_cuves indisponible, données de démonstration.', error)
    return { data: demoData.etatCuves, demo: true }
  }
}

export async function fetchDashboardMetrics() {
  try {
    const [etatCuves, evolutionVolumes, horairesGroupes, consommation] = await Promise.all([
      getJson('/dashboard/etat_cuves'),
      getJson('/dashboard/evolution_volumes'),
      getJson('/dashboard/horaires_groupes'),
      getJson('/dashboard/consommation'),
    ])
    return { data: { etatCuves, evolutionVolumes, horairesGroupes, consommation }, demo: false }
  } catch (error) {
    console.warn('Dashboard indisponible, données de démonstration.', error)
    return {
      data: {
        etatCuves: demoData.etatCuves,
        evolutionVolumes: demoData.evolutionVolumes,
        horairesGroupes: demoData.horairesGroupes,
        consommation: demoData.consommation,
      },
      demo: true,
    }
  }
}

export async function fetchSiteMetrics() {
  try {
    const [evolutionVolumes, horairesGroupes, consommation] = await Promise.all([
      getJson('/dashboard/evolution_volumes'),
      getJson('/dashboard/horaires_groupes'),
      getJson('/dashboard/consommation'),
    ])
    return { data: { evolutionVolumes, horairesGroupes, consommation }, demo: false }
  } catch (error) {
    console.warn('Sites indisponible, données de démonstration.', error)
    return {
      data: {
        evolutionVolumes: demoData.evolutionVolumes,
        horairesGroupes: demoData.horairesGroupes,
        consommation: demoData.consommation,
      },
      demo: true,
    }
  }
}

export async function fetchGroupesDashboard(queryParams = '') {
  try {
    const data = await getJson(`/dashboard/groupes${queryParams ? `?${queryParams}` : ''}`)
    return { data, demo: false }
  } catch (error) {
    console.warn('Groupes indisponible, données de démonstration.', error)
    return { data: demoData.groupes, demo: true }
  }
}

export async function fetchCuvesDashboard(queryParams = '') {
  try {
    const data = await getJson(`/dashboard/cuves${queryParams ? `?${queryParams}` : ''}`)
    return { data, demo: false }
  } catch (error) {
    console.warn('Cuves indisponible, données de démonstration.', error)
    return { data: demoData.cuves, demo: true }
  }
}

export async function fetchAlertes() {
  try {
    return { data: await getJson('/dashboard/alertes'), demo: false }
  } catch (error) {
    console.warn('alertes indisponible, données de démonstration.', error)
    return { data: demoData.alertes, demo: true }
  }
}

export async function fetchSites() {
  try {
    const data = await getJson('/sites')
    return { data: Array.isArray(data) ? data : data.results || [], demo: false }
  } catch (error) {
    console.warn('sites indisponible.', error)
    return { data: [], demo: true }
  }
}

export async function fetchGroupes() {
  try {
    const data = await getJson('/groupes')
    return { data: Array.isArray(data) ? data : data.results || [], demo: false }
  } catch (error) {
    console.warn('groupes indisponible.', error)
    return { data: [], demo: true }
  }
}

export const createSite = (body) => sendJson('POST', '/sites', body)
export const deleteSite = (id) => sendJson('DELETE', `/sites/${id}`)
export const createGroupe = (body) => sendJson('POST', '/groupes', body)
export const deleteGroupe = (id) => sendJson('DELETE', `/groupes/${id}`)

export async function fetchSiteCount() {
  try {
    const data = await getJson('/sites?limit=1')
    if (typeof data.count === 'number') return { data: data.count, demo: false }
    if (Array.isArray(data)) return { data: data.length, demo: false }
    if (typeof data.results?.length === 'number') return { data: data.results.length, demo: false }
    return { data: 0, demo: false }
  } catch (error) {
    console.warn('sites indisponible, données de démonstration.', error)
    return { data: 3, demo: true }
  }
}
