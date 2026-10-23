// PROTOTYPE variant A — 紧凑单行：顶栏面包屑，收藏为横向滚动胶囊，单行列表右侧对齐元信息。
import * as DM from '@radix-ui/react-dropdown-menu'
import { ChevronLeft, ChevronRight, Eye, EyeOff, MoreHorizontal } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { formatSize, formatTime, listing, lookup, root, type Entry } from '../mock'
import { back, go, setNav, useFavorites, useNav } from '../state'
import { EntryIcon, EntryMenu } from '../ui'
import { FileView } from '../viewers'

export const name = '紧凑单行'

function Crumbs({ path }: { path: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.scrollTo({ left: ref.current.scrollWidth })
  }, [path])
  const segs = path.split('/').filter(Boolean)
  return (
    <div ref={ref} className="no-scrollbar flex min-w-0 flex-1 items-center overflow-x-auto text-[14px] whitespace-nowrap">
      <button className={`shrink-0 px-1 ${segs.length ? 'text-muted' : 'font-semibold'}`} onClick={() => go('/')}>
        {root.name}
      </button>
      {segs.map((s, i) => {
        const p = '/' + segs.slice(0, i + 1).join('/')
        const last = i === segs.length - 1
        return (
          <span key={p} className="flex shrink-0 items-center">
            <ChevronRight size={13} className="text-faint" />
            <button className={`px-1 ${last ? 'font-semibold' : 'text-muted'}`} onClick={() => !last && go(p)}>
              {s}
            </button>
          </span>
        )
      })}
    </div>
  )
}

function Header({ path }: { path: string }) {
  const { hidden } = useNav()
  return (
    <header className="sticky top-0 z-10 flex h-11 items-center gap-1 border-b border-line bg-bg/90 px-1.5 backdrop-blur">
      {path !== '/' && (
        <button aria-label="返回" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] active:bg-hover" onClick={back}>
          <ChevronLeft size={20} strokeWidth={1.8} />
        </button>
      )}
      <Crumbs path={path} />
      <DM.Root>
        <DM.Trigger aria-label="更多" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] text-muted outline-none active:bg-hover">
          <MoreHorizontal size={18} strokeWidth={1.8} />
        </DM.Trigger>
        <DM.Portal>
          <DM.Content align="end" sideOffset={4} className="z-50 min-w-[170px] rounded-[5px] border border-line bg-raised p-1 shadow-[0_6px_24px_rgba(0,0,0,0.14)]">
            <DM.Item
              onSelect={() => setNav({ hidden: !hidden })}
              className="flex h-9 items-center gap-2.5 rounded-[3px] px-2.5 text-[14px] outline-none data-[highlighted]:bg-hover"
            >
              {hidden ? <EyeOff size={15} strokeWidth={1.6} /> : <Eye size={15} strokeWidth={1.6} />}
              {hidden ? '隐藏隐藏文件' : '显示隐藏文件'}
            </DM.Item>
          </DM.Content>
        </DM.Portal>
      </DM.Root>
    </header>
  )
}

function Row({ e }: { e: Entry }) {
  return (
    <EntryMenu entry={e}>
      <button
        onClick={() => go(e.path)}
        className="touch-row flex h-9 w-full items-center gap-2.5 border-b border-line/70 pr-3 pl-3.5 text-left active:bg-hover data-[state=open]:bg-active"
      >
        <EntryIcon e={e} />
        <span className="min-w-0 flex-1 truncate text-[14px]">{e.name}</span>
        <span className="w-14 shrink-0 text-right text-[11.5px] text-muted tabular-nums">{e.dir ? `${e.size} 项` : formatSize(e.size)}</span>
        <span className="w-[68px] shrink-0 text-right text-[11.5px] text-faint">{formatTime(e.mtime)}</span>
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
    <section className="border-b border-line py-2">
      <div className="px-3.5 pb-1.5 text-[11.5px] font-medium tracking-wide text-muted">收藏</div>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-3">
        {favs.map((e) => (
          <EntryMenu key={e.path} entry={e}>
            <button
              onClick={() => go(e.path)}
              className="touch-row flex h-8 max-w-[200px] shrink-0 items-center gap-1.5 rounded-[4px] border border-line bg-raised px-2.5 text-[13px] active:bg-hover data-[state=open]:bg-active"
            >
              <EntryIcon e={e} size={14} />
              <span className="truncate">{e.name}</span>
            </button>
          </EntryMenu>
        ))}
      </div>
    </section>
  )
}

export function VariantA() {
  const nav = useNav()
  const entry = lookup(nav.path) ?? root
  return (
    <div className="min-h-dvh pb-24">
      <Header path={entry.path} />
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
    </div>
  )
}
