import fs from "node:fs";
import { Connection, Keypair } from "@solana/web3.js";
import { config, SOL_MINT } from "./config.js";
import { executeSwap, getPrice, getQuote, Quote } from "./jupiter.js";
import { countTrade, loadState, saveState, State, tradesLeft } from "./state.js";
import { SmaCrossover, Signal } from "./strategy.js";
import { loadKeypair, tokenBalance } from "./wallet.js";

const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);
const toRaw = (amount: number, decimals: number) => BigInt(Math.floor(amount * 10 ** decimals));

const conn = new Connection(config.rpcUrl, "confirmed");
const wallet: Keypair | null = loadKeypair();
const state = loadState();
const strategy = new SmaCrossover(config.smaFast, config.smaSlow);
const { base, quote } = config;

if (!config.dryRun && !wallet) throw new Error("DRY_RUN=false braucht einen PRIVATE_KEY");

async function swap(q: Quote, label: string): Promise<boolean> {
  const impact = Number(q.priceImpactPct) * 100;
  if (impact > config.maxPriceImpactPct) {
    log(`⚠️  ${label} abgebrochen: Price Impact ${impact.toFixed(2)} % > ${config.maxPriceImpactPct} %`);
    return false;
  }
  if (config.dryRun) {
    log(`🧪 [DRY RUN] ${label}`);
    return true;
  }
  const sig = await executeSwap(conn, wallet!, q);
  log(`✅ ${label} – https://solscan.io/tx/${sig}`);
  return true;
}

async function buy(price: number) {
  if (wallet && !config.dryRun) {
    const quoteBal = await tokenBalance(conn, wallet.publicKey, quote.mint, quote.decimals);
    if (quoteBal < config.tradeSizeQuote) return log(`Kauf übersprungen: nur ${quoteBal} ${quote.symbol} verfügbar`);
    const solBal = await tokenBalance(conn, wallet.publicKey, SOL_MINT, 9);
    if (solBal < config.minSolReserve) return log(`Kauf übersprungen: zu wenig SOL für Gebühren (${solBal})`);
  }
  const q = await getQuote(quote.mint, base.mint, toRaw(config.tradeSizeQuote, quote.decimals));
  const baseAmount = Number(q.outAmount) / 10 ** base.decimals;
  if (!(await swap(q, `KAUF ${baseAmount.toFixed(6)} ${base.symbol} für ${config.tradeSizeQuote} ${quote.symbol} @ ${price.toFixed(4)}`))) return;
  state.position = { baseAmount, entryPrice: price, openedAt: new Date().toISOString() };
  countTrade(state);
}

async function sell(price: number, reason: string) {
  const pos = state.position!;
  let amount = pos.baseAmount;
  if (wallet && !config.dryRun) {
    const bal = await tokenBalance(conn, wallet.publicKey, base.mint, base.decimals);
    // Beim Verkauf von SOL die Gebührenreserve stehen lassen
    const usable = base.mint === SOL_MINT ? bal - config.minSolReserve : bal;
    amount = Math.min(amount, usable);
    if (amount <= 0) return log(`Verkauf übersprungen: kein ${base.symbol} verfügbar`);
  }
  const q = await getQuote(base.mint, quote.mint, toRaw(amount, base.decimals));
  const out = Number(q.outAmount) / 10 ** quote.decimals;
  const pnl = out - pos.baseAmount * pos.entryPrice;
  if (!(await swap(q, `VERKAUF (${reason}) ${amount.toFixed(6)} ${base.symbol} -> ${out.toFixed(2)} ${quote.symbol}, PnL ${pnl.toFixed(2)}`))) return;
  state.realizedPnlQuote += pnl;
  state.position = null;
  countTrade(state);
}

async function tick() {
  if (fs.existsSync("STOP")) {
    log("🛑 Datei STOP gefunden – Bot beendet.");
    process.exit(0);
  }

  const price = await getPrice();
  const signal: Signal = strategy.update(price);
  const pos = state.position;
  const change = pos ? ((price - pos.entryPrice) / pos.entryPrice) * 100 : 0;
  log(`${base.symbol}=${price.toFixed(4)} ${quote.symbol} | Signal ${signal} | SMA ${strategy.warmup}` +
    (pos ? ` | Position ${change >= 0 ? "+" : ""}${change.toFixed(2)} %` : "") +
    ` | PnL gesamt ${state.realizedPnlQuote.toFixed(2)}`);

  if (tradesLeft(state, config.maxTradesPerDay) <= 0) {
    // Ausstiege über Stop-Loss bleiben auch nach dem Tageslimit erlaubt
    if (!(pos && change <= -config.stopLossPct)) return;
  }

  if (pos) {
    if (change <= -config.stopLossPct) await sell(price, "Stop-Loss");
    else if (change >= config.takeProfitPct) await sell(price, "Take-Profit");
    else if (signal === "sell") await sell(price, "Signal");
  } else if (signal === "buy") {
    await buy(price);
  }
  saveState(state);
}

async function main() {
  log(`Start – ${config.dryRun ? "🧪 DRY RUN (kein echtes Geld)" : "💸 LIVE-HANDEL"} | Wallet ${wallet?.publicKey.toBase58() ?? "(keine)"}`);
  log(`Paar ${base.symbol}/${quote.symbol}, Einsatz ${config.tradeSizeQuote} ${quote.symbol}, SL ${config.stopLossPct} %, TP ${config.takeProfitPct} %`);
  for (;;) {
    try {
      await tick();
    } catch (e) {
      log("Fehler:", e instanceof Error ? e.message : e);
    }
    await new Promise((r) => setTimeout(r, config.pollIntervalSec * 1000));
  }
}

main();
