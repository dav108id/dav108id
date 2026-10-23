# Phantom DeFi Trading-Bot (Solana / Jupiter)

Ein automatischer Trading-Bot für Solana, der mit dem Schlüssel aus deinem **Phantom-Wallet** über den
DEX-Aggregator **Jupiter** handelt (beste Route über Raydium, Orca, Meteora usw.).

> ⚠️ **Wichtig:** Trading-Bots können Geld verlieren – auch schnell. Das hier ist ein Grundgerüst, keine
> Gewinngarantie und keine Finanzberatung. Starte immer im `DRY_RUN`-Modus und handle nur mit Beträgen,
> deren Verlust du verkraftest.

## Wie es funktioniert

1. Alle `POLL_INTERVAL_SEC` Sekunden holt der Bot den Preis (z.B. SOL in USDC) über eine Jupiter-Quote.
2. Die Strategie (SMA-Crossover) erzeugt `buy` / `sell` / `hold`.
3. **Kauf:** `TRADE_SIZE_QUOTE` USDC → SOL. **Verkauf:** bei Gegensignal, Stop-Loss oder Take-Profit.
4. Der Swap wird von Jupiter gebaut, lokal mit deinem Schlüssel signiert und an Solana gesendet.

Position, Tageszähler und Gewinn/Verlust werden in `state.json` gespeichert (überlebt Neustarts).

## Warum nicht „direkt über Phantom“?

Phantom ist eine Browser-/App-Wallet und fragt bei jeder Transaktion nach deiner Bestätigung – ein Bot
kann dort nicht automatisch klicken. Deshalb nutzt der Bot den **privaten Schlüssel eines Phantom-Kontos**.
Die Wallet bleibt dieselbe: du siehst alle Trades und Guthaben weiterhin in Phantom.

**Empfohlenes Setup:**
1. In Phantom ein **neues, separates Konto** anlegen (nur für den Bot).
2. Nur ein kleines Budget hinschicken: etwas USDC zum Handeln + ca. 0,05 SOL für Gebühren.
3. Phantom → Einstellungen → dieses Konto → **„Privaten Schlüssel anzeigen“** → in `.env` als `PRIVATE_KEY`.
4. **Niemals** die Seed Phrase (12/24 Wörter) verwenden und `.env` nie teilen oder committen
   (steht bereits in `.gitignore`).

## Installation

Voraussetzung: Node.js 20+.

```bash
npm install
cp .env.example .env     # dann .env anpassen
npm start                # läuft im DRY_RUN – es wird nichts gesendet
```

Wenn die Logs über ein paar Tage plausibel aussehen: `DRY_RUN=false` setzen → echter Handel.

**Stoppen:** `Strg+C`, oder eine Datei namens `STOP` im Projektordner anlegen (`touch STOP`).

## Einstellungen (`.env`)

| Variable | Bedeutung | Standard |
|---|---|---|
| `RPC_URL` | Solana-RPC. Eigener (Helius, QuickNode …) dringend empfohlen | öffentlicher RPC |
| `PRIVATE_KEY` | Base58-Schlüssel aus Phantom | – |
| `DRY_RUN` | `true` = nur simulieren | `true` |
| `BASE_MINT` / `QUOTE_MINT` | Handelspaar (Token-Adressen) | SOL / USDC |
| `TRADE_SIZE_QUOTE` | Einsatz pro Kauf in USDC | 10 |
| `SLIPPAGE_BPS` | max. Slippage (50 = 0,5 %) | 50 |
| `MAX_PRICE_IMPACT_PCT` | Swap ablehnen bei höherem Price Impact | 1 |
| `SMA_FAST` / `SMA_SLOW` | Länge der gleitenden Durchschnitte (in Ticks) | 5 / 20 |
| `STOP_LOSS_PCT` / `TAKE_PROFIT_PCT` | Ausstieg bei −x % / +x % | 5 / 10 |
| `MAX_TRADES_PER_DAY` | Tageslimit (Stop-Loss greift trotzdem) | 6 |
| `MIN_SOL_RESERVE` | SOL, die immer für Gebühren bleiben | 0,02 |

## Eingebaute Schutzmechanismen

- Standardmäßig **Simulation** – nur exakt `DRY_RUN=false` handelt echt.
- Fester Einsatz pro Trade, Tageslimit, Stop-Loss, Take-Profit.
- Abbruch bei zu hohem Price Impact; Slippage über 5 % wird verweigert.
- Kontostand- und Gebührenreserve-Prüfung vor jedem Swap.
- Kill-Switch per `STOP`-Datei.

## Eigene Strategie

`src/strategy.ts` enthält die Strategie. Jede Klasse mit `update(price): "buy" | "sell" | "hold"` kann
die `SmaCrossover` in `src/index.ts` ersetzen (z.B. RSI, Breakout, DCA).

## Projektstruktur

```
src/config.ts    Einstellungen aus .env
src/wallet.ts    Schlüssel laden, Kontostände
src/jupiter.ts   Quote, Preis, Swap ausführen
src/strategy.ts  Handelsstrategie (SMA-Crossover)
src/state.ts     Position & Limits in state.json
src/index.ts     Hauptschleife, Risiko-Checks
```
