/** Prénom / nom affichable pour un utilisateur connecté. */
export function getDisplayFirstName(user) {
  if (!user) return 'vous'
  const first = (user.first_name || '').trim()
  if (first) return first
  const full = (user.full_name || '').trim()
  if (full) return full.split(/\s+/)[0]
  return user.username || 'vous'
}

export function getDisplayFullName(user) {
  if (!user) return 'Utilisateur'
  const full = `${user.first_name || ''} ${user.last_name || ''}`.trim()
  if (full) return full
  if (user.full_name) return user.full_name
  return user.username || 'Utilisateur'
}
