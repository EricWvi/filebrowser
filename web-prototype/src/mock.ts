// PROTOTYPE: fake read-only tree standing in for the mounted directory.

export type Entry = {
  name: string
  path: string
  dir: boolean
  size: number
  mtime: number
  children?: Entry[]
  content?: string
}

const now = Date.now()
const min = 60_000
const hour = 60 * min
const day = 24 * hour

const archSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="220" viewBox="0 0 640 220"><rect width="640" height="220" fill="#eef1f6"/><g font-family="sans-serif" font-size="15" fill="#334"><rect x="30" y="80" width="140" height="56" rx="4" fill="#fff" stroke="#8aa"/><text x="70" y="113">Browser</text><rect x="250" y="80" width="140" height="56" rx="4" fill="#fff" stroke="#8aa"/><text x="292" y="113">Caddy</text><rect x="470" y="80" width="140" height="56" rx="4" fill="#fff" stroke="#8aa"/><text x="500" y="113">filebrowser</text><path d="M170 108h80M390 108h80" stroke="#557" stroke-width="2"/></g></svg>`
export const svgDataUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
const photoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ec3e6"/><stop offset="1" stop-color="#f3d9b1"/></linearGradient></defs><rect width="1200" height="800" fill="url(#g)"/><path d="M0 620 L260 380 L460 560 L700 300 L1200 640 L1200 800 L0 800Z" fill="#5d6f7e"/><circle cx="930" cy="190" r="70" fill="#fff6e0"/></svg>`

const README = `# Palace

个人知识与日常记录的 Web 应用。本文档用于验证 **Markdown 渲染**：标题、列表、表格、代码、公式、Mermaid 和相对路径图片。

> 只读挂载：服务端从不写入 \`/data\`，收藏存放在单独的配置卷。

## 架构

![架构](./docs/arch.svg)

\`\`\`mermaid
flowchart LR
  A[手机浏览器] -->|HTTPS| B(Caddy)
  B -->|forward_auth| C{Authelia}
  C -->|通过| D[filebrowser]
  D --> E[(只读 /data)]
  D --> F[(配置卷 SQLite)]
\`\`\`

## 同步时序

\`\`\`mermaid
sequenceDiagram
  participant W as Web
  participant S as Server
  W->>S: GET /api/list?path=/palace
  S-->>W: entries[]
  W->>S: PUT /api/favorites
  S-->>W: 204
\`\`\`

## 公式

行内公式 $e^{i\\pi} + 1 = 0$，以及块级公式：

$$
\\operatorname{softmax}(x)_i = \\frac{e^{x_i}}{\\sum_{j=1}^{n} e^{x_j}}, \\qquad
\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}
$$

## 表格

| 服务 | 端口 | 认证 | 说明 |
|---|---:|---|---|
| palace | 8080 | OIDC | 主应用，Postgres + MinIO |
| posts | 36751 | OIDC | SingleFile 转 Markdown |
| filebrowser | 8090 | forward_auth | 只读浏览，收藏存配置卷 |

## 代码

\`\`\`go
func (s *Server) handleList(w http.ResponseWriter, r *http.Request) {
	rel := path.Clean("/" + r.URL.Query().Get("path"))
	entries, err := os.ReadDir(filepath.Join(s.root, filepath.FromSlash(rel)))
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	writeJSON(w, toEntries(entries, s.showHidden(r)))
}
\`\`\`

## 待办

- [x] 目录浏览
- [x] 代码高亮
- [ ] 收藏排序
- 普通列表项，包含 [相对链接](./docs/sync.md) 和外部链接 [Mermaid](https://mermaid.js.org)

---

1. 第一步
2. 第二步
   - 嵌套项
`

const SYNC_MD = `# 同步协议

返回 [README](../README.md)。

\`\`\`mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Pulling: 打开应用
  Pulling --> Idle: 完成
  Pulling --> Conflict: 版本冲突
  Conflict --> Idle: 人工合并
\`\`\`

冲突概率的粗略估计：$p \\approx 1 - e^{-\\lambda t}$。
`

const MAIN_GO = `package main

import (
	"embed"
	"encoding/json"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
)

//go:embed dist
var dist embed.FS

type Entry struct {
	Name    string \`json:"name"\`
	Dir     bool   \`json:"dir"\`
	Size    int64  \`json:"size"\`
	ModTime int64  \`json:"mtime"\`
}

var hiddenDirs = map[string]bool{"node_modules": true, ".git": true, ".tmp": true, "target": true, "dist": true}

func isHidden(name string) bool { return strings.HasPrefix(name, ".") || hiddenDirs[name] }

func main() {
	root := envOr("FILEBROWSER_ROOT", "/data")
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/list", func(w http.ResponseWriter, r *http.Request) {
		rel := path.Clean("/" + r.URL.Query().Get("path"))
		items, err := os.ReadDir(filepath.Join(root, filepath.FromSlash(rel)))
		if err != nil {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		out := make([]Entry, 0, len(items))
		for _, it := range items {
			info, err := it.Info()
			if err != nil {
				continue
			}
			out = append(out, Entry{Name: it.Name(), Dir: it.IsDir(), Size: info.Size(), ModTime: info.ModTime().UnixMilli()})
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(out) // a deliberately long trailing comment so the line overflows horizontally on a phone screen and has to be dragged
	})
	static, _ := fs.Sub(dist, "dist")
	mux.Handle("/", http.FileServerFS(static))
	slog.Info("listening", "addr", ":8090", "root", root)
	if err := http.ListenAndServe(":8090", mux); err != nil {
		slog.Error("server stopped", "err", err)
		os.Exit(1)
	}
}

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
`

