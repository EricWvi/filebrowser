// PROTOTYPE: file viewers shared by all variants.
import { Check, Copy, Download, ExternalLink, Maximize2, X } from 'lucide-react'
import { useEffect, useId, useState, type ReactNode } from 'react'
import Markdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { formatSize, formatTime, kindOf, lookup, resolveRelative, svgDataUrl, type Entry } from './mock'
import { copyText, go, setNav, toast, useDark, useNav } from './state'
import { afterTap } from './press'
import { EntryIcon } from './ui'

// --- highlighting -------------------------------------------------------------

const cache = new Map<string, string>()
function useHighlight(code: string, lang: string) {
  const key = lang + '\0' + code
  const [html, setHtml] = useState(() => cache.get(key) ?? null)
  useEffect(() => {
    if (cache.has(key)) return setHtml(cache.get(key)!)
    let live = true
    import('shiki').then(async ({ codeToHtml, bundledLanguages }) => {
      const out = await codeToHtml(code, {
        lang: lang in bundledLanguages ? lang : 'text',
        themes: { light: 'github-light', dark: 'github-dark' },
        defaultColor: false,
      })
      cache.set(key, out)
      if (live) setHtml(out)
    })
    return () => {
      live = false
    }
  }, [key])
  return html
}

const preCls = '[&_pre]:[tab-size:4] [&_pre]:m-0 [&_pre]:w-max [&_pre]:min-w-full [&_pre]:py-2 [&_pre]:pr-4 [&_pre]:pl-3'

/**
 * Line numbers live in a separate, non-scrolling, non-selectable column,
 * so selecting code never picks them up and they stay put while dragging sideways.
 */
export function CodeView({ code, lang }: { code: string; lang: string }) {
  const html = useHighlight(code, lang)
  const text = code.endsWith('\n') ? code.slice(0, -1) : code
  const lines = text.split('\n').length
  return (
    <div className="flex font-mono text-[12.5px] leading-[1.6]">
      <pre
        aria-hidden
        className="m-0 shrink-0 border-r border-line py-2 pr-2.5 pl-3 text-right text-faint select-none"
        style={{ minWidth: `calc(${String(lines).length}ch + 1.4rem)` }}
      >
        {Array.from({ length: lines }, (_, i) => i + 1).join('\n')}
      </pre>
      <div className={`min-w-0 flex-1 overflow-x-auto overscroll-x-contain ${preCls}`}>
        {html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <pre>{text}</pre>}
      </div>
    </div>
  )
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const html = useHighlight(code.replace(/\n$/, ''), lang)
  return (
    <div className="group relative rounded-[3px] border border-line bg-code">
      <div className="flex h-7 items-center justify-between border-b border-line pr-1 pl-3 font-mono text-[11px] text-muted">
        <span>{lang || 'text'}</span>
        <button className="flex h-6 w-7 items-center justify-center rounded-[3px] tap" onClick={() => copyText(code)}>
          <Copy size={13} strokeWidth={1.7} />
        </button>
      </div>
      <div className={`overflow-x-auto font-mono text-[12.5px] leading-[1.6] ${preCls}`}>
        {html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <pre>{code}</pre>}
      </div>
    </div>
  )
}

// --- mermaid ------------------------------------------------------------------

