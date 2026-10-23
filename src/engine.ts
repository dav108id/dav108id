import { EventEmitter } from "node:events";
import { Connection, Keypair } from "@solana/web3.js";
import { env, SOL_MINT, USDC } from "./config.js";
import { executeSwap, getQuote, getUsdcPrice, Quote } from "./jupiter.js";
import { dailyCandles, mockLivePrice } from "./market.js";
import { AssetSetting, loadSettings, saveSettings, Settings, validateSettings } from "./settings.js";
import { countTrade, freshState, loadState, saveState, State, Trade, tradesToday } from "./state.js";
import { Signal, trendSignal, warmupDays } from "./strategy.js";
import { loadKeypair, tokenBalance } from "./wallet.js";

export interface LogEntry {
  time: number;
  level: "info" | "trade" | "warn" | "error";
  message: string;
}

interface AssetView {
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

const toRaw = (amount: number, decimals: number) => BigInt(Math.floor(amount * 10 ** decimals));

/**
 * Der eigentliche Bot. Läuft im Intervall, berechnet für jeden Coin das Trendsignal auf
 * Tageskerzen und schichtet das Portfolio Richtung Zielgewichte um. Im Dry-Run wird ein
 * Papier-Portfolio geführt, live wird über Jupiter mit dem Phantom-Schlüssel gehandelt.
 */
export class Engine extends EventEmitter {
  settings: Settings;
  state: State;
  logs: LogEntry[] = [];
  view: { assets: AssetView[]; cash: number; equity: number; error: string | null } = { assets: [], cash: 0, equity: 0, error: null };
  busy = false;
  private timer: NodeJS.Timeout | null = null;
  private conn = new Connection(env.rpcUrl, "confirmed");
  readonly wallet: Keypair | null = loadKeypair();

  constructor() {
    super();
    this.settings = loadSettings();
    this.state = loadState(this.settings.paper.startUsdc);
    if (!this.settings.dryRun && !this.wallet) {
      this.settings.dryRun = true;
      this.log("warn", "Kein PRIVATE_KEY gesetzt – zurück auf Dry-Run");
    }
  }

  log(level: LogEntry["level"], message: string) {
    const entry = { time: Date.now(), level, message };
    this.logs.push(entry);
    if (this.logs.length > 300) this.logs.shift();
    console.log(new Date(entry.time).toISOString(), level.toUpperCase(), message);
    this.emit("log", entry);
  }

  private changed() {
    saveState(this.state);
    this.emit("status");
  }

  start() {
    if (this.state.killSwitch.triggered) this.state.killSwitch = { triggered: false };
    this.state.running = true;
    this.log("info", `Bot gestartet (${this.settings.dryRun ? "Dry-Run" : "LIVE"})`);
    this.schedule(0);
    this.changed();
  }

  pause(reason = "Bot pausiert") {
    this.state.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.log("info", reason);
    this.changed();
  }

  get nextRun(): number | null {
    if (!this.state.running || !this.state.lastRun) return null;
    return this.state.lastRun + this.settings.execution.checkIntervalMin * 60_000;
  }

  private schedule(delayMs: number) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(async () => {
      await this.runOnce();
      if (this.state.running) this.schedule(this.settings.execution.checkIntervalMin * 60_000);
    }, delayMs);
  }

  updateSettings(next: Settings) {
    validateSettings(next);
    if (!next.dryRun && !this.wallet) throw new Error("Live-Handel braucht einen PRIVATE_KEY in der .env");
    const modeChanged = next.dryRun !== this.settings.dryRun;
    this.settings = next;
    saveSettings(next);
    if (modeChanged) {
      // Equity-Verlauf von Papier und echtem Konto nicht vermischen
      this.state.equity = [];
      this.state.peakEquity = 0;
      this.log("warn", next.dryRun ? "Umgestellt auf DRY-RUN (Simulation)" : "Umgestellt auf LIVE-HANDEL – echtes Geld!");
    } else {
      this.log("info", "Einstellungen gespeichert");
    }
    if (this.state.running) this.schedule(0);
    this.changed();
  }

  resetPaper() {
    const running = this.state.running;
    this.state = { ...freshState(this.settings.paper.startUsdc), running };
    this.log("info", `Papier-Portfolio zurückgesetzt auf ${this.settings.paper.startUsdc} USDC`);
    this.changed();
    void this.refresh();
  }

  private enabledAssets(): AssetSetting[] {
    return this.settings.assets.filter((a) => a.enabled);
  }

  private async price(a: AssetSetting, lastClose: number): Promise<number> {
    if (env.dataSource === "mock") return mockLivePrice(lastClose);
    return getUsdcPrice(a.mint, a.decimals);
  }

