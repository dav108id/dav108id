import { Settings } from "./settings.js";

export interface Signal {
  in: boolean; // true = Coin halten, false = in USDC
  close: number;
  sma: number;
  trendPct: number; // Abstand des Kurses zum SMA in %
  momentumPct: number; // Veränderung über momentumDays in %
}

/** Trendfolge-Signal aus Schlusskursen (älteste zuerst). Gibt null zurück, solange zu wenig Historie da ist. */
export function trendSignal(closes: number[], s: Settings["strategy"]): Signal | null {
  const need = Math.max(s.smaDays, s.useMomentum ? s.momentumDays + 1 : 0);
  if (closes.length < need) return null;
  const close = closes[closes.length - 1];
  const window = closes.slice(-s.smaDays);
  const sma = window.reduce((a, b) => a + b, 0) / window.length;
  const past = closes[closes.length - 1 - Math.min(s.momentumDays, closes.length - 1)];
  const trendPct = (close / sma - 1) * 100;
  const momentumPct = (close / past - 1) * 100;
  return { in: trendPct > 0 && (!s.useMomentum || momentumPct > 0), close, sma, trendPct, momentumPct };
}

export const warmupDays = (s: Settings["strategy"]) => Math.max(s.smaDays, s.momentumDays + 1);
