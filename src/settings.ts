import fs from "node:fs";
import { SOL_MINT } from "./config.js";

export interface AssetSetting {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  binanceSymbol: string; // Quelle der Tageskerzen, z.B. SOLUSDT
  weight: number; // Ziel-Anteil am Portfolio in %, wenn der Trend positiv ist
  enabled: boolean;
  color: string;
}

export interface Settings {
  dryRun: boolean;
  assets: AssetSetting[];
  strategy: {
    smaDays: number; // Trendfilter: Kurs über dem gleitenden Durchschnitt
    useMomentum: boolean; // zusätzlich: Kurs höher als vor momentumDays Tagen
    momentumDays: number;
  };
  execution: {
    checkIntervalMin: number;
    rebalanceThresholdPct: number; // erst handeln, wenn Ist und Ziel so weit auseinander liegen
    slippageBps: number;
    maxPriceImpactPct: number;
    maxTradeUsdc: number;
    maxTradesPerDay: number;
  };
  risk: {
    maxDrawdownPct: number; // Notbremse: alles in USDC und Bot pausieren
    minSolReserve: number;
  };
  paper: { startUsdc: number };
}

export const PRESET_ASSETS: AssetSetting[] = [
  { symbol: "SOL", name: "Solana", mint: SOL_MINT, decimals: 9, binanceSymbol: "SOLUSDT", weight: 30, enabled: true, color: "#a78bfa" },
  { symbol: "cbBTC", name: "Bitcoin (Coinbase)", mint: "cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij", decimals: 8, binanceSymbol: "BTCUSDT", weight: 40, enabled: true, color: "#f7931a" },
  { symbol: "wETH", name: "Ethereum (Wormhole)", mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", decimals: 8, binanceSymbol: "ETHUSDT", weight: 30, enabled: true, color: "#60a5fa" },
  { symbol: "JUP", name: "Jupiter", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", decimals: 6, binanceSymbol: "JUPUSDT", weight: 0, enabled: false, color: "#34d399" },
];

export const DEFAULT_SETTINGS: Settings = {
  dryRun: true,
  assets: PRESET_ASSETS,
  strategy: { smaDays: 50, useMomentum: true, momentumDays: 30 },
  execution: { checkIntervalMin: 60, rebalanceThresholdPct: 5, slippageBps: 50, maxPriceImpactPct: 1, maxTradeUsdc: 100, maxTradesPerDay: 10 },
  risk: { maxDrawdownPct: 25, minSolReserve: 0.03 },
  paper: { startUsdc: 1000 },
};

const FILE = "settings.json";

export function loadSettings(): Settings {
  if (!fs.existsSync(FILE)) return structuredClone(DEFAULT_SETTINGS);
  const saved = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const d = structuredClone(DEFAULT_SETTINGS);
  return {
    ...d,
    ...saved,
    strategy: { ...d.strategy, ...saved.strategy },
    execution: { ...d.execution, ...saved.execution },
    risk: { ...d.risk, ...saved.risk },
    paper: { ...d.paper, ...saved.paper },
  };
}

export function saveSettings(s: Settings) {
  fs.writeFileSync(FILE, JSON.stringify(s, null, 2));
}

const between = (v: unknown, min: number, max: number, name: string) => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) throw new Error(`${name} muss zwischen ${min} und ${max} liegen`);
};

/** Wirft eine verständliche Fehlermeldung, wenn Einstellungen unsinnig oder gefährlich sind. */
export function validateSettings(s: Settings) {
  if (!Array.isArray(s.assets) || s.assets.length === 0) throw new Error("Mindestens ein Coin wird benötigt");
  const symbols = new Set<string>();
  for (const a of s.assets) {
    if (!a.symbol || !a.mint || !a.binanceSymbol) throw new Error("Jeder Coin braucht Symbol, Mint-Adresse und Kursquelle");
    if (symbols.has(a.symbol)) throw new Error(`Coin ${a.symbol} ist doppelt`);
    symbols.add(a.symbol);
    between(a.decimals, 0, 18, `Dezimalstellen von ${a.symbol}`);
    between(a.weight, 0, 100, `Gewicht von ${a.symbol}`);
  }
  const total = s.assets.filter((a) => a.enabled).reduce((t, a) => t + a.weight, 0);
  if (total > 100) throw new Error(`Summe der Gewichte ist ${total} % – maximal 100 %`);
  between(s.strategy.smaDays, 5, 365, "SMA-Tage");
  between(s.strategy.momentumDays, 5, 365, "Momentum-Tage");
  between(s.execution.checkIntervalMin, 5, 1440, "Prüfintervall");
  between(s.execution.rebalanceThresholdPct, 0.5, 50, "Rebalance-Schwelle");
  between(s.execution.slippageBps, 1, 500, "Slippage");
  between(s.execution.maxPriceImpactPct, 0.05, 10, "Max. Price Impact");
  between(s.execution.maxTradeUsdc, 1, 1_000_000, "Max. Tradegröße");
  between(s.execution.maxTradesPerDay, 1, 200, "Max. Trades pro Tag");
  between(s.risk.maxDrawdownPct, 1, 90, "Max. Drawdown");
  between(s.risk.minSolReserve, 0.005, 10, "SOL-Reserve");
  between(s.paper.startUsdc, 10, 10_000_000, "Startkapital");
}