const APP_TSX = `import { useEffect, useState } from 'react'

type Entry = { name: string; dir: boolean; size: number; mtime: number }

export function DirectoryList({ path, onOpen }: { path: string; onOpen: (e: Entry) => void }) {
  const [entries, setEntries] = useState<Entry[] | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(\`/api/list?path=\${encodeURIComponent(path)}\`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then(setEntries)
      .catch(() => {})
    return () => ctrl.abort()
  }, [path])

  if (!entries) return null
  return (
    <ul>
      {entries.map((e) => (
        <li key={e.name} onClick={() => onOpen(e)} className="flex h-9 items-center gap-2 border-b border-line px-3 active:bg-hover">
          {e.name}
        </li>
      ))}
    </ul>
  )
}
`

const PY = `#!/usr/bin/env python3
"""Rotate restic snapshots and report a summary line per repository."""

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Repo:
    name: str
    path: Path
    keep_daily: int = 7
    keep_weekly: int = 4


def prune(repo: Repo) -> dict:
    cmd = ["restic", "-r", str(repo.path), "forget", "--prune", f"--keep-daily={repo.keep_daily}", f"--keep-weekly={repo.keep_weekly}", "--json"]
    out = subprocess.run(cmd, check=True, capture_output=True, text=True).stdout
    return json.loads(out)


if __name__ == "__main__":
    for repo in [Repo("photos", Path("/backup/photos")), Repo("ali", Path("/backup/ali"))]:
        result = prune(repo)
        print(f"{repo.name:>8}: kept {len(result[0]['keep'])} snapshots, removed {len(result[0].get('remove') or [])}")
`

const COMPOSE = `services:
  filebrowser:
    image: ghcr.io/ericwvi/filebrowser:0.1.0
    container_name: filebrowser
    restart: unless-stopped
    user: "1000:1000"
    volumes:
      - /home/eric/projects:/data:ro
      - /root/only/selfhost/filebrowser:/config
    environment:
      FILEBROWSER_ROOT: /data
      FILEBROWSER_CONFIG: /config
    networks:
      - my-network

networks:
  my-network:
    external: true
    name: only_my-network
`

const CADDY = `files.onlyquant.top {
	forward_auth authelia:9091 {
		uri /api/authz/forward-auth
		copy_headers Remote-User Remote-Groups Remote-Email Remote-Name
	}
	reverse_proxy filebrowser:8090 {
		header_up X-Real-IP {remote_host}
	}
}
`

const SQL = `-- favorites live in the config volume, never in the read-only mount
CREATE TABLE IF NOT EXISTS favorites (
  path       TEXT PRIMARY KEY,
  is_dir     INTEGER NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

SELECT path, is_dir FROM favorites ORDER BY position, created_at;
`

const LICENSE = `MIT License

Copyright (c) 2026 Eric

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software.
`

type Node = [name: string, ageMs: number, sizeOrChildren: number | string | Node[]]

const tree: Node[] = [
  ['.tmp', 3 * day, [['scratch.txt', 3 * day, 'tmp']]],
  ['.gitignore', 20 * day, 'node_modules/\ndist/\n'],
  ['dotfiles', 2 * hour, [
    ['.git', 2 * hour, [['HEAD', 2 * hour, 'ref: refs/heads/master\n']]],
    ['selfhost', 2 * hour, [
      ['Caddyfile', 2 * hour, CADDY],
      ['compose.yml', 5 * hour, COMPOSE],
      ['restic_prune.py', 9 * day, PY],
      ['cron.txt', 30 * day, '0 4 * * * /root/dotfiles/selfhost/ali_bak.sh\n0 5 * * * /root/dotfiles/selfhost/photo_bak.sh\n0 3 * * 0 /root/dotfiles/selfhost/restic_prune.sh\n'],
    ]],
    ['README.md', 12 * day, '# dotfiles\n\n个人配置与 homelab compose。\n'],
  ]],
  ['filebrowser', 15 * min, [
    ['node_modules', 15 * min, [['react', 15 * min, [['index.js', 15 * min, 'module.exports = {}\n']]]]],
    ['web', 15 * min, [['App.tsx', 15 * min, APP_TSX]]],
    ['main.go', 40 * min, MAIN_GO],
    ['schema.sql', 40 * min, SQL],
    ['AGENTS.md', 1 * day, '- 工作过程中临时文件放在各级工作目录的 .tmp 下。\n'],
  ]],
  ['palace', 6 * hour, [
    ['docs', 2 * day, [
      ['arch.svg', 2 * day, archSvg],
      ['sync.md', 2 * day, SYNC_MD],
    ]],
    ['src', 6 * hour, [['App.tsx', 6 * hour, APP_TSX], ['server.go', 8 * hour, MAIN_GO]]],
    ['README.md', 6 * hour, README],
    ['package.json', 4 * day, '{\n  "name": "palace",\n  "private": true,\n  "scripts": { "dev": "vite" }\n}\n'],
  ]],
  ['media', 40 * day, [
    ['mountain.svg', 40 * day, photoSvg],
    ['talk-2026.pdf', 50 * day, 2_480_000],
    ['demo.mp4', 60 * day, 48_200_000],
    ['ambient.mp3', 61 * day, 6_100_000],
    ['backup.tar.gz', 90 * day, 812_000_000],
  ]],
  ['reading-list', 1 * day, [
    ['2026-10-20-一篇很长很长的文章标题用来测试移动端文件名的截断效果.md', 3 * day, '# 长标题文章\n\n正文。\n'],
    ['2026-10-22-mermaid-in-practice.md', 1 * day, SYNC_MD],
  ]],
  ['LICENSE', 300 * day, LICENSE],
  ['README.md', 8 * day, README],
]

