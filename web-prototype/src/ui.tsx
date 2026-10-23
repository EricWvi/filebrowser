// PROTOTYPE: shared bits — file icons, long-press menu, toast.
import * as CM from '@radix-ui/react-context-menu'
import { Copy, Download, File, FileCode, FileImage, FileText, FileVideo, FileAudio, Folder, Star, StarOff, FileArchive } from 'lucide-react'
import type { ReactNode } from 'react'
import { kindOf, type Entry } from './mock'
import { copyText, toggleFavorite, useFavorites, useToast, toast } from './state'

export function EntryIcon({ e, size = 16 }: { e: Entry; size?: number }) {
  const p = { size, strokeWidth: 1.6, className: 'shrink-0' }
  if (e.dir) return <Folder {...p} className="shrink-0 text-folder" fill="currentColor" fillOpacity={0.18} />
  const { kind } = kindOf(e)
  const cls = 'shrink-0 text-muted'
  if (kind === 'markdown' || kind === 'text') return <FileText {...p} className={cls} />
  if (kind === 'code') return <FileCode {...p} className={cls} />
  if (kind === 'image') return <FileImage {...p} className={cls} />
  if (kind === 'video') return <FileVideo {...p} className={cls} />
  if (kind === 'audio') return <FileAudio {...p} className={cls} />
  if (/\.(gz|zip|tar|7z)$/.test(e.name)) return <FileArchive {...p} className={cls} />
  return <File {...p} className={cls} />
}

const itemCls =
  'flex h-9 cursor-default items-center gap-2.5 rounded-[3px] px-2.5 text-[14px] outline-none select-none data-[highlighted]:bg-hover'

/** Long press on touch, right click on desktop. Radix handles the touch timer. */
export function EntryMenu({ entry, children }: { entry: Entry; children: ReactNode }) {
  const favs = useFavorites()
  const fav = favs.includes(entry.path)
  return (
    <CM.Root>
      <CM.Trigger asChild>{children}</CM.Trigger>
      <CM.Portal>
        <CM.Content
          collisionPadding={8}
          className="z-50 min-w-[180px] rounded-[5px] border border-line bg-raised p-1 shadow-[0_6px_24px_rgba(0,0,0,0.14)]"
        >
          <CM.Label className="max-w-[240px] truncate px-2.5 pt-1 pb-1.5 text-[12px] text-muted">{entry.name}</CM.Label>
          <CM.Item className={itemCls} onSelect={() => toggleFavorite(entry.path)}>
            {fav ? <StarOff size={15} strokeWidth={1.6} /> : <Star size={15} strokeWidth={1.6} />}
            {fav ? '取消收藏' : '收藏'}
          </CM.Item>
          <CM.Item className={itemCls} onSelect={() => copyText(entry.path, '已复制路径')}>
            <Copy size={15} strokeWidth={1.6} />
            复制路径
          </CM.Item>
          {!entry.dir && (
            <CM.Item className={itemCls} onSelect={() => toast('原型：下载 ' + entry.name)}>
              <Download size={15} strokeWidth={1.6} />
              下载
            </CM.Item>
          )}
        </CM.Content>
      </CM.Portal>
    </CM.Root>
  )
}

export function Toast() {
  const t = useToast()
  if (!t) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center">
      <div key={t.id} className="rounded-[4px] bg-fg px-3 py-1.5 text-[13px] text-bg shadow">
        {t.text}
      </div>
    </div>
  )
}
