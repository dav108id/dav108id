import { dailyCandles } from "./market.js";
import { Settings } from "./settings.js";
import { trendSignal, warmupDays } from "./strategy.js";

export interface BacktestResult {
  curve: { time: number; strategy: number; hold: number }[];
  metrics: {
    strategy: Metrics;
    hold: Metrics;
    trades: number;
    feesPaid: number;
    exposurePct: number;
  };
  assets: { symbol: string; color: string; weight: number }[];
}

interface Metrics {
  totalReturnPct: number;
  cagrPct: number;
  maxDrawdownPct: number;
  sharpe: number;
}

/**
 * Simuliert die Trendfolge-Strategie auf Tageskerzen. Entscheidung am Tagesschluss t,
 * Rendite ab Tag t+1 – es wird also nie in die Zukunft geschaut. Gebühren + Slippage
 * werden auf jedes gehandelte Volumen abgezogen.
 */
export async function runBacktest(settings: Settings, days: number, feeBps: number): Promise<BacktestResult> {
  const assets = settings.assets.filter((a) => a.enabled && a.weight > 0);
  if (assets.length === 0) throw new Error("Kein aktiver Coin mit Gewicht > 0");
  const warm = warmupDays(settings.strategy);
  const series = await Promise.all(assets.map((a) => dailyCandles(a.binanceSymbol, days + warm)));

  // Nur Tage verwenden, für die alle Coins Kurse haben
  const common = series.map((c) => new Map(c.map((x) => [x.time, x.close])));
  const times = series[0].map((c) => c.time).filter((t) => common.every((m) => m.has(t)));
  if (times.length < warm + 30) throw new Error("Zu wenig gemeinsame Kurshistorie für diesen Zeitraum");
  const closes = common.map((m) => times.map((t) => m.get(t)!));

  const costRate = (feeBps + settings.execution.slippageBps) / 10_000;
  const threshold = settings.execution.rebalanceThresholdPct / 100;
  const start = warm - 1;
  const capital = settings.paper.startUsdc;

  let cash = capital;
  const units = assets.map(() => 0);
  const holdUnits = assets.map((a, i) => (capital * a.weight) / 100 / closes[i][start]);
  const holdCash = capital - assets.reduce((t, a) => t + (capital * a.weight) / 100, 0);
  let trades = 0;
  let fees = 0;
  let investedDays = 0;
  const curve: BacktestResult["curve"] = [];

  for (let t = start; t < times.length; t++) {
    const prices = closes.map((c) => c[t]);
    const equity = cash + units.reduce((v, u, i) => v + u * prices[i], 0);
    curve.push({ time: times[t], strategy: equity, hold: holdCash + holdUnits.reduce((v, u, i) => v + u * prices[i], 0) });
    if (t === times.length - 1) break;

    // Verkäufe zuerst, damit Cash für Käufe frei wird
    const plan = assets.map((a, i) => {
      const sig = trendSignal(closes[i].slice(0, t + 1), settings.strategy);
      const target = sig?.in ? (equity * a.weight) / 100 : 0;
      return { i, diff: target - units[i] * prices[i], target };
    });
    plan.sort((x, y) => x.diff - y.diff);
    for (const { i, diff, target } of plan) {
      if (Math.abs(diff) < threshold * equity && !(target === 0 && units[i] > 0)) continue;
      if (Math.abs(diff) < 1) continue;
      const notional = diff > 0 ? Math.min(diff, cash / (1 + costRate)) : diff;
      if (Math.abs(notional) < 1) continue;
      const cost = Math.abs(notional) * costRate;
      units[i] += notional / prices[i];
      cash -= notional + cost;
      fees += cost;
      trades++;
    }
    if (units.some((u) => u > 0)) investedDays++;
  }

  return {
    curve,
    metrics: {
      strategy: metrics(curve.map((c) => c.strategy)),
      hold: metrics(curve.map((c) => c.hold)),
      trades,
      feesPaid: fees,
      exposurePct: (investedDays / Math.max(1, curve.length - 1)) * 100,
    },
    assets: assets.map((a) => ({ symbol: a.symbol, color: a.color, weight: a.weight })),
  };
}

function metrics(values: number[]): Metrics {
  const rets = values.slice(1).map((v, i) => v / values[i] - 1);
  const mean = rets.reduce((a, b) => a + b, 0) / Math.max(1, rets.length);
  const sd = Math.sqrt(rets.reduce((a, r) => a + (r - mean) ** 2, 0) / Math.max(1, rets.length - 1));
  let peak = values[0];
  let maxDd = 0;
  for (const v of values) {
    peak = Math.max(peak, v);
    maxDd = Math.max(maxDd, 1 - v / peak);
  }
  const total = values[values.length - 1] / values[0] - 1;
  const years = (values.length - 1) / 365;
  return {
    totalReturnPct: total * 100,
    cagrPct: years > 0 ? ((1 + total) ** (1 / years) - 1) * 100 : 0,
    maxDrawdownPct: maxDd * 100,
    sharpe: sd > 0 ? (mean / sd) * Math.sqrt(365) : 0,
  };
}
