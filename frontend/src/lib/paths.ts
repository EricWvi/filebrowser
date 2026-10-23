/** Mount paths are absolute and slash-separated: "/" is the mount root. */

export function parentOf(p: string) {
  const i = p.lastIndexOf("/");
  return i <= 0 ? "/" : p.slice(0, i);
}

export function baseName(p: string) {
  return p.slice(p.lastIndexOf("/") + 1);
}

/** Resolves an href found in the file at base, e.g. "../img/a.png". */
export function resolveRelative(base: string, href: string) {
  const stack = href.startsWith("/") ? [] : parentOf(base).split("/").filter(Boolean);
  for (const seg of href.split("/")) {
    if (seg === "..") stack.pop();
    else if (seg && seg !== ".") stack.push(seg);
  }
  return "/" + stack.join("/");
}

/** App URL for a mount path: "/" → "/", "/a b/c" → "/files/a%20b/c". */
export function toUrl(p: string) {
  if (p === "/") return "/";
  return "/files" + p.split("/").map(encodeURIComponent).join("/");
}

/** Mount path for an app URL path (inverse of toUrl). */
export function fromUrl(pathname: string) {
  if (!pathname.startsWith("/files/")) return "/";
  const segs = pathname.slice("/files/".length).split("/").filter(Boolean);
  try {
    return "/" + segs.map(decodeURIComponent).join("/");
  } catch {
    return "/" + segs.join("/");
  }
}

export type Kind = "markdown" | "code" | "image" | "pdf" | "video" | "audio" | "text" | "binary";

const CODE_EXT: Record<string, string> = {
  go: "go", mod: "go", ts: "ts", tsx: "tsx", js: "js", jsx: "jsx", mjs: "js", cjs: "js", py: "python", rs: "rust",
  java: "java", kt: "kotlin", swift: "swift", c: "c", h: "c", cc: "cpp", cpp: "cpp", hpp: "cpp", cs: "csharp",
  rb: "ruby", php: "php", lua: "lua", sh: "bash", bash: "bash", zsh: "bash", fish: "fish", ps1: "powershell",
  sql: "sql", html: "html", htm: "html", css: "css", scss: "scss", less: "less", vue: "vue", svelte: "svelte",
  json: "json", jsonc: "jsonc", json5: "json5", yml: "yaml", yaml: "yaml", toml: "toml", ini: "ini", xml: "xml",
  graphql: "graphql", proto: "proto", tf: "hcl", hcl: "hcl", nix: "nix", diff: "diff", patch: "diff",
  tex: "latex", r: "r", dart: "dart", zig: "zig", ex: "elixir", exs: "elixir", erl: "erlang", hs: "haskell",
  scala: "scala", clj: "clojure", vim: "viml", conf: "ini", env: "dotenv", csv: "csv",
};

const NAME_LANG: Record<string, string> = {
  Dockerfile: "dockerfile", Containerfile: "dockerfile", Makefile: "make", Caddyfile: "nginx",
  Taskfile: "yaml", Jenkinsfile: "groovy", ".gitignore": "ignore", ".dockerignore": "ignore", ".env": "dotenv",
  "go.sum": "text",
};

const IMAGE = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp", "ico"]);
const VIDEO = new Set(["mp4", "webm", "mov", "m4v"]);
const AUDIO = new Set(["mp3", "flac", "ogg", "oga", "m4a", "wav", "aac", "opus"]);

/**
 * Picks the viewer from the name. `text` comes from the server's sniff and
 * decides files whose extension says nothing.
 */
export function kindOf(name: string, text?: boolean): { kind: Kind; lang: string } {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  if (NAME_LANG[name]) return { kind: "code", lang: NAME_LANG[name] };
  if (name.startsWith("Dockerfile")) return { kind: "code", lang: "dockerfile" };
  if (ext === "md" || ext === "markdown" || ext === "mdx") return { kind: "markdown", lang: "markdown" };
  if (IMAGE.has(ext)) return { kind: "image", lang: "" };
  if (ext === "pdf") return { kind: "pdf", lang: "" };
  if (VIDEO.has(ext)) return { kind: "video", lang: "" };
  if (AUDIO.has(ext)) return { kind: "audio", lang: "" };
  if (CODE_EXT[ext]) return { kind: "code", lang: CODE_EXT[ext] };
  if (text) return { kind: "text", lang: "text" };
  return { kind: "binary", lang: "" };
}

/** Viewers that need the file content as text. */
export const isTextKind = (k: Kind) => k === "markdown" || k === "code" || k === "text";
