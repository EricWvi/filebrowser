import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api, type Entry, type Favorite } from "@/lib/api";
import { toast } from "@/lib/toast";

export const useInfo = () => useQuery({ queryKey: ["info"], queryFn: api.info, staleTime: Infinity });

export const useStat = (path: string) => useQuery({ queryKey: ["stat", path], queryFn: () => api.stat(path) });

export const useList = (path: string, hidden: boolean, enabled: boolean) =>
  useQuery({ queryKey: ["list", path, hidden], queryFn: () => api.list(path, hidden), enabled });

/** File content keyed by mtime, so an edited file is fetched again. */
export const useText = (entry: Entry, enabled: boolean) =>
  useQuery({
    queryKey: ["text", entry.path, entry.mtime],
    queryFn: () => api.text(entry.path),
    enabled,
    staleTime: Infinity,
  });

export const useFavorites = () => useQuery({ queryKey: ["favorites"], queryFn: api.favorites });

/**
 * Seeds stat for child directories, so opening one from a listing needs
 * only its own list request. Files are not seeded: their stat carries the
 * text sniff, which a listing does not have.
 */
export function seedDirs(qc: QueryClient, entries: Entry[]) {
  for (const e of entries) {
    if (e.dir && !qc.getQueryData(["stat", e.path])) qc.setQueryData(["stat", e.path], e);
  }
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ path, on }: { path: string; on: boolean }) =>
      on ? api.addFavorite(path) : api.removeFavorite(path),
    onMutate: async ({ path, on }) => {
      await qc.cancelQueries({ queryKey: ["favorites"] });
      const prev = qc.getQueryData<Favorite[]>(["favorites"]);
      if (prev && !on) qc.setQueryData(["favorites"], prev.filter((f) => f.path !== path));
      return { prev };
    },
    onSuccess: (_d, { on }) => toast(on ? "已收藏" : "已取消收藏"),
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["favorites"], ctx.prev);
      toast("操作失败：" + (err as Error).message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
  });
}
