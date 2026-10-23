import fs from "node:fs";

export interface Trade {
  time: number;
  side: "buy" | "sell";
  symbol: string;
  amount: number; // Coin-Menge
  usdc: number; // Gegenwert in USDC
  price: number;
  reason: string;
  dryRun: boolean;
  signature?: string;
}

export interface State {
  running: boolean;
  paper: { usdc: number; holdings: Record<string, number> };
  equity: { time: number; value: number }[];
  peakEquity: number;
  trades: Trade[];
  tradesToday: { date: string; count: number };
  lastRun: number | null;
  killSwitch: { triggered: boolean; time?: number; reason?: string };
}

const FILE = "state.json";
const today = () => new Date().toISOString().slice(0, 10);

export function freshState(startUsdc: number): State {
  return {
    running: false,
    paper: { usdc: startUsdc, holdings: {} },
    equity: [],
    peakEquity: 0,
    trades: [],
    tradesToday: { date: today(), count: 0 },
    lastRun: null,
    killSwitch: { triggered: false },
  };
}

export function loadState(startUsdc: number): State {
  const fresh = freshState(startUsdc);
  if (!fs.existsSync(FILE)) return fresh;
  const saved = JSON.parse(fs.readFileSync(FILE, "utf8"));
  // Altes Format (Version 1 des Bots) einfach verwerfen
  if (!saved.paper) return fresh;
  // Nach einem Neustart pausiert der Bot immer, bis man ihn im Dashboard wieder startet
  return { ...fresh, ...saved, running: false };
}

export function saveState(s: State) {
  fs.writeFileSync(FILE, JSON.stringify(s, null, 2));
}

export function tradesToday(s: State): number {
  if (s.tradesToday.date !== today()) s.tradesToday = { date: today(), count: 0 };
  return s.tradesToday.count;
}

export function countTrade(s: State) {
  tradesToday(s);
  s.tradesToday.count++;
}
