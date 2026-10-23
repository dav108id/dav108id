import { env } from "./config.js";

export interface Candle {
  time: number; // Öffnungszeit des Tages (ms)
  close: number;
}

const cache = new Map<string, { at: number; candles: Candle[] }>();
const DAY = 86_400_000;

/** Abgeschlossene Tageskerzen, älteste zuerst. */
export async function dailyCandles(symbol: string, days: number): Promise<Candle[]> {
  const key = `${symbol}:${days}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.candles;
  const candles = env.dataSource === "mock" ? mockCandles(symbol, days) : await binanceCandles(symbol, days);
  cache.set(key, { at: Date.now(), candles });
  return candles;
}

async function binanceCandles(symbol: string, days: number): Promise<Candle[]> {
  const out: Candle[] = [];
  let start = Date.now() - (days + 1) * DAY;
  while (out.length < days + 1) {
    const url = `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=1d&limit=1000&startTime=${start}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Kursdaten ${symbol}: HTTP ${res.status}`);
    const rows = (await res.json()) as [number, string, string, string, string, string, number][];
    if (rows.length === 0) break;
    for (const r of rows) if (r[6] < Date.now()) out.push({ time: r[0], close: Number(r[4]) });
    start = rows[rows.length - 1][0] + DAY;
    if (rows.length < 1000) break;
  }
  return out.slice(-days);
}

// --- Demo-Daten: reproduzierbarer Zufallspfad mit Trendphasen ---

const MOCK_START: Record<string, number> = { SOLUSDT: 150, BTCUSDT: 95_000, ETHUSDT: 3_200, JUPUSDT: 0.9 };

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function mockCandles(symbol: string, days: number): Candle[] {
  const today = Math.floor(Date.now() / DAY) * DAY;
  const total = 2000;
  const rnd = seeded([...symbol].reduce((h, c) => h * 31 + c.charCodeAt(0), 7) >>> 0);
  let price = MOCK_START[symbol] ?? 10;
  let drift = 0;
  const all: Candle[] = [];
  for (let i = total; i >= 1; i--) {
    if (rnd() < 0.02) drift = (rnd() - 0.45) * 0.012;
    const gauss = Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
    price *= Math.exp(drift + gauss * 0.035);
    all.push({ time: today - i * DAY, close: price });
  }
  // Auf das heutige Startniveau skalieren, damit die Beträge realistisch aussehen
  const scale = (MOCK_START[symbol] ?? 10) / all[all.length - 1].close;
  return all.slice(-days).map((c) => ({ time: c.time, close: c.close * scale }));
}

/** Pseudo-Livepreis im Demo-Modus: letzter Schlusskurs mit kleinem Rauschen. */
export function mockLivePrice(lastClose: number): number {
  return lastClose * (1 + (Math.random() - 0.5) * 0.004);
}
