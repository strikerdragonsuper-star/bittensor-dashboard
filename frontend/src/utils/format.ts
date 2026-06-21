export function formatTao(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(digits);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function truncateKey(key: string, left = 6, right = 4): string {
  if (key.length <= left + right + 3) return key;
  return `${key.slice(0, left)}…${key.slice(-right)}`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}