  private async balances(): Promise<{ usdc: number; holdings: Record<string, number> }> {
    if (this.settings.dryRun || !this.wallet) return this.state.paper;
    const owner = this.wallet.publicKey;
    const holdings: Record<string, number> = {};
    for (const a of this.enabledAssets()) {
      const bal = await tokenBalance(this.conn, owner, a.mint, a.decimals);
      // SOL-Reserve für Gebühren zählt nicht zum handelbaren Bestand
      holdings[a.symbol] = a.mint === SOL_MINT ? Math.max(0, bal - this.settings.risk.minSolReserve) : bal;
    }
    return { usdc: await tokenBalance(this.conn, owner, USDC.mint, USDC.decimals), holdings };
  }

  /** Lädt Kurse und Signale und baut die Ansicht fürs Dashboard – ohne zu handeln. */
  async refresh(): Promise<{ prices: Record<string, number>; signals: Record<string, Signal | null> }> {
    const s = this.settings;
    const prices: Record<string, number> = {};
    const signals: Record<string, Signal | null> = {};
    const views: AssetView[] = [];
    const bal = await this.balances();
    const histDays = warmupDays(s.strategy) + 120;

    for (const a of this.enabledAssets()) {
      const candles = await dailyCandles(a.binanceSymbol, histDays);
      const closes = candles.map((c) => c.close);
      signals[a.symbol] = trendSignal(closes, s.strategy);
      prices[a.symbol] = await this.price(a, closes[closes.length - 1]);
      const amount = bal.holdings[a.symbol] ?? 0;
      views.push({
        symbol: a.symbol,
        name: a.name,
        color: a.color,
        amount,
        price: prices[a.symbol],
        value: amount * prices[a.symbol],
        weightPct: 0,
        targetPct: signals[a.symbol]?.in ? a.weight : 0,
        signal: signals[a.symbol],
        history: candles.slice(-120).map((c, i, arr) => {
          const idx = closes.length - arr.length + i;
          const win = closes.slice(Math.max(0, idx - s.strategy.smaDays + 1), idx + 1);
          return { time: c.time, close: c.close, sma: win.length === s.strategy.smaDays ? win.reduce((x, y) => x + y, 0) / win.length : null };
        }),
      });
    }
    const equity = bal.usdc + views.reduce((t, v) => t + v.value, 0);
    for (const v of views) v.weightPct = equity > 0 ? (v.value / equity) * 100 : 0;
    this.view = { assets: views, cash: bal.usdc, equity, error: null };
    this.emit("status");
    return { prices, signals };
  }