function build(nodes: Node[], parent: string): Entry[] {
  return nodes.map(([name, age, v]) => {
    const p = `${parent === '/' ? '' : parent}/${name}`
    if (Array.isArray(v)) {
      const children = build(v, p)
      return { name, path: p, dir: true, size: children.length, mtime: now - age, children }
    }
    if (typeof v === 'number') return { name, path: p, dir: false, size: v, mtime: now - age }
    return { name, path: p, dir: false, size: new Blob([v]).size, mtime: now - age, content: v }
  })
}

export const root: Entry = { name: 'projects', path: '/', dir: true, size: tree.length, mtime: now, children: build(tree, '/') }

export function lookup(p: string): Entry | undefined {
  if (p === '/' || p === '') return root
  let cur: Entry | undefined = root
  for (const seg of p.split('/').filter(Boolean)) {
    cur = cur?.children?.find((c) => c.name === seg)
    if (!cur) return undefined
  }
  return cur
}

const HIDDEN_DIRS = new Set(['node_modules', '.git', '.tmp', 'target', 'dist'])
export const isHidden = (name: string) => name.startsWith('.') || HIDDEN_DIRS.has(name)

export function listing(e: Entry, showHidden: boolean): Entry[] {
  const kids = (e.children ?? []).filter((c) => showHidden || !isHidden(c.name))
  return [...kids].sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1))
}

export function parentOf(p: string) {
  const i = p.lastIndexOf('/')
  return i <= 0 ? '/' : p.slice(0, i)
}

export function resolveRelative(base: string, href: string) {
  const stack = parentOf(base).split('/').filter(Boolean)
  for (const seg of href.split('/')) {
    if (seg === '..') stack.pop()
    else if (seg && seg !== '.') stack.push(seg)
  }
  return '/' + stack.join('/')
}

export function formatSize(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(1)} GB`
}

export function formatTime(t: number) {
  const d = now - t
  if (d < hour) return `${Math.max(1, Math.round(d / min))} 分钟前`
  if (d < day) return `${Math.round(d / hour)} 小时前`
  if (d < 7 * day) return `${Math.round(d / day)} 天前`
  const dt = new Date(t)
  const sameYear = dt.getFullYear() === new Date(now).getFullYear()
  const md = `${dt.getMonth() + 1}-${String(dt.getDate()).padStart(2, '0')}`
  return sameYear ? md : `${dt.getFullYear()}-${md}`
}

export type Kind = 'markdown' | 'code' | 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'binary'

const CODE_EXT: Record<string, string> = {
  go: 'go', ts: 'ts', tsx: 'tsx', js: 'js', jsx: 'jsx', py: 'python', rs: 'rust', sh: 'bash', yml: 'yaml', yaml: 'yaml',
  json: 'json', toml: 'toml', sql: 'sql', css: 'css', html: 'html', java: 'java', c: 'c', h: 'c', cpp: 'cpp', lua: 'lua',
}
const NAME_LANG: Record<string, string> = { Caddyfile: 'nginx', Dockerfile: 'dockerfile', Makefile: 'make' }

export function kindOf(e: Entry): { kind: Kind; lang: string } {
  const ext = e.name.includes('.') ? e.name.split('.').pop()!.toLowerCase() : ''
  if (ext === 'md' || ext === 'markdown') return { kind: 'markdown', lang: 'markdown' }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'].includes(ext)) return { kind: 'image', lang: '' }
  if (ext === 'pdf') return { kind: 'pdf', lang: '' }
  if (['mp4', 'webm', 'mov'].includes(ext)) return { kind: 'video', lang: '' }
  if (['mp3', 'flac', 'ogg', 'm4a', 'wav'].includes(ext)) return { kind: 'audio', lang: '' }
  if (CODE_EXT[ext]) return { kind: 'code', lang: CODE_EXT[ext] }
  if (NAME_LANG[e.name]) return { kind: 'code', lang: NAME_LANG[e.name] }
  if (e.content !== undefined) return { kind: 'text', lang: 'text' }
  return { kind: 'binary', lang: '' }
}
