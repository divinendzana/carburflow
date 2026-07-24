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

  const token = getStoredToken()
  if (token) {
    headers.Authorization = `Token ${token}`
  }

  const response = await fetch(path, { ...options, headers })
  const contentType = response.headers.get('content-type') || ''

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
    try { data = JSON.parse(text) } catch { data = { detail: text } }
  }

  if (!response.ok) {
    const error = new Error(extractErrorMessage(data) || 'Une erreur est survenue.')
    error.status = response.status
    error.data = data
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

export async function downloadNorme(format = 'xlsx') {
  const response = await apiFetch(`/api/v1/rapports/norme.${format}`, { raw: true })
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `carburflow_norme_rapport.${format}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
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
