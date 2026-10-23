import { Check, Copy, Download, ExternalLink } from "lucide-react";
import { lazy, Suspense, useState, type ReactNode } from "react";
import { useSearch } from "wouter/use-browser-location";
import { useText } from "@/hooks/queries";
import { rawUrl, type Entry } from "@/lib/api";
import { formatSize, formatTime } from "@/lib/format";
import { replaceSearch } from "@/lib/nav";
import { isTextKind, kindOf } from "@/lib/paths";
import { copyText, download } from "@/lib/toast";
import { CodeView } from "./code-view";
import { EntryIcon } from "./entry-icon";

// KaTeX, remark and friends only load once a Markdown file is opened.
const MarkdownView = lazy(() => import("./markdown-view"));

/** Text files above this size are offered as a download instead. */
const TEXT_LIMIT = 5 << 20;

function ToolButton({ onClick, children, label }: { onClick: () => void; children: ReactNode; label: string }) {
  return (
    <button aria-label={label} onClick={onClick} className="tap flex h-7 w-8 items-center justify-center rounded-[4px] text-muted">
      {children}
    </button>
  );
}

function CopyAll({ text }: { text: string | undefined }) {
  const [done, setDone] = useState(false);
  return (
    <ToolButton
      label="复制全文"
      onClick={() => {
        if (text === undefined) return;
        copyText(text, "已复制全文");
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
    >
      {done ? <Check size={15} strokeWidth={1.7} /> : <Copy size={15} strokeWidth={1.7} />}
    </ToolButton>
  );
}

function Segmented({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="flex h-7 shrink-0 rounded-[4px] border border-line p-0.5 text-[12.5px]">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`tap rounded-[3px] px-2.5 ${value === v ? "bg-active font-medium text-fg" : "text-muted"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const Note = ({ children }: { children: ReactNode }) => <div className="px-4 py-10 text-center text-[13px] text-muted">{children}</div>;

export function FileView({ entry }: { entry: Entry }) {
  const search = useSearch();
  const source = new URLSearchParams(search).get("view") === "source";
  const { kind, lang } = kindOf(entry.name, entry.text);
  const tooBig = isTextKind(kind) && entry.size > TEXT_LIMIT;
  const text = useText(entry, isTextKind(kind) && !tooBig);
  const lines = text.data === undefined ? null : text.data.replace(/\n$/, "").split("\n").length;

  const meta = (
    <span className="truncate text-[11.5px] text-muted tabular-nums">
      {isTextKind(kind) && !tooBig ? `${lang}${lines === null ? "" : ` · ${lines} 行`} · ` : ""}
      {formatSize(entry.size)} · {formatTime(entry.mtime)}
    </span>
  );
  const bar = (left: ReactNode, right?: ReactNode) => (
    <div className="flex h-10 items-center gap-2 border-b border-line px-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">{left}</div>
      <div className="flex shrink-0 items-center">
        {right}
        <ToolButton label="下载" onClick={() => download(rawUrl(entry.path, true))}>
          <Download size={15} strokeWidth={1.7} />
        </ToolButton>
      </div>
    </div>
  );

  if (isTextKind(kind) && !tooBig) {
    const body =
      text.data === undefined ? (
        text.isError ? <Note>读取失败</Note> : null
      ) : kind === "markdown" && !source ? (
        <Suspense fallback={null}>
          <MarkdownView path={entry.path} source={text.data} />
        </Suspense>
      ) : (
        <CodeView code={text.data} lang={lang} />
      );
    return (
      <>
        {bar(
          <>
            {kind === "markdown" && (
              <Segmented
                value={source ? "source" : "render"}
                options={[
                  ["render", "渲染"],
                  ["source", "源码"],
                ]}
                onChange={(v) => replaceSearch(v === "source" ? "?view=source" : "")}
              />
            )}
            {meta}
          </>,
          <CopyAll text={text.data} />,
        )}
        {body}
      </>
    );
  }

  if (kind === "image") {
    return (
      <>
        {bar(meta)}
        <div className="flex justify-center p-3">
          <img src={rawUrl(entry.path)} alt={entry.name} className="max-w-full rounded-[3px]" />
        </div>
      </>
    );
  }

  if (kind === "video" || kind === "audio") {
    return (
      <>
        {bar(meta)}
        <div className="p-3">
          {kind === "video" ? (
            <video src={rawUrl(entry.path)} controls playsInline preload="metadata" className="w-full rounded-[3px] bg-black" />
          ) : (
            <audio src={rawUrl(entry.path)} controls preload="metadata" className="w-full" />
          )}
        </div>
      </>
    );
  }

  // PDF (opened in the browser's own viewer), oversized text and binaries.
  const btn = "tap flex h-8 items-center gap-1.5 rounded-[4px] border border-line px-3 text-[13px]";
  return (
    <>
      {bar(meta)}
      <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
        <EntryIcon name={entry.name} dir={false} size={36} />
        <div className="max-w-full text-[14px] break-all">{entry.name}</div>
        <div className="text-[12px] text-muted tabular-nums">
          {formatSize(entry.size)}
          {tooBig && " · 文件过大，不在页面中显示"}
        </div>
        {kind === "pdf" ? (
          <a className={btn} href={rawUrl(entry.path)} target="_blank" rel="noreferrer">
            <ExternalLink size={14} strokeWidth={1.7} /> 打开 PDF
          </a>
        ) : (
          <button className={btn} onClick={() => download(rawUrl(entry.path, true))}>
            <Download size={14} strokeWidth={1.7} /> 下载
          </button>
        )}
      </div>
    </>
  );
}
