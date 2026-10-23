export interface AssetSetting {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  binanceSymbol: string;
  weight: number;
  enabled: boolean;
  color: string;
}

export interface Settings {
  dryRun: boolean;
  assets: AssetSetting[];
  strategy: { smaDays: number; useMomentum: boolean; momentumDays: number };
  execution: {
    checkIntervalMin: number;
    rebalanceThresholdPct: number;
    slippageBps: number;
    maxPriceImpactPct: number;
    maxTradeUsdc: number;
    maxTradesPerDay: number;
  };
  risk: { maxDrawdownPct: number; minSolReserve: number };
  paper: { startUsdc: number };
}

export interface Signal { in: boolean; close: number; sma: number; trendPct: number; momentumPct: number }

export interface AssetView {
  symbol: string;
  name: string;
  color: string;
  amount: number;
  price: number;
  value: number;
  weightPct: number;
  targetPct: number;
  signal: Signal | null;
  history: { time: number; close: number; sma: number | null }[];
}

export interface Status {
  running: boolean;
  busy: boolean;
  dryRun: boolean;
  dataSource: "binance" | "mock";
  wallet: string | null;
  hasKey: boolean;
  equity: number;
  cash: number;
  pnl: number;
  pnlPct: number;
  peakEquity: number;
  drawdownPct: number;
  assets: AssetView[];
  lastRun: number | null;
  nextRun: number | null;
  tradesToday: number;
  killSwitch: { triggered: boolean; time?: number; reason?: string };
  error: string | null;
}

export interface Trade {
  time: number;
  side: "buy" | "sell";
  symbol: string;
  amount: number;
  usdc: number;
  price: number;
  reason: string;
  dryRun: boolean;
  signature?: string;
}

export interface LogEntry { time: number; level: "info" | "trade" | "warn" | "error"; message: string }

interface Metrics { totalReturnPct: number; cagrPct: number; maxDrawdownPct: number; sharpe: number }
export interface BacktestResult {
  curve: { time: number; strategy: number; hold: number }[];
  metrics: { strategy: Metrics; hold: Metrics; trades: number; feesPaid: number; exposurePct: number };
  assets: { symbol: string; color: string; weight: number }[];
}

// Token aus ?token=… übernehmen und merken (nur nötig, wenn DASHBOARD_TOKEN gesetzt ist)
const urlToken = new URLSearchParams(location.search).get("token");
if (urlToken) {
  try { localStorage.setItem("dashboardToken", urlToken); } catch { /* egal */ }
}
export function token(): string {
  try { return urlToken ?? localStorage.getItem("dashboardToken") ?? ""; } catch { return urlToken ?? ""; }
}

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init?.method ?? "GET",
    headers: { "Content-Type": "application/json", "x-dashboard-token": token() },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

export const usd = (v: number, digits = 2) =>
  v.toLocaleString("de-DE", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });
export const pct = (v: number, digits = 1) => `${v >= 0 ? "+" : ""}${v.toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`;
export const price = (v: number) =>
  v.toLocaleString("de-DE", { maximumFractionDigits: v >= 1000 ? 0 : v >= 1 ? 2 : 4, minimumFractionDigits: v >= 1000 ? 0 : 2 });
export const ago = (t: number) => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return `vor ${s}s`;
  if (s < 3600) return `vor ${Math.round(s / 60)} min`;
  if (s < 86400) return `vor ${Math.round(s / 3600)} h`;
  return new Date(t).toLocaleDateString("de-DE");
};
