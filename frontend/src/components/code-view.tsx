import { Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { copyText } from "@/lib/toast";

/** Larger files are shown as plain text; highlighting them would stall the phone. */
const HIGHLIGHT_LIMIT = 512 << 10;

const cache = new Map<string, string>();

function useHighlight(code: string, lang: string) {
  const key = lang + "\0" + code;
  const skip = code.length > HIGHLIGHT_LIMIT || lang === "text";
  const [html, setHtml] = useState<string | null>(() => cache.get(key) ?? null);
  useEffect(() => {
    if (skip) return setHtml(null);
    const hit = cache.get(key);
    if (hit) return setHtml(hit);
    setHtml(null);
    let live = true;
    import("shiki").then(async ({ codeToHtml, bundledLanguages }) => {
      const out = await codeToHtml(code, {
        lang: lang in bundledLanguages ? lang : "text",
        themes: { light: "github-light", dark: "github-dark" },
        defaultColor: false,
      });
      cache.set(key, out);
      if (live) setHtml(out);
    });
    return () => {
      live = false;
    };
  }, [key, skip]);
  return html;
}

const preCls = "[&_pre]:m-0 [&_pre]:w-max [&_pre]:min-w-full [&_pre]:py-2 [&_pre]:pr-4 [&_pre]:pl-3 [&_pre]:[tab-size:4]";

/**
 * Line numbers live in a separate column that neither scrolls nor takes part
 * in selection, so copied code never contains them and they stay in place
 * while the code is dragged sideways.
 */
export function CodeView({ code, lang }: { code: string; lang: string }) {
  const text = code.endsWith("\n") ? code.slice(0, -1) : code;
  const html = useHighlight(text, lang);
  const lines = text.split("\n").length;
  return (
    <div className="flex font-mono text-[12.5px] leading-[1.6]">
      <pre
        aria-hidden
        className="m-0 shrink-0 border-r border-line py-2 pr-2.5 pl-3 text-right text-faint select-none"
        style={{ minWidth: `calc(${String(lines).length}ch + 1.4rem)` }}
      >
        {Array.from({ length: lines }, (_, i) => i + 1).join("\n")}
      </pre>
      <div className={`min-w-0 flex-1 overflow-x-auto overscroll-x-contain ${preCls}`}>
        {html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <pre>{text}</pre>}
      </div>
    </div>
  );
}

/** Fenced code inside Markdown: no line numbers, own horizontal scroll. */
export function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const text = code.replace(/\n$/, "");
  const html = useHighlight(text, lang || "text");
  return (
    <div className="rounded-[3px] border border-line bg-code">
      <div className="flex h-7 items-center justify-between border-b border-line pr-1 pl-3 font-mono text-[11px] text-muted">
        <span>{lang || "text"}</span>
        <button aria-label="复制" className="tap flex h-6 w-7 items-center justify-center rounded-[3px]" onClick={() => copyText(text)}>
          <Copy size={13} strokeWidth={1.7} />
        </button>
      </div>
      <div className={`overflow-x-auto font-mono text-[12.5px] leading-[1.6] ${preCls}`}>
        {html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <pre>{text}</pre>}
      </div>
    </div>
  );
}
