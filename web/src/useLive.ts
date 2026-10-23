import { useCallback, useEffect, useRef, useState } from "react";
import { api, LogEntry, Settings, Status, token, Trade, AssetSetting } from "./api";

/** Hält Status, Einstellungen, Trades und Logs aktuell – per Server-Sent Events, mit Polling als Fallback. */
export function useLive() {
  const [status, setStatus] = useState<Status | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [presets, setPresets] = useState<AssetSetting[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [equity, setEquity] = useState<{ time: number; value: number }[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastEquityFetch = useRef(0);

  const reload = useCallback(async () => {
    try {
      const [st, se, tr, lg, eq] = await Promise.all([
        api<Status>("/status"),
        api<{ settings: Settings; presets: AssetSetting[] }>("/settings"),
        api<Trade[]>("/trades"),
        api<LogEntry[]>("/logs"),
        api<{ time: number; value: number }[]>("/equity"),
      ]);
      setStatus(st);
      setSettings(se.settings);
      setPresets(se.presets);
      setTrades(tr);
      setLogs(lg);
      setEquity(eq);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void reload();
    const es = new EventSource(`/api/events${token() ? `?token=${encodeURIComponent(token())}` : ""}`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.addEventListener("status", (e) => {
      setStatus(JSON.parse((e as MessageEvent).data));
      // Equity-Verlauf ändert sich nur pro Lauf – gedrosselt nachladen
      if (Date.now() - lastEquityFetch.current > 3000) {
        lastEquityFetch.current = Date.now();
        api<{ time: number; value: number }[]>("/equity").then(setEquity).catch(() => {});
      }
    });
    es.addEventListener("log", (e) => setLogs((l) => [...l.slice(-299), JSON.parse((e as MessageEvent).data)]));
    es.addEventListener("trade", (e) => setTrades((t) => [JSON.parse((e as MessageEvent).data), ...t].slice(0, 500)));
    const poll = setInterval(() => api<Status>("/status").then(setStatus).catch(() => {}), 15_000);
    return () => {
      es.close();
      clearInterval(poll);
    };
  }, [reload]);

  return { status, settings, setSettings, presets, trades, logs, equity, connected, error, reload };
}
