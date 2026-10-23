const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function formatSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}

export function formatTime(t: number, now = Date.now()) {
  const d = now - t;
  if (d < MIN) return "刚刚";
  if (d < HOUR) return `${Math.round(d / MIN)} 分钟前`;
  if (d < DAY) return `${Math.round(d / HOUR)} 小时前`;
  if (d < 7 * DAY) return `${Math.round(d / DAY)} 天前`;
  const dt = new Date(t);
  const md = `${dt.getMonth() + 1}-${String(dt.getDate()).padStart(2, "0")}`;
  return dt.getFullYear() === new Date(now).getFullYear() ? md : `${dt.getFullYear()}-${md}`;
}
