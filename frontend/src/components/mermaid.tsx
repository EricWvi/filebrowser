import { Maximize2, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useDark } from "@/hooks/use-dark";
import { CodeBlock } from "./code-view";

/**
 * Inline the chart is fitted to the column width as an overview; a tap
 * opens it fullscreen at natural size to pan around.
 */
export function Mermaid({ code }: { code: string }) {
  const dark = useDark();
  const id = "m" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const [svg, setSvg] = useState<{ inline: string; full: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let live = true;
    import("mermaid").then(async ({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        theme: dark ? "dark" : "neutral",
        fontFamily: "inherit",
        securityLevel: "strict",
      });
      try {
        const rid = `${id}${dark ? "d" : "l"}`;
        const { svg } = await mermaid.render(rid, code);
        // The fullscreen copy needs its own id (mermaid scopes styles by #id)
        // and an explicit natural size instead of width="100%".
        const [, , w, h] = /viewBox="([^"]+)"/.exec(svg)?.[1]?.split(/\s+/).map(Number) ?? [];
        const full = svg
          .replaceAll(rid, rid + "f")
          .replace('width="100%"', `width="${w}" height="${h}"`)
          .replace(/max-width:\s*[\d.]+px;?/, "");
        if (live) setSvg({ inline: svg, full });
      } catch {
        if (live) setFailed(true);
      }
    });
    return () => {
      live = false;
    };
  }, [code, dark, id]);

  if (failed) return <CodeBlock code={code} lang="mermaid" />;
  return (
    <>
      <button
        onClick={() => svg && setOpen(true)}
        className="tap relative block w-full rounded-[3px] border border-line px-2 py-3 [&_svg]:mx-auto [&_svg]:h-auto"
      >
        {svg ? <div dangerouslySetInnerHTML={{ __html: svg.inline }} /> : <div className="h-24" />}
        {svg && <Maximize2 size={13} strokeWidth={1.7} className="absolute top-1.5 right-1.5 text-faint" />}
      </button>
      {open && svg && (
        <div className="fixed inset-0 z-50 flex flex-col bg-bg">
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-line pr-1 pl-3 text-[12.5px] text-muted">
            <span>mermaid</span>
            <button aria-label="关闭" onClick={() => setOpen(false)} className="tap flex h-8 w-8 items-center justify-center rounded-[4px]">
              <X size={18} strokeWidth={1.7} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4 [&_svg]:!max-w-none">
            <div className="w-max" dangerouslySetInnerHTML={{ __html: svg.full }} />
          </div>
        </div>
      )}
    </>
  );
}
