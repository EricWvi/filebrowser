// PROTOTYPE variant C — 底部路径栏：内容区无顶栏，收藏为可折叠列表，文件夹/文件分组，表格式两列元信息。
import { ChevronDown, ChevronRight, Eye, EyeOff, Star } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatSize, formatTime, listing, lookup, parentOf, root, type Entry } from '../mock'
import { go, setNav, useFavorites, useNav } from '../state'
import { EntryIcon, EntryMenu } from '../ui'
import { FileView } from '../viewers'

export const name = '底部路径栏'

function Row({ e, sub }: { e: Entry; sub?: string }) {
  return (
    <EntryMenu entry={e}>
      <button
        onClick={() => go(e.path)}
        className="touch-row flex h-8 w-full items-center gap-2 px-3 text-left active:bg-hover data-[state=open]:bg-active"
      >
        <EntryIcon e={e} size={15} />
        <span className="min-w-0 flex-1 truncate text-[13.5px]">
          {e.name}
          {sub && <span className="ml-1.5 font-mono text-[11px] text-faint">{sub}</span>}
        </span>
        <span className="w-[52px] shrink-0 text-right text-[11px] text-muted tabular-nums">{e.dir ? e.size : formatSize(e.size)}</span>
        <span className="w-[62px] shrink-0 text-right text-[11px] text-faint">{formatTime(e.mtime)}</span>
      </button>
    </EntryMenu>
  )
}

function Section({ title, count, children, collapsible }: { title: string; count: number; children: React.ReactNode; collapsible?: boolean }) {
  const [open, setOpen] = useState(true)
  if (!count) return null
  return (
    <section>
      <button
        disabled={!collapsible}
        onClick={() => setOpen(!open)}
        className="sticky top-0 z-[5] flex h-7 w-full items-center gap-1 border-b border-line bg-bg/95 px-3 text-[11.5px] font-medium text-muted backdrop-blur"
      >
        {collapsible && (open ? <ChevronDown size={13} /> : <ChevronRight size={13} />)}
        {title}
        <span className="font-normal text-faint">{count}</span>
      </button>
      {open && <div className="py-0.5">{children}</div>}
    </section>
  )
}

function PathBar({ e }: { e: Entry }) {
  const { hidden } = useNav()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.scrollTo({ left: ref.current.scrollWidth })
  }, [e.path])
  const segs = e.path.split('/').filter(Boolean)
  const seg = (label: string, p: string, current: boolean) => (
    <button
      key={p}
      onClick={() => !current && go(p)}
      className={`h-7 shrink-0 rounded-[3px] px-2 text-[13px] ${current ? 'bg-active font-medium' : 'text-muted active:bg-hover'}`}
    >
      {label}
    </button>
  )
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-1 border-t border-line bg-bg/95 pt-1.5 pr-1.5 pb-[max(6px,env(safe-area-inset-bottom))] pl-1.5 backdrop-blur">
      <div ref={ref} className="no-scrollbar flex min-w-0 flex-1 items-center overflow-x-auto">
        {seg(root.name, '/', segs.length === 0)}
        {segs.map((s, i) => (
          <span key={i} className="flex shrink-0 items-center">
            <span className="text-faint">/</span>
            {seg(s, '/' + segs.slice(0, i + 1).join('/'), i === segs.length - 1)}
          </span>
        ))}
      </div>
      <button
        aria-label="隐藏文件"
        onClick={() => setNav({ hidden: !hidden })}
        className={`flex h-7 w-8 shrink-0 items-center justify-center rounded-[3px] ${hidden ? 'bg-active text-fg' : 'text-muted'} active:bg-hover`}
      >
        {hidden ? <Eye size={16} strokeWidth={1.7} /> : <EyeOff size={16} strokeWidth={1.7} />}
      </button>
    </nav>
  )
}

export function VariantC() {
  const nav = useNav()
  const entry = lookup(nav.path) ?? root
  const favPaths = useFavorites()
  const favs = favPaths
    .map((p) => lookup(p))
    .filter(Boolean) as Entry[]
  const items = entry.dir ? listing(entry, nav.hidden) : []
  const dirs = items.filter((e) => e.dir)
  const files = items.filter((e) => !e.dir)
  return (
    <div className="min-h-dvh pb-28">
      {entry.dir ? (
        <>
          {entry.path === '/' && (
            <Section title="收藏" count={favs.length} collapsible>
              {favs.map((e) => (
                <Row key={e.path} e={e} sub={parentOf(e.path) === '/' ? undefined : parentOf(e.path).slice(1)} />
              ))}
            </Section>
          )}
          <Section title="文件夹" count={dirs.length}>
            {dirs.map((e) => (
              <Row key={e.path} e={e} />
            ))}
          </Section>
          <Section title="文件" count={files.length}>
            {files.map((e) => (
              <Row key={e.path} e={e} />
            ))}
          </Section>
        </>
      ) : (
        <>
          <div className="flex h-9 items-center gap-1.5 px-3 text-[14px] font-medium">
            <EntryIcon e={entry} size={15} />
            <span className="truncate">{entry.name}</span>
            {favPaths.includes(entry.path) && <Star size={13} className="shrink-0 text-accent" fill="currentColor" />}
          </div>
          <div className="border-t border-line">
            <FileView entry={entry} />
          </div>
        </>
      )}
      <PathBar e={entry} />
    </div>
  )
}
