import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'carburflow-theme'
const listeners = new Set()

function systemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

let current = localStorage.getItem(STORAGE_KEY) || systemTheme()

function apply(theme) {
  document.documentElement.dataset.theme = theme
}

apply(current)

export function toggleTheme() {
  current = current === 'dark' ? 'light' : 'dark'
  localStorage.setItem(STORAGE_KEY, current)
  apply(current)
  listeners.forEach((listener) => listener())
}

export function useTheme() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current,
  )
}
