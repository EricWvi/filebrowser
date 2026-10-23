import { File, FileArchive, FileAudio, FileCode, FileImage, FileText, FileVideo, Folder } from "lucide-react";
import { kindOf } from "@/lib/paths";

export function EntryIcon({ name, dir, size = 16 }: { name: string; dir: boolean; size?: number }) {
  const p = { size, strokeWidth: 1.6, className: "shrink-0 text-muted" };
  if (dir) return <Folder size={size} strokeWidth={1.6} className="shrink-0 text-folder" fill="currentColor" fillOpacity={0.18} />;
  const { kind } = kindOf(name);
  if (kind === "markdown") return <FileText {...p} />;
  if (kind === "code") return <FileCode {...p} />;
  if (kind === "image") return <FileImage {...p} />;
  if (kind === "video") return <FileVideo {...p} />;
  if (kind === "audio") return <FileAudio {...p} />;
  if (/\.(gz|tgz|zip|tar|7z|rar|xz|zst|bz2)$/i.test(name)) return <FileArchive {...p} />;
  if (kind === "pdf" || /\.(txt|log)$/i.test(name)) return <FileText {...p} />;
  return <File {...p} />;
}
