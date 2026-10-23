export type Entry = {
  name: string;
  path: string;
  dir: boolean;
  size: number;
  mtime: number;
  /** Visible children, for directories in a listing. */
  count?: number;
  /** Whether the file looks like UTF-8 text; from stat only. */
  text?: boolean;
};

export type Favorite = Entry & { missing?: boolean };

export type Info = { name: string; version: string };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(res.status, body?.error ?? res.statusText);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const q = (path: string) => encodeURIComponent(path);

export const api = {
  info: () => request<Info>("/api/info"),
  list: (path: string, hidden: boolean) => request<Entry[]>(`/api/list?path=${q(path)}${hidden ? "&hidden=1" : ""}`),
  stat: (path: string) => request<Entry>(`/api/stat?path=${q(path)}`),
  favorites: () => request<Favorite[]>("/api/favorites"),
  addFavorite: (path: string) =>
    request<void>("/api/favorites", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    }),
  removeFavorite: (path: string) => request<void>(`/api/favorites?path=${q(path)}`, { method: "DELETE" }),
  text: async (path: string) => {
    const res = await fetch(rawUrl(path));
    if (!res.ok) throw new ApiError(res.status, res.statusText);
    return res.text();
  },
};

export const rawUrl = (path: string, download = false) => `/api/raw?path=${q(path)}${download ? "&download=1" : ""}`;
