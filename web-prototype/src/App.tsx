// PROTOTYPE: three browse-page variants switchable via ?variant=, viewers shared.
// Question: which list / favorites / navigation structure reads best on a phone at high density?
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect } from 'react'
import { setNav, useNav } from './state'
import { Toast } from './ui'
import * as A from './variants/A'
import * as B from './variants/B'
import * as C from './variants/C'

const variants = { A: { name: A.name, C: A.VariantA }, B: { name: B.name, C: B.VariantB }, C: { name: C.name, C: C.VariantC } }
type Key = keyof typeof variants
const keys = Object.keys(variants) as Key[]

function PrototypeSwitcher({ current }: { current: Key }) {
  const i = keys.indexOf(current)
  const cycle = (d: number) => setNav({ variant: keys[(i + d + keys.length) % keys.length] })
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input,textarea,[contenteditable]')) return
      if (e.key === 'ArrowLeft') cycle(-1)
      if (e.key === 'ArrowRight') cycle(1)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  })
  return (
    <div className="fixed bottom-[68px] left-1/2 z-40 flex -translate-x-1/2 items-center rounded-full bg-[#111] text-[12px] text-white shadow-lg ring-1 ring-white/20">
      <button className="flex h-8 w-9 items-center justify-center" onClick={() => cycle(-1)}>
        <ChevronLeft size={16} />
      </button>
      <span className="px-1 whitespace-nowrap">
        {current} · {variants[current].name}
      </span>
      <button className="flex h-8 w-9 items-center justify-center" onClick={() => cycle(1)}>
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

export function App() {
  const nav = useNav()
  const key = (keys.includes(nav.variant as Key) ? nav.variant : 'A') as Key
  const V = variants[key].C
  return (
    <>
      <V />
      <Toast />
      {import.meta.env.DEV && <PrototypeSwitcher current={key} />}
    </>
  )
}