  async runOnce() {
    if (this.busy) return;
    this.busy = true;
    this.emit("status");
    try {
      const { prices, signals } = await this.refresh();
      const s = this.settings;
      const equity = this.view.equity;

      this.state.lastRun = Date.now();
      this.state.equity.push({ time: Date.now(), value: equity });
      if (this.state.equity.length > 3000) this.state.equity.shift();
      this.state.peakEquity = Math.max(this.state.peakEquity, equity);

      const drawdown = this.state.peakEquity > 0 ? (1 - equity / this.state.peakEquity) * 100 : 0;
      if (drawdown >= s.risk.maxDrawdownPct) {
        this.log("error", `Notbremse: Drawdown ${drawdown.toFixed(1)} % ≥ ${s.risk.maxDrawdownPct} % – verkaufe alles nach USDC`);
        for (const v of this.view.assets) if (v.amount > 0) await this.trade("sell", v.symbol, v.amount, prices[v.symbol], "Notbremse", true);
        this.state.killSwitch = { triggered: true, time: Date.now(), reason: `Drawdown ${drawdown.toFixed(1)} %` };
        this.pause("Bot wegen Notbremse pausiert – im Dashboard prüfen und neu starten");
        return;
      }

      const threshold = (s.execution.rebalanceThresholdPct / 100) * equity;
      const plan = this.view.assets
        .map((v) => {
          const a = s.assets.find((x) => x.symbol === v.symbol)!;
          const target = signals[v.symbol]?.in ? (equity * a.weight) / 100 : 0;
          return { v, target, diff: target - v.value, sig: signals[v.symbol] };
        })
        .sort((x, y) => x.diff - y.diff); // Verkäufe zuerst

      let traded = false;
      for (const { v, target, diff, sig } of plan) {
        if (!sig) continue;
        const exit = target === 0 && v.amount > 0;
        if (!exit && Math.abs(diff) < threshold) continue;
        if (diff < 0) {
          // Große Ausstiege werden auf mehrere Läufe verteilt (max. maxTradeUsdc pro Swap)
          const usd = Math.min(exit ? v.value : -diff, s.execution.maxTradeUsdc);
          const amount = usd >= v.value ? v.amount : usd / v.price;
          if (amount * v.price < 1) continue;
          const reason = exit ? `Trend negativ (${sig.trendPct.toFixed(1)} % zum SMA)` : "Rebalancing";
          traded = (await this.trade("sell", v.symbol, amount, v.price, reason)) || traded;
        } else {
          if (tradesToday(this.state) >= s.execution.maxTradesPerDay) {
            this.log("warn", `Tageslimit von ${s.execution.maxTradesPerDay} Trades erreicht – Kauf ${v.symbol} ausgelassen`);
            continue;
          }
          const cash = (await this.balances()).usdc;
          const usd = Math.min(diff, s.execution.maxTradeUsdc, cash);
          if (usd < 1) continue;
          const reason = v.amount > 0 ? "Rebalancing" : `Trend positiv (+${sig.trendPct.toFixed(1)} % zum SMA)`;
          traded = (await this.trade("buy", v.symbol, usd / v.price, v.price, reason)) || traded;
        }
      }
      if (traded) await this.refresh();
      else this.log("info", `Prüfung abgeschlossen – keine Umschichtung nötig (Wert ${equity.toFixed(2)} USDC)`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.view.error = msg;
      this.log("error", msg);
    } finally {
      this.busy = false;
      this.changed();
    }
  }

  /** Ein Swap Coin<->USDC. amount ist die Coin-Menge. force umgeht das Price-Impact-Limit (Notbremse). */
  private async trade(side: Trade["side"], symbol: string, amount: number, price: number, reason: string, force = false): Promise<boolean> {
    const a = this.settings.assets.find((x) => x.symbol === symbol)!;
    const ex = this.settings.execution;
    // Demo-Daten: Ausführung mit halber Slippage simulieren; sonst echte Jupiter-Quote
    const slip = 1 - ex.slippageBps / 20_000;
    const spend = amount * price;
    let usdc = side === "buy" ? spend : spend * slip;
    if (side === "buy") amount = (spend / price) * slip;
    let quote: Quote | null = null;

    if (env.dataSource !== "mock") {
      quote = side === "sell"
        ? await getQuote(a.mint, USDC.mint, toRaw(amount, a.decimals), ex.slippageBps)
        : await getQuote(USDC.mint, a.mint, toRaw(spend, USDC.decimals), ex.slippageBps);
      const impact = Number(quote.priceImpactPct) * 100;
      if (impact > ex.maxPriceImpactPct && !force) {
        this.log("warn", `${side === "buy" ? "Kauf" : "Verkauf"} ${symbol} abgebrochen: Price Impact ${impact.toFixed(2)} % > ${ex.maxPriceImpactPct} %`);
        return false;
      }
      if (side === "sell") usdc = Number(quote.outAmount) / 10 ** USDC.decimals;
      else amount = Number(quote.outAmount) / 10 ** a.decimals;
    }

    let signature: string | undefined;
    if (this.settings.dryRun) {
      const p = this.state.paper;
      if (side === "buy") {
        p.usdc -= usdc;
        p.holdings[symbol] = (p.holdings[symbol] ?? 0) + amount;
      } else {
        p.holdings[symbol] = Math.max(0, (p.holdings[symbol] ?? 0) - amount);
        p.usdc += usdc;
      }
    } else {
      signature = await executeSwap(this.conn, this.wallet!, quote!);
    }

    const t: Trade = { time: Date.now(), side, symbol, amount, usdc, price, reason, dryRun: this.settings.dryRun, signature };
    this.state.trades.unshift(t);
    if (this.state.trades.length > 500) this.state.trades.pop();
    countTrade(this.state);
    this.log("trade", `${this.settings.dryRun ? "[SIM] " : ""}${side === "buy" ? "KAUF" : "VERKAUF"} ${amount.toFixed(6)} ${symbol} für ${usdc.toFixed(2)} USDC – ${reason}`);
    this.emit("trade", t);
    this.changed();
    return true;
  }

  status() {
    const eq = this.view.equity;
    const first = this.state.equity[0]?.value ?? (this.settings.dryRun ? this.settings.paper.startUsdc : eq);
    return {
      running: this.state.running,
      busy: this.busy,
      dryRun: this.settings.dryRun,
      dataSource: env.dataSource,
      wallet: this.wallet?.publicKey.toBase58() ?? null,
      hasKey: !!this.wallet,
      equity: eq,
      cash: this.view.cash,
      pnl: eq - first,
      pnlPct: first > 0 ? (eq / first - 1) * 100 : 0,
      peakEquity: this.state.peakEquity,
      drawdownPct: this.state.peakEquity > 0 ? Math.max(0, (1 - eq / this.state.peakEquity) * 100) : 0,
      assets: this.view.assets,
      lastRun: this.state.lastRun,
      nextRun: this.nextRun,
      tradesToday: tradesToday(this.state),
      killSwitch: this.state.killSwitch,
      error: this.view.error,
    };
  }
}
