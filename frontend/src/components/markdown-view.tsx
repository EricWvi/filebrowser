import "katex/dist/katex.min.css";
import type { Element, ElementContent } from "hast";
import Markdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { rawUrl } from "@/lib/api";
import { go } from "@/lib/nav";
import { resolveRelative, toUrl } from "@/lib/paths";
import { afterTap } from "@/lib/press";
import { CodeBlock } from "./code-view";
import { Mermaid } from "./mermaid";

const external = (href: string) => /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//");

const decode = (s: string) => {
  try {
    return decodeURI(s);
  } catch {
    return s;
  }
};

const textOf = (n: ElementContent): string =>
  n.type === "text" ? n.value : "children" in n ? n.children.map(textOf).join("") : "";

/** Splits a leading YAML frontmatter block off the document. */
function splitFrontmatter(source: string): [string | null, string] {
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(source);
  return m ? [m[1] ?? "", source.slice(m[0].length)] : [null, source];
}

/** Renders Markdown; relative links and images resolve against the file at `path`. */
export default function MarkdownView({ path, source }: { path: string; source: string }) {
  const [frontmatter, body] = splitFrontmatter(source);
  return (
    <article className="md mx-auto max-w-[760px] px-4 pt-3 pb-16">
      {frontmatter !== null && <CodeBlock code={frontmatter} lang="yaml" />}
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          pre: ({ node }) => {
            const code = (node as Element | undefined)?.children.find(
              (c): c is Element => c.type === "element" && c.tagName === "code",
            );
            const cls = (code?.properties.className as string[] | undefined) ?? [];
            const lang = cls.find((c) => c.startsWith("language-"))?.slice(9) ?? "";
            const text = code ? code.children.map(textOf).join("") : "";
            return lang === "mermaid" ? <Mermaid code={text} /> : <CodeBlock code={text} lang={lang} />;
          },
          table: ({ children }) => (
            <div className="table-wrap">
              <table>{children}</table>
            </div>
          ),
          img: ({ src, alt, title }) => {
            const s = typeof src === "string" ? src : "";
            const url = !s || external(s) || s.startsWith("data:") ? s : rawUrl(resolveRelative(path, decode(s.split(/[?#]/)[0] ?? "")));
            return <img src={url} alt={alt} title={title} loading="lazy" />;
          },
          a: ({ href = "", children }) => {
            if (external(href)) {
              return (
                <a href={href} target="_blank" rel="noreferrer">
                  {children}
                </a>
              );
            }
            if (href.startsWith("#")) return <a href={href}>{children}</a>;
            const target = resolveRelative(path, decode(href.split(/[?#]/)[0] ?? ""));
            return (
              <a
                href={toUrl(target)}
                onClick={(ev) => {
                  if (ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
                  ev.preventDefault();
                  afterTap(() => go(target));
                }}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {body}
      </Markdown>
    </article>
  );
}
