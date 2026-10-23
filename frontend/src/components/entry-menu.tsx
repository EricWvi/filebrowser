import { ContextMenu } from "radix-ui";
import { Copy, Download, Star, StarOff } from "lucide-react";
import type { ReactNode } from "react";
import { useFavorites, useToggleFavorite } from "@/hooks/queries";
import { rawUrl } from "@/lib/api";
import { copyText, download } from "@/lib/toast";

const itemCls =
  "flex h-9 cursor-default items-center gap-2.5 rounded-[3px] px-2.5 text-[14px] outline-none select-none data-[highlighted]:bg-hover";

type Target = { name: string; path: string; dir: boolean; missing?: boolean };

/** Long press on touch screens, right click with a mouse. */
export function EntryMenu({ entry, children }: { entry: Target; children: ReactNode }) {
  const favs = useFavorites();
  const toggle = useToggleFavorite();
  const fav = favs.data?.some((f) => f.path === entry.path) ?? false;
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          collisionPadding={8}
          className="z-50 min-w-[180px] rounded-[5px] border border-line bg-raised p-1 shadow-[0_6px_24px_rgba(0,0,0,0.14)]"
        >
          <ContextMenu.Label className="max-w-[260px] truncate px-2.5 pt-1 pb-1.5 text-[12px] text-muted">{entry.name}</ContextMenu.Label>
          <ContextMenu.Item className={itemCls} onSelect={() => toggle.mutate({ path: entry.path, on: !fav })}>
            {fav ? <StarOff size={15} strokeWidth={1.6} /> : <Star size={15} strokeWidth={1.6} />}
            {fav ? "取消收藏" : "收藏"}
          </ContextMenu.Item>
          {!entry.missing && (
            <ContextMenu.Item className={itemCls} onSelect={() => copyText(entry.path, "已复制路径")}>
              <Copy size={15} strokeWidth={1.6} />
              复制路径
            </ContextMenu.Item>
          )}
          {!entry.dir && !entry.missing && (
            <ContextMenu.Item className={itemCls} onSelect={() => download(rawUrl(entry.path, true))}>
              <Download size={15} strokeWidth={1.6} />
              下载
            </ContextMenu.Item>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