function Mermaid({ code }: { code: string }) {
  const dark = useDark()
  const id = 'm' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const [svg, setSvg] = useState<string | null>(null)
  const [fullSvg, setFullSvg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    import('mermaid').then(async ({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'neutral', fontFamily: 'inherit', securityLevel: 'strict' })
      try {
        const rid = `${id}${dark ? 'd' : 'l'}`
        const { svg } = await mermaid.render(rid, code)
        if (live) setSvg(svg)
        // Fullscreen copy: own id (mermaid scopes styles by #id) and explicit natural size.
        const [, , w, h] = /viewBox="([^"]+)"/.exec(svg)?.[1].split(/\s+/).map(Number) ?? []
        if (live)
          setFullSvg(
            svg
              .replaceAll(rid, rid + 'f')
              .replace('width="100%"', `width="${w}" height="${h}"`)
              .replace(/max-width:\s*[\d.]+px;?/, ''),
          )
      } catch (e) {
        if (live) setErr(String(e))
      }
    })
    return () => {
      live = false
    }
  }, [code, dark])
  const [full, setFull] = useState(false)
  if (err) return <CodeBlock code={code} lang="mermaid" />
  return (
    <>
      {/* Inline: fit to width for the overview. Tap: fullscreen at natural size, pan both ways. */}
      <button
        onClick={() => svg && setFull(true)}
        className="relative block w-full rounded-[3px] border border-line px-2 py-3 tap [&_svg]:mx-auto [&_svg]:h-auto"
      >
        {svg ? <div dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="h-24" />}
        {svg && <Maximize2 size={13} strokeWidth={1.7} className="absolute top-1.5 right-1.5 text-faint" />}
      </button>
      {full && fullSvg && (
        <div className="fixed inset-0 z-50 flex flex-col bg-bg">
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-line pr-1 pl-3 text-[12.5px] text-muted">
            <span>mermaid</span>
            <button aria-label="关闭" onClick={() => setFull(false)} className="flex h-8 w-8 items-center justify-center rounded-[4px] tap">
              <X size={18} strokeWidth={1.7} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4 [&_svg]:!max-w-none" style={{ touchAction: 'pan-x pan-y pinch-zoom' }}>
            <div className="w-max" dangerouslySetInnerHTML={{ __html: fullSvg }} />
          </div>
        </div>
      )}
    </>
  )
}

// --- markdown -----------------------------------------------------------------

type HNode = { type: string; value?: string; tagName?: string; properties?: Record<string, unknown>; children?: HNode[] }
const hText = (n: HNode): string => (n.type === 'text' ? n.value ?? '' : (n.children ?? []).map(hText).join(''))

function assetUrl(e: Entry | undefined) {
  if (!e?.content) return undefined
  return e.name.endsWith('.svg') ? svgDataUrl(e.content) : undefined
}

export function MarkdownView({ entry }: { entry: Entry }) {
  return (
    <article className="md mx-auto max-w-[760px] px-4 pt-3 pb-16">
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          pre: ({ node }) => {
            const code = (node as HNode).children?.find((c) => c.tagName === 'code')
            const cls = (code?.properties?.className as string[] | undefined) ?? []
            const lang = cls.find((c) => c.startsWith('language-'))?.slice(9) ?? ''
            const text = code ? hText(code) : ''
            return lang === 'mermaid' ? <Mermaid code={text} /> : <CodeBlock code={text} lang={lang} />
          },
          table: ({ children }) => (
            <div className="table-wrap">
              <table>{children}</table>
            </div>
          ),
          img: ({ src, alt }) => {
            const s = typeof src === 'string' ? src : ''
            const local = /^[a-z]+:/i.test(s) ? s : assetUrl(lookup(resolveRelative(entry.path, s)))
            return <img src={local} alt={alt} />
          },
          a: ({ href = '', children }) => {
            if (/^[a-z]+:/i.test(href) || href.startsWith('#'))
              return (
                <a href={href} target="_blank" rel="noreferrer">
                  {children}
                </a>
              )
            const target = resolveRelative(entry.path, href)
            return (
              <a
                href={'?p=' + target}
                onClick={(ev) => {
                  ev.preventDefault()
                  lookup(target) ? afterTap(() => go(target)) : toast('原型：不存在 ' + target)
                }}
              >
                {children}
              </a>
            )
          },
        }}
      >
        {entry.content ?? ''}
      </Markdown>
    </article>
  )
}

// --- dispatcher -----------------------------------------------------------------

