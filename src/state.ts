import fs from "node:fs";

export interface Position {
  baseAmount: number; // gekaufte Menge Basis-Token
  entryPrice: number; // Quote pro Basis-Token
  openedAt: string;
}

export interface State {
  position: Position | null;
  tradesToday: { date: string; count: number };
  realizedPnlQuote: number;
}

const FILE = "state.json";
const today = () => new Date().toISOString().slice(0, 10);

export function loadState(): State {
  const fresh: State = { position: null, tradesToday: { date: today(), count: 0 }, realizedPnlQuote: 0 };
  if (!fs.existsSync(FILE)) return fresh;
  return { ...fresh, ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
}

export function saveState(s: State) {
  fs.writeFileSync(FILE, JSON.stringify(s, null, 2));
}

export function tradesLeft(s: State, max: number): number {
  if (s.tradesToday.date !== today()) s.tradesToday = { date: today(), count: 0 };
  return max - s.tradesToday.count;
}

export function countTrade(s: State) {
  tradesLeft(s, 0);
  s.tradesToday.count++;
}
