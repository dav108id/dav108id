import "dotenv/config";

/** Nur Geheimnisse und Infrastruktur kommen aus .env – alles andere wird im Dashboard eingestellt. */
export const env = {
  rpcUrl: process.env.RPC_URL || "https://api.mainnet-beta.solana.com",
  jupiterApi: process.env.JUPITER_API || "https://lite-api.jup.ag/swap/v1",
  privateKey: process.env.PRIVATE_KEY ?? "",
  host: process.env.DASHBOARD_HOST || "127.0.0.1",
  port: Number(process.env.DASHBOARD_PORT || 8787),
  token: process.env.DASHBOARD_TOKEN ?? "",
  // "binance" = echte Tageskerzen, "mock" = erzeugte Demo-Daten (nur zum Ausprobieren)
  dataSource: (process.env.DATA_SOURCE === "mock" ? "mock" : "binance") as "binance" | "mock",
};

export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC = { symbol: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 };