function Segmented({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="flex h-7 rounded-[4px] border border-line p-0.5 text-[12.5px]">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`rounded-[3px] px-2.5 ${value === v ? 'bg-active font-medium text-fg' : 'text-muted tap'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function ToolButton({ onClick, children, label }: { onClick: () => void; children: ReactNode; label: string }) {
  return (
    <button aria-label={label} onClick={onClick} className="flex h-7 w-8 items-center justify-center rounded-[4px] text-muted tap">
      {children}
    </button>
  )
}

function CopyAll({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <ToolButton
      label="复制全部"
      onClick={() => {
        copyText(text, '已复制全文')
        setDone(true)
        setTimeout(() => setDone(false), 1200)
      }}
    >
      {done ? <Check size={15} strokeWidth={1.7} /> : <Copy size={15} strokeWidth={1.7} />}
    </ToolButton>
  )
}

/** Thin toolbar under the variant's own header. */
export function FileView({ entry }: { entry: Entry }) {
  const nav = useNav()
  const { kind, lang } = kindOf(entry)
  const lines = entry.content ? entry.content.replace(/\n$/, '').split('\n').length : 0
  const meta = (
    <span className="truncate text-[11.5px] text-muted tabular-nums">
      {kind === 'code' || kind === 'text' || kind === 'markdown' ? `${lang} · ${lines} 行 · ` : ''}
      {formatSize(entry.size)} · {formatTime(entry.mtime)}
    </span>
  )

  const bar = (left: ReactNode, right?: ReactNode) => (
    <div className="flex h-10 items-center gap-2 border-b border-line px-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">{left}</div>
      <div className="flex shrink-0 items-center">
        {right}
        <ToolButton label="下载" onClick={() => toast('原型：下载 ' + entry.name)}>
          <Download size={15} strokeWidth={1.7} />
        </ToolButton>
      </div>
    </div>
  )

  if (kind === 'markdown')
    return (
      <>
        {bar(
          <>
            <Segmented
              value={nav.mode}
              options={[
                ['render', '渲染'],
                ['source', '源码'],
              ]}
              onChange={(v) => setNav({ mode: v as 'render' | 'source' })}
            />
            {meta}
          </>,
          <CopyAll text={entry.content ?? ''} />,
        )}
        {nav.mode === 'render' ? <MarkdownView entry={entry} /> : <CodeView code={entry.content ?? ''} lang="markdown" />}
      </>
    )

  if (kind === 'code' || kind === 'text')
    return (
      <>
        {bar(meta, <CopyAll text={entry.content ?? ''} />)}
        <CodeView code={entry.content ?? ''} lang={lang} />
      </>
    )

  if (kind === 'image')
    return (
      <>
        {bar(meta)}
        <div className="flex justify-center p-3" style={{ touchAction: 'pinch-zoom' }}>
          <img src={assetUrl(entry)} alt={entry.name} className="max-w-full rounded-[3px]" />
        </div>
      </>
    )

  if (kind === 'video' || kind === 'audio')
    return (
      <>
        {bar(meta)}
        <div className="p-3">
          {kind === 'video' ? <video controls className="aspect-video w-full rounded-[3px] bg-black" /> : <audio controls className="w-full" />}
          <p className="mt-2 text-[12px] text-faint">原型：无真实媒体源，实现时直接用原生播放器流式读取。</p>
        </div>
      </>
    )

  return (
    <>
      {bar(meta)}
      <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
        <EntryIcon e={entry} size={36} />
        <div className="max-w-full text-[14px] break-all">{entry.name}</div>
        <div className="font-mono text-[12px] text-muted">{formatSize(entry.size)}</div>
        {kind === 'pdf' ? (
          <button className="flex h-8 items-center gap-1.5 rounded-[4px] border border-line px-3 text-[13px] tap" onClick={() => toast('原型：用浏览器内置查看器打开')}>
            <ExternalLink size={14} strokeWidth={1.7} /> 打开 PDF
          </button>
        ) : (
          <button className="flex h-8 items-center gap-1.5 rounded-[4px] border border-line px-3 text-[13px] tap" onClick={() => toast('原型：下载 ' + entry.name)}>
            <Download size={14} strokeWidth={1.7} /> 下载
          </button>
        )}
      </div>
    </>
  )
}
