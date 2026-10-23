// PROTOTYPE variant B — 双行列表：顶部标题 + 路径，收藏为两列网格，底部拇指工具栏。
import { ArrowUp, ChevronLeft, Eye, EyeOff, House } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatSize, formatTime, listing, lookup, parentOf, root, type Entry } from '../mock'
import { back, go, setNav, useFavorites, useNav } from '../state'
import { afterTap } from '../press'
import { EntryIcon, EntryMenu } from '../ui'
import { FileView } from '../viewers'

export const name = '双行 + 底栏'

function Header({ e }: { e: Entry }) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-bg/90 px-3.5 pt-2 pb-1.5 backdrop-blur">
      <div className="truncate text-[16px] leading-6 font-semibold">{e.path === '/' ? root.name : e.name}</div>
      <div className="truncate font-mono text-[11px] leading-4 text-muted text-left" dir="rtl">
        {/* rtl keeps the tail of a long path visible */}
        <bdi>{'~/' + root.name + (e.path === '/' ? '' : e.path)}</bdi>
      </div>
    </header>
  )
}

function Row({ e }: { e: Entry }) {
  return (
    <EntryMenu entry={e}>
      <button
        onClick={() => afterTap(() => go(e.path))}
        className="touch-row flex h-12 w-full items-center gap-3 border-b border-line/70 px-3.5 text-left tap data-[state=open]:bg-active"
      >
        <EntryIcon e={e} size={20} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[14px] leading-5">{e.name}</span>
          <span className="truncate text-[11.5px] leading-4 text-muted">
            {formatTime(e.mtime)} · {e.dir ? `${e.size} 项` : formatSize(e.size)}
          </span>
        </span>
      </button>
    </EntryMenu>
  )
}

function Favorites() {
  const favs = useFavorites()
    .map((p) => lookup(p))
    .filter(Boolean) as Entry[]
  if (!favs.length) return null
  return (
    <section className="border-b border-line px-3 pt-2.5 pb-3">
      <div className="px-0.5 pb-1.5 text-[11.5px] font-medium tracking-wide text-muted">收藏</div>
      <div className="grid grid-cols-2 gap-1.5">
        {favs.map((e) => (
          <EntryMenu key={e.path} entry={e}>
            <button
              onClick={() => afterTap(() => go(e.path))}
              className="touch-row flex h-11 min-w-0 items-center gap-2 rounded-[4px] border border-line bg-raised px-2.5 text-left tap data-[state=open]:bg-active"
            >
              <EntryIcon e={e} size={16} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[13px] leading-4">{e.name}</span>
                <span className="truncate font-mono text-[10.5px] leading-4 text-faint">{parentOf(e.path)}</span>
              </span>
            </button>
          </EntryMenu>
        ))}
      </div>
    </section>
  )
}

function Tool({ onClick, children, label, disabled }: { onClick: () => void; children: ReactNode; label: string; disabled?: boolean }) {
  return (
    <button
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-10 flex-1 flex-col items-center justify-center gap-0.5 rounded-[4px] text-[10px] text-muted tap disabled:opacity-35"
    >
      {children}
      {label}
    </button>
  )
}

function Toolbar({ e }: { e: Entry }) {
  const { hidden } = useNav()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-bg/95 px-2 pt-1 pb-[max(4px,env(safe-area-inset-bottom))] backdrop-blur">
      <Tool label="返回" onClick={() => afterTap(back)} disabled={e.path === '/'}>
        <ChevronLeft size={18} strokeWidth={1.7} />
      </Tool>
      <Tool label="上级" onClick={() => afterTap(() => go(parentOf(e.path)))} disabled={e.path === '/'}>
        <ArrowUp size={18} strokeWidth={1.7} />
      </Tool>
      <Tool label="首页" onClick={() => afterTap(() => go('/'))} disabled={e.path === '/'}>
        <House size={18} strokeWidth={1.7} />
      </Tool>
      <Tool label={hidden ? '隐藏' : '显示隐藏'} onClick={() => setNav({ hidden: !hidden })}>
        {hidden ? <EyeOff size={18} strokeWidth={1.7} /> : <Eye size={18} strokeWidth={1.7} />}
      </Tool>
    </nav>
  )
}

export function VariantB() {
  const nav = useNav()
  const entry = lookup(nav.path) ?? root
  return (
    <div className="min-h-dvh pb-32">
      <Header e={entry} />
      {entry.dir ? (
        <>
          {entry.path === '/' && <Favorites />}
          {listing(entry, nav.hidden).map((e) => (
            <Row key={e.path} e={e} />
          ))}
        </>
      ) : (
        <FileView entry={entry} />
      )}
      <Toolbar e={entry} />
    </div>
  )
}
