# Trend Bot – Solana DeFi-Trading mit Dashboard

Automatischer Trading-Bot für dein **Phantom-Wallet** auf Solana. Er folgt dem Trend großer Coins
(SOL, Bitcoin, Ethereum) auf Tagesbasis, handelt über den DEX-Aggregator **Jupiter** und wird komplett
über ein animiertes Web-Dashboard gesteuert.

> ⚠️ **Wichtig:** Trading kann Geld kosten. Das hier ist keine Finanzberatung und keine Gewinngarantie.
> Starte immer in der Simulation und handle nur mit Beträgen, deren Verlust du verkraftest.

## Strategie: Trendfolge (Time-Series Momentum)

Von den gängigen Krypto-Strategien ist Trendfolge in der Forschung am besten belegt, vor allem bei
großen, liquiden Coins. Regeln pro Coin, berechnet auf Tageskerzen:

- **Kurs über dem gleitenden Durchschnitt** (Standard: 50 Tage) **und** – optional – höher als vor
  30 Tagen → Coin halten, mit seinem Zielgewicht (z.B. 40 % BTC, 30 % SOL, 30 % ETH).
- **Sonst** → dieser Anteil geht in USDC.
- Umgeschichtet wird erst, wenn Ist und Ziel um mehr als die Rebalance-Schwelle abweichen (spart Gebühren).

Ziel ist nicht, jeden Anstieg mitzunehmen, sondern große Abstürze zu umgehen. In Seitwärtsphasen
verliert die Strategie durch Fehlsignale etwas. Teste sie im **Backtest** mit echten Kursen.

## Dashboard

| Seite | Inhalt |
|---|---|
| **Übersicht** | Portfolio-Wert, Gewinn/Verlust, Drawdown, Verlauf, Aufteilung Ist → Ziel, Kurs + SMA je Coin, Trades, Live-Log |
| **Strategie** | Simulation/Live, Coins & Gewichte (auch eigene Coins), SMA, Momentum, Notbremse, Tradegrößen, Intervall, Slippage |
| **Backtest** | Strategie über 1–4 Jahre durchrechnen, mit Kaufen & Halten vergleichen, Parameter übernehmen |
| **Aktivität** | Alle Trades (Live-Trades mit Solscan-Link) und das komplette Log |

Oben rechts: **Bot starten/pausieren** und **Jetzt prüfen**. Nach einem Neustart ist der Bot immer
pausiert, bis du ihn im Dashboard startest.

## Installation

Voraussetzung: Node.js 20+.

```bash
npm install
cp .env.example .env      # RPC_URL und (für Live) PRIVATE_KEY eintragen
npm run build             # Dashboard bauen
npm start                 # → http://127.0.0.1:8787 öffnen
```

Nur mal ansehen, ohne Internet und Wallet: `npm run build && npm run demo` (erzeugte Demo-Kurse).

Entwicklung mit Hot-Reload: `npm run dev` → http://localhost:5173

## Phantom-Wallet verbinden

Phantom fragt bei jeder Transaktion nach Bestätigung – ein Bot kann dort nicht klicken. Deshalb nutzt
er den **privaten Schlüssel eines Phantom-Kontos**. Alles bleibt in Phantom sichtbar.

1. In Phantom ein **neues, separates Konto** nur für den Bot anlegen.
2. Kleines Budget hinschicken: USDC zum Handeln + ca. 0,05 SOL für Gebühren.
3. Phantom → Einstellungen → dieses Konto → **„Privaten Schlüssel anzeigen“** → in `.env` als `PRIVATE_KEY`.
4. **Niemals** die Seed Phrase verwenden. `.env` nie teilen (steht in `.gitignore`).
5. Im Dashboard unter *Strategie → Handelsmodus* auf **Live-Handel** umschalten (Bestätigung mit „LIVE“).

## Schutzmechanismen

- Standard ist **Simulation** mit Papier-Portfolio; Live nur mit Schlüssel und ausdrücklicher Bestätigung.
- **Notbremse:** Fällt das Portfolio um X % unter seinen Höchststand, wird alles in USDC getauscht und der Bot pausiert.
- Max. Betrag pro Swap (größere Umschichtungen werden über mehrere Prüfungen verteilt), Tageslimit für Käufe.
- Abbruch bei zu hohem Price Impact, begrenzte Slippage, SOL-Reserve für Gebühren.
- Dashboard lauscht nur auf `127.0.0.1`. Für Zugriff von außen `DASHBOARD_TOKEN` setzen.

## Projektstruktur

```
src/                Bot (Node.js)
  index.ts          Start: Engine + Dashboard-Server
  engine.ts         Hauptlogik: Signale, Umschichten, Notbremse, Papier-Portfolio
  strategy.ts       Trendsignal (SMA + Momentum)
  backtest.ts       Backtest auf Tageskerzen inkl. Gebühren
  market.ts         Tageskerzen (Binance) bzw. Demo-Daten
  jupiter.ts        Quotes & Swaps über Jupiter
  wallet.ts         Schlüssel, Kontostände
  settings.ts       Einstellungen (settings.json) + Prüfung
  state.ts          Zustand (state.json): Trades, Verlauf
  server.ts         REST-API + Live-Events für das Dashboard
web/                Dashboard (React, Motion, Recharts, Tailwind)
```
