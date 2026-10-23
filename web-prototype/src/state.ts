// PROTOTYPE: URL-backed navigation, in-memory favorites, toast. No persistence.
import { useEffect, useState, useSyncExternalStore } from 'react'

type Listener = () => void
function store<T>(initial: T) {
  let value = initial
  const listeners = new Set<Listener>()
  return {
    get: () => value,
    set: (next: T) => {
      value = next
      listeners.forEach((l) => l())
    },
    subscribe: (l: Listener) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
  }
}

// --- URL state ---------------------------------------------------------------

export type Nav = { path: string; variant: string; mode: 'render' | 'source'; hidden: boolean }

function readNav(): Nav {
  const q = new URLSearchParams(location.search)
  return {
    path: q.get('p') || '/',
    variant: q.get('variant') || 'A',
    mode: q.get('mode') === 'source' ? 'source' : 'render',
    hidden: q.get('hidden') === '1',
  }
}

const navStore = store<Nav>(readNav())
window.addEventListener('popstate', () => navStore.set(readNav()))

function writeNav(next: Nav, push: boolean) {
  const q = new URLSearchParams()
  q.set('variant', next.variant)
  if (next.path !== '/') q.set('p', next.path)
  if (next.mode === 'source') q.set('mode', 'source')
  if (next.hidden) q.set('hidden', '1')
  const url = `${location.pathname}?${q.toString().replace(/%2F/g, '/')}`
  if (push) history.pushState(null, '', url)
  else history.replaceState(null, '', url)
  navStore.set(next)
  if (push) window.scrollTo(0, 0)
}

export const useNav = () => useSyncExternalStore(navStore.subscribe, navStore.get)
export const go = (path: string) => writeNav({ ...navStore.get(), path, mode: 'render' }, true)
export const setNav = (patch: Partial<Nav>) => writeNav({ ...navStore.get(), ...patch }, false)
export const back = () => history.back()

// --- favorites ---------------------------------------------------------------

const favStore = store<string[]>(['/palace/README.md', '/dotfiles/selfhost', '/reading-list', '/filebrowser/main.go'])
export const useFavorites = () => useSyncExternalStore(favStore.subscribe, favStore.get)
export function toggleFavorite(p: string) {
  const cur = favStore.get()
  if (cur.includes(p)) {
    favStore.set(cur.filter((x) => x !== p))
    toast('已取消收藏')
  } else {
    favStore.set([...cur, p])
    toast('已收藏')
  }
}

// --- toast -------------------------------------------------------------------

const toastStore = store<{ id: number; text: string } | null>(null)
export const useToast = () => useSyncExternalStore(toastStore.subscribe, toastStore.get)
export function toast(text: string) {
  const id = Date.now()
  toastStore.set({ id, text })
  setTimeout(() => toastStore.get()?.id === id && toastStore.set(null), 1600)
}

export async function copyText(text: string, label = '已复制') {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Non-secure origins (LAN http) have no clipboard API.
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
  toast(label)
}

// --- color scheme ------------------------------------------------------------

export function useDark() {
  const mq = matchMedia('(prefers-color-scheme: dark)')
  const [dark, setDark] = useState(mq.matches)
  useEffect(() => {
    const on = () => setDark(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return dark
}
