import "dotenv/config";

function str(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") throw new Error(`Fehlende Umgebungsvariable: ${name}`);
  return v;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`${name} ist keine Zahl: ${raw}`);
  return n;
}

export const config = {
  rpcUrl: str("RPC_URL", "https://api.mainnet-beta.solana.com"),
  jupiterApi: str("JUPITER_API", "https://lite-api.jup.ag/swap/v1"),
  privateKey: process.env.PRIVATE_KEY ?? "",
  // Alles außer exakt "false" gilt als Simulation – ein Tippfehler darf nie echtes Geld bewegen.
  dryRun: process.env.DRY_RUN !== "false",

  base: {
    mint: str("BASE_MINT", "So11111111111111111111111111111111111111112"),
    decimals: num("BASE_DECIMALS", 9),
    symbol: str("BASE_SYMBOL", "SOL"),
  },
  quote: {
    mint: str("QUOTE_MINT", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
    decimals: num("QUOTE_DECIMALS", 6),
    symbol: str("QUOTE_SYMBOL", "USDC"),
  },

  tradeSizeQuote: num("TRADE_SIZE_QUOTE", 10),
  slippageBps: num("SLIPPAGE_BPS", 50),
  maxPriceImpactPct: num("MAX_PRICE_IMPACT_PCT", 1),

  pollIntervalSec: num("POLL_INTERVAL_SEC", 60),
  smaFast: num("SMA_FAST", 5),
  smaSlow: num("SMA_SLOW", 20),

  stopLossPct: num("STOP_LOSS_PCT", 5),
  takeProfitPct: num("TAKE_PROFIT_PCT", 10),
  maxTradesPerDay: num("MAX_TRADES_PER_DAY", 6),
  minSolReserve: num("MIN_SOL_RESERVE", 0.02),
};

export const SOL_MINT = "So11111111111111111111111111111111111111112";

if (config.smaFast >= config.smaSlow) throw new Error("SMA_FAST muss kleiner als SMA_SLOW sein");
if (config.slippageBps > 500) throw new Error("SLIPPAGE_BPS > 500 (5 %) ist zu riskant");
