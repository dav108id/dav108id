import { AnimatePresence, motion } from "motion/react";
import { Activity, FlaskConical, LayoutDashboard, Loader2, Pause, Play, RefreshCw, SlidersHorizontal, TriangleAlert, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "./api";
import { Background } from "./components/Background";
import { Toasts, useToasts } from "./components/ui";
import { ActivityPage } from "./pages/Activity";
import { BacktestPage } from "./pages/Backtest";
import { Overview } from "./pages/Overview";
import { SettingsPage } from "./pages/Settings";
import { useLive } from "./useLive";

const TABS = [
  { id: "overview", label: "Übersicht", icon: LayoutDashboard },
  { id: "settings", label: "Strategie", icon: SlidersHorizontal },
  { id: "backtest", label: "Backtest", icon: FlaskConical },
  { id: "activity", label: "Aktivität", icon: Activity },
] as const;
type Tab = (typeof TABS)[number]["id"];

function initialTab(): Tab {
  const h = location.hash.slice(1);
  return (TABS.find((t) => t.id === h)?.id ?? "overview") as Tab;
}

export default function App() {
  const live = useLive();
  const { toasts, push } = useToasts();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [now, setNow] = useState(Date.now());
  const s = live.status;

  useEffect(() => {
    history.replaceState(null, "", `#${tab}`);
  }, [tab]);
  useEffect(() => {
    const onHash = () => setTab(initialTab());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const call = async (path: string, ok: string) => {
    try {
      await api(path, { method: "POST" });
      push(ok);
    } catch (e) {
      push(e instanceof Error ? e.message : String(e), "error");
    }
  };

  const countdown = s?.nextRun ? Math.max(0, Math.round((s.nextRun - now) / 1000)) : null;
  const fmtCountdown = (sec: number) => (sec >= 3600 ? `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m` : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`);

  return (
    <div className="flex min-h-full">
      <Background live={!!s && !s.dryRun} />

      {/* Seitenleiste (Desktop) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line p-5 lg:flex">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-10 flex items-center gap-3 px-2">
          <motion.div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-lg shadow-violet-500/30"
            animate={{ rotate: [0, 8, -8, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
            <Zap size={20} className="text-white" />
          </motion.div>
          <div>
            <div className="font-semibold leading-tight">Trend Bot</div>
            <div className="text-xs text-muted">Solana · Jupiter</div>
          </div>
        </motion.div>
        <nav className="space-y-1">
          {TABS.map((t, i) => (
            <motion.button key={t.id} onClick={() => setTab(t.id)}
              initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}
              className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${tab === t.id ? "text-white" : "text-muted hover:text-white"}`}>
              {tab === t.id && (
                <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-xl border border-violet-400/30 bg-gradient-to-r from-violet-500/25 to-cyan-500/10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }} />
              )}
              <t.icon size={18} className="relative" />
              <span className="relative">{t.label}</span>
            </motion.button>
          ))}
        </nav>
        <div className="mt-auto space-y-2 px-2 text-xs text-muted">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${live.connected ? "bg-emerald-400" : "bg-rose-400"}`} />
            {live.connected ? "Live verbunden" : "Verbinde …"}
          </div>
          {s?.wallet && <div className="truncate font-mono" title={s.wallet}>{s.wallet.slice(0, 6)}…{s.wallet.slice(-6)}</div>}
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-5 sm:px-8 lg:pb-10">
        {/* Kopfzeile */}
        <header className="mb-6 flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <motion.h1 key={tab} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-semibold tracking-tight">
              {TABS.find((t) => t.id === tab)?.label}
            </motion.h1>
            <p className="text-sm text-muted">
              {s?.lastRun ? `Letzte Prüfung ${new Date(s.lastRun).toLocaleTimeString("de-DE")}` : "Noch keine Prüfung"}
              {countdown !== null && <> · nächste in <span className="num font-mono text-white/80">{fmtCountdown(countdown)}</span></>}
            </p>
          </div>

          {s && (
            <motion.div layout className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide ${s.dryRun ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200" : "border-rose-400/40 bg-rose-500/15 text-rose-200"}`}>
              <span className="relative flex h-2 w-2">
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 ${s.dryRun ? "bg-cyan-400" : "bg-rose-400"}`} />
                <span className={`relative inline-flex h-2 w-2 rounded-full ${s.dryRun ? "bg-cyan-400" : "bg-rose-400"}`} />
              </span>
              {s.dryRun ? "SIMULATION" : "LIVE-HANDEL"}
            </motion.div>
          )}

          <motion.button whileTap={{ scale: 0.94 }} whileHover={{ scale: 1.03 }} disabled={!s || s.busy}
            onClick={() => call("/bot/run", "Prüfung ausgeführt")}
            className="flex items-center gap-2 rounded-xl border border-line bg-white/5 px-3.5 py-2 text-sm hover:bg-white/10 disabled:opacity-50">
            <motion.span animate={s?.busy ? { rotate: 360 } : { rotate: 0 }} transition={s?.busy ? { repeat: Infinity, duration: 1, ease: "linear" } : {}}>
              <RefreshCw size={16} />
            </motion.span>
            Jetzt prüfen
          </motion.button>

          {s && (
            <motion.button whileTap={{ scale: 0.94 }} whileHover={{ scale: 1.03 }}
              onClick={() => (s.running ? call("/bot/pause", "Bot pausiert") : call("/bot/start", "Bot gestartet"))}
              className={`relative flex items-center gap-2 overflow-hidden rounded-xl px-4 py-2 text-sm font-semibold shadow-lg ${s.running ? "bg-white/10 text-white" : "bg-gradient-to-r from-violet-500 to-cyan-500 text-white shadow-violet-500/30"}`}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={s.running ? "p" : "s"} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -16, opacity: 0 }} className="flex items-center gap-2">
                  {s.running ? <><Pause size={16} /> Pausieren</> : <><Play size={16} /> Bot starten</>}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          )}
        </header>

        {/* Hinweis-Banner */}
        <AnimatePresence>
          {s?.dataSource === "mock" && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              <b>Demo-Daten:</b> Die Kurse sind erzeugt, nicht echt (DATA_SOURCE=mock). Zum echten Betrieb DATA_SOURCE aus der .env entfernen.
            </motion.div>
          )}
          {s?.killSwitch.triggered && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="mb-4 flex items-center gap-3 overflow-hidden rounded-2xl border border-rose-400/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
              <TriangleAlert size={18} /> <span><b>Notbremse ausgelöst</b> ({s.killSwitch.reason}). Alles liegt in USDC. Prüfe die Lage und starte den Bot neu.</span>
            </motion.div>
          )}
          {(s?.error || live.error) && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {s?.error ?? live.error}
            </motion.div>
          )}
        </AnimatePresence>

        {!s || !live.settings ? (
          <div className="grid h-[60vh] place-items-center text-muted"><Loader2 className="animate-spin" /></div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 14, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(6px)" }} transition={{ duration: 0.28 }}>
              {tab === "overview" && <Overview status={s} equity={live.equity} trades={live.trades} logs={live.logs} settings={live.settings} />}
              {tab === "settings" && <SettingsPage settings={live.settings} presets={live.presets} status={s} onSaved={live.setSettings} toast={push} />}
              {tab === "backtest" && <BacktestPage settings={live.settings} onApply={live.setSettings} toast={push} />}
              {tab === "activity" && <ActivityPage trades={live.trades} logs={live.logs} />}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* Untere Navigation (Mobil) */}
      <nav className="fixed inset-x-3 bottom-3 z-40 flex justify-around rounded-2xl border border-line bg-[#0d0d18]/90 p-1.5 backdrop-blur-xl lg:hidden">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] ${tab === t.id ? "text-white" : "text-muted"}`}>
            {tab === t.id && <motion.span layoutId="mnav" className="absolute inset-0 rounded-xl bg-violet-500/20" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
            <t.icon size={18} className="relative" />
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </nav>

      <Toasts toasts={toasts} />
    </div>
  );
}
