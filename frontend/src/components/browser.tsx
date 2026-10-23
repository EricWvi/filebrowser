import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, ChevronLeft, Eye, EyeOff, House } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "wouter/use-browser-location";
import { seedDirs, useFavorites, useInfo, useList, useStat } from "@/hooks/queries";
import { ApiError, type Entry, type Favorite } from "@/lib/api";
import { formatSize, formatTime } from "@/lib/format";
import { back, canGoBack, go, useScrollRestore } from "@/lib/nav";
import { fromUrl, parentOf } from "@/lib/paths";
import { setShowHidden, useShowHidden } from "@/lib/prefs";
import { afterTap } from "@/lib/press";
import { toast } from "@/lib/toast";
import { EntryIcon } from "./entry-icon";
import { EntryMenu } from "./entry-menu";
import { FileView } from "./file-view";

function Header({ path, rootName }: { path: string; rootName: string }) {
  const title = path === "/" ? rootName : path.slice(path.lastIndexOf("/") + 1);
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-bg/90 px-3.5 pt-2 pb-1.5 backdrop-blur">
      <div className="truncate text-[16px] leading-6 font-semibold">{title}</div>
      {/* rtl keeps the tail of a long path visible; bdi keeps the text itself in order */}
      <div className="truncate text-left font-mono text-[11px] leading-4 text-muted" dir="rtl">
        <bdi>{rootName + (path === "/" ? "/" : path)}</bdi>
      </div>
    </header>
  );
}

function Row({ e }: { e: Entry }) {
  return (
    <EntryMenu entry={e}>
      <button
        onClick={() => afterTap(() => go(e.path))}
        className="touch-row tap flex h-12 w-full items-center gap-3 border-b border-line/70 px-3.5 text-left data-[state=open]:bg-active"
      >
        <EntryIcon name={e.name} dir={e.dir} size={20} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[14px] leading-5">{e.name}</span>
          <span className="truncate text-[11.5px] leading-4 text-muted tabular-nums">
            {formatTime(e.mtime)} · {e.dir ? `${e.count ?? 0} 项` : formatSize(e.size)}
          </span>
        </span>
      </button>
    </EntryMenu>
  );
}

function FavoriteTile({ f }: { f: Favorite }) {
  return (
    <EntryMenu entry={f}>
      <button
        onClick={() => (f.missing ? toast("已不存在，长按可取消收藏") : afterTap(() => go(f.path)))}
        className={`touch-row tap flex h-11 min-w-0 items-center gap-2 rounded-[4px] border border-line bg-raised px-2.5 text-left data-[state=open]:bg-active ${f.missing ? "opacity-45" : ""}`}
      >
        <EntryIcon name={f.name} dir={f.dir} size={16} />
        <span className="flex min-w-0 flex-col">
          <span className={`truncate text-[13px] leading-4 ${f.missing ? "line-through" : ""}`}>{f.name}</span>
          <span className="truncate font-mono text-[10.5px] leading-4 text-faint">{parentOf(f.path)}</span>
        </span>
      </button>
    </EntryMenu>
  );
}

function Favorites() {
  const favs = useFavorites();
  if (!favs.data?.length) return null;
  return (
    <section className="border-b border-line px-3 pt-2.5 pb-3">
      <div className="px-0.5 pb-1.5 text-[11.5px] font-medium tracking-wide text-muted">收藏</div>
      <div className="grid grid-cols-2 gap-1.5">
        {favs.data.map((f) => (
          <FavoriteTile key={f.path} f={f} />
        ))}
      </div>
    </section>
  );
}

function Tool({ onClick, children, label, disabled }: { onClick: () => void; children: ReactNode; label: string; disabled?: boolean }) {
  return (
    <button
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="tap flex h-10 flex-1 flex-col items-center justify-center gap-0.5 rounded-[4px] text-[10px] text-muted disabled:opacity-35"
    >
      {children}
      {label}
    </button>
  );
}

function Toolbar({ path }: { path: string }) {
  const hidden = useShowHidden();
  const atRoot = path === "/";
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-bg/95 px-2 pt-1 pb-[max(4px,env(safe-area-inset-bottom))] backdrop-blur">
      <Tool label="返回" onClick={() => afterTap(() => (canGoBack() ? back() : go(parentOf(path))))} disabled={atRoot && !canGoBack()}>
        <ChevronLeft size={18} strokeWidth={1.7} />
      </Tool>
      <Tool label="上级" onClick={() => afterTap(() => go(parentOf(path)))} disabled={atRoot}>
        <ArrowUp size={18} strokeWidth={1.7} />
      </Tool>
      <Tool label="首页" onClick={() => afterTap(() => go("/"))} disabled={atRoot}>
        <House size={18} strokeWidth={1.7} />
      </Tool>
      <Tool label={hidden ? "隐藏" : "显示隐藏"} onClick={() => setShowHidden(!hidden)}>
        {hidden ? <EyeOff size={18} strokeWidth={1.7} /> : <Eye size={18} strokeWidth={1.7} />}
      </Tool>
    </nav>
  );
}

const Note = ({ children }: { children: ReactNode }) => <div className="px-4 py-10 text-center text-[13px] text-muted">{children}</div>;

/** Shows "加载中" only when loading takes long enough to notice. */
function Loading() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 300);
    return () => clearTimeout(t);
  }, []);
  return show ? <Note>加载中…</Note> : null;
}

function errorText(err: unknown) {
  if (err instanceof ApiError) {
    if (err.status === 404) return "不存在";
    if (err.status === 403) return "没有权限读取";
    if (err.status === 400) return "路径无效";
  }
  return "加载失败";
}

function DirView({ path }: { path: string }) {
  const hidden = useShowHidden();
  const qc = useQueryClient();
  const list = useList(path, hidden, true);
  useEffect(() => {
    if (list.data) seedDirs(qc, list.data);
  }, [list.data, qc]);
  useScrollRestore(!!list.data, path);

  return (
    <>
      {path === "/" && <Favorites />}
      {list.data ? (
        list.data.length ? (
          list.data.map((e) => <Row key={e.path} e={e} />)
        ) : (
          <Note>空文件夹</Note>
        )
      ) : list.isError ? (
        <Note>{errorText(list.error)}</Note>
      ) : (
        <Loading />
      )}
    </>
  );
}

export function Browser() {
  const path = fromUrl(usePathname());
  const info = useInfo();
  const stat = useStat(path);
  const rootName = info.data?.name ?? "";

  useEffect(() => {
    const name = path === "/" ? rootName : path.slice(path.lastIndexOf("/") + 1);
    document.title = name || "Files";
  }, [path, rootName]);

  return (
    <div className="min-h-dvh pb-24">
      <Header path={path} rootName={rootName} />
      {path === "/" || stat.data?.dir ? (
        <DirView key={path} path={path} />
      ) : stat.data ? (
        <FileView key={path} entry={stat.data} />
      ) : stat.isError ? (
        <Note>{errorText(stat.error)}</Note>
      ) : (
        <Loading />
      )}
      <Toolbar path={path} />
    </div>
  );
}
