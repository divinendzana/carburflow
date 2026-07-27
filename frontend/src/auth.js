const TOKEN_KEY = 'carburflow_token'
const USER_KEY = 'carburflow_user'

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function persistAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

function extractErrorMessage(data) {
  if (!data) return null
  if (typeof data.detail === 'string') return data.detail
  if (Array.isArray(data.errors) && data.errors.length) {
    const n = data.errors.length
    return n === 1
      ? 'Il y a 1 point à corriger dans votre fichier.'
      : `Il y a ${n} points à corriger dans votre fichier.`
  }
  if (Array.isArray(data.non_field_errors) && data.non_field_errors[0]) {
    return data.non_field_errors[0]
  }
  const firstField = Object.keys(data).find((key) => Array.isArray(data[key]) && data[key][0])
  if (firstField) return `${firstField}: ${data[firstField][0]}`
  return null
}

export async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) }
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  }

  // Plan free ngrok : sans ce header, /api peut renvoyer la page HTML d’avertissement
  // (ERR_NGROK_6024) au lieu du JSON → login / dashboard cassés.
  if (typeof window !== 'undefined' && /\.ngrok(-free)?\.(app|dev|io)$/i.test(window.location.hostname)) {
    headers['ngrok-skip-browser-warning'] = '1'
  }

  const token = getStoredToken()
  if (token) {
    headers.Authorization = `Token ${token}`
  }

  let response
  try {
    response = await fetch(path, { ...options, headers })
  } catch {
    throw new Error(
      'Impossible de joindre le serveur pour le moment. Réessayez dans un instant.',
    )
  }

  // Proxy Vite down / backend down → souvent HTML ou corps vide (pas du JSON)
  const contentType = response.headers.get('content-type') || ''
  if (response.status === 502 || response.status === 503 || response.status === 504) {
    throw new Error(
      'Le service est temporairement indisponible. Réessayez dans un instant.',
    )
  }

  if (options.raw || contentType.includes('application/octet-stream') || contentType.includes('spreadsheet') || contentType.includes('text/csv')) {
    if (!response.ok) {
      const text = await response.text()
      let data = null
      try { data = JSON.parse(text) } catch { data = { detail: text } }
      const error = new Error(extractErrorMessage(data) || 'Erreur réseau')
      error.status = response.status
      throw error
    }
    return response
  }

  let data = null
  const text = await response.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      // Réponse non-JSON (souvent HTML d’erreur proxy Vite si Django est down)
      if (!response.ok || text.includes('ECONNREFUSED') || text.includes('proxy error')) {
        throw new Error(
          'Le service est temporairement indisponible. Réessayez dans un instant.',
        )
      }
      data = { detail: text }
    }
  }

  if (!response.ok) {
    const error = new Error(
      extractErrorMessage(data)
        || (response.status >= 500
          ? 'Le serveur ne répond pas pour le moment. Réessayez dans un instant.'
          : 'Une erreur est survenue.'),
    )
    error.status = response.status
    error.data = data
    error.errors = Array.isArray(data?.errors) ? data.errors : []
    throw error
  }
  return data
}

/** fetch() avec Authorization Token — pour les pages dashboard existantes */
export function authFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) }
  const token = getStoredToken()
  if (token) headers.Authorization = `Token ${token}`
  return fetch(path, { ...options, headers })
}

export async function loginRequest(username, password) {
  return apiFetch('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export async function registerRequest(payload) {
  return apiFetch('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function meRequest() {
  return apiFetch('/api/v1/auth/me')
}

export async function logoutRequest() {
  try {
    await apiFetch('/api/v1/auth/logout', { method: 'POST' })
  } catch {
    // ignore
  } finally {
    clearAuth()
  }
}

export async function publicSitesRequest() {
  return apiFetch('/api/v1/auth/sites')
}

async function triggerBlobDownload(response, filename) {
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function downloadNorme(format = 'xlsx') {
  const response = await apiFetch(`/api/v1/rapports/norme.${format}`, { raw: true })
  await triggerBlobDownload(response, `carburflow_norme_rapport.${format}`)
}

export async function downloadFicheHebdo(dateDebut, dateFin) {
  let url = '/api/v1/rapports/generer.xlsx'
  const params = new URLSearchParams()
  if (dateDebut) params.append('date_debut', dateDebut)
  if (dateFin) params.append('date_fin', dateFin)
  const query = params.toString()
  if (query) url += `?${query}`
  const response = await apiFetch(url, { raw: true })
  await triggerBlobDownload(response, 'carburflow_fiche_hebdo.xlsx')
}

export async function downloadRapport(rapportId, format = 'xlsx') {
  const response = await apiFetch(
    `/api/v1/rapports/${rapportId}/export.${format}`,
    { raw: true },
  )
  await triggerBlobDownload(response, `carburflow_rapport_${rapportId}.${format}`)
}

export async function uploadRapport(file) {
  const form = new FormData()
  form.append('file', file)
  return apiFetch('/api/v1/rapports/upload', { method: 'POST', body: form })
}

export async function listSoumissions() {
  return apiFetch('/api/v1/rapports/soumissions')
}

export async function listMesRapports() {
  return apiFetch('/api/v1/rapports/mes')
}

export async function normeMeta() {
  return apiFetch('/api/v1/rapports/norme')
}

export async function getRapport(rapportId) {
  return apiFetch(`/api/v1/rapports/${rapportId}`)
}

export async function updateRapport(rapportId, payload) {
  return apiFetch(`/api/v1/rapports/${rapportId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function listLignesRapport(rapportId) {
  const data = await apiFetch('/api/v1/lignes_rapport')
  const list = Array.isArray(data) ? data : (data?.results || [])
  return list.filter((ligne) => String(ligne.rapport) === String(rapportId))
}

export async function updateLigneRapport(ligneId, payload) {
  return apiFetch(`/api/v1/lignes_rapport/${ligneId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteRapport(rapportId) {
  return apiFetch(`/api/v1/rapports/${rapportId}/delete`, {
    method: 'DELETE',
  })
}
