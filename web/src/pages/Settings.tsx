import { AnimatePresence, motion } from "motion/react";
import { Coins, Plus, RotateCcw, Save, ShieldAlert, Timer, TrendingUp, Trash2, Wallet, X } from "lucide-react";
import { useMemo, useState } from "react";
import { api, AssetSetting, Settings, Status, usd } from "../api";
import { Chips, Section, Slider, Toggle } from "../components/ui";

type Toast = (text: string, kind?: "ok" | "error" | "info") => void;

export function SettingsPage({ settings, presets, status, onSaved, toast }: {
  settings: Settings; presets: AssetSetting[]; status: Status; onSaved: (s: Settings) => void; toast: Toast;
}) {
  const [draft, setDraft] = useState<Settings>(() => structuredClone(settings));
  const [saving, setSaving] = useState(false);
  const [confirmLive, setConfirmLive] = useState(false);
  const [adding, setAdding] = useState(false);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(settings), [draft, settings]);
  const totalWeight = draft.assets.filter((a) => a.enabled).reduce((t, a) => t + a.weight, 0);

  const set = <K extends keyof Settings>(key: K, patch: Partial<Settings[K]>) =>
    setDraft((d) => ({ ...d, [key]: { ...(d[key] as object), ...patch } }));
  const setAsset = (i: number, patch: Partial<AssetSetting>) =>
    setDraft((d) => ({ ...d, assets: d.assets.map((a, j) => (j === i ? { ...a, ...patch } : a)) }));

  const save = async (next = draft) => {
    setSaving(true);
    try {
      const res = await api<{ settings: Settings }>("/settings", { method: "PUT", body: next });
      onSaved(res.settings);
      setDraft(structuredClone(res.settings));
      toast("Einstellungen gespeichert ✓");
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const resetPaper = async () => {
    try {
      await api("/paper/reset", { method: "POST" });
      toast(`Papier-Portfolio auf ${usd(settings.paper.startUsdc, 0)} zurückgesetzt`);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    }
  };

  return (
    <div className="space-y-5">
      {/* Modus */}
      <Section title="Handelsmodus" icon={<Wallet size={20} />} desc="Simulation handelt mit Spielgeld. Live handelt mit deiner Phantom-Wallet.">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { live: false, title: "Simulation", text: "Papier-Portfolio, keine echten Transaktionen." },
            { live: true, title: "Live-Handel", text: status.hasKey ? "Echte Swaps über Jupiter mit deinem Schlüssel." : "Benötigt PRIVATE_KEY in der .env." },
          ].map((m) => {
            const active = draft.dryRun === !m.live;
            return (
              <motion.button key={m.title} type="button" whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.98 }}
                disabled={m.live && !status.hasKey}
                onClick={() => (m.live ? setConfirmLive(true) : setDraft((d) => ({ ...d, dryRun: true })))}
                className={`relative overflow-hidden rounded-2xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${active ? (m.live ? "border-rose-400/50" : "border-cyan-400/50") : "border-line hover:border-white/20"}`}>
                {active && <motion.span layoutId="mode-bg" className={`absolute inset-0 ${m.live ? "bg-rose-500/10" : "bg-cyan-400/10"}`} transition={{ type: "spring", stiffness: 300, damping: 30 }} />}
                <div className="relative">
                  <div className="font-semibold">{m.title}</div>
                  <div className="mt-1 text-sm text-muted">{m.text}</div>
                </div>
              </motion.button>
            );
          })}
        </div>
        <AnimatePresence>
          {draft.dryRun && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="flex flex-wrap items-end gap-4">
                <label className="min-w-48 flex-1 space-y-2">
                  <span className="text-sm text-white/80">Startkapital Simulation (USDC)</span>
                  <input className="field num" type="number" min={10} value={draft.paper.startUsdc} onChange={(e) => set("paper", { startUsdc: Number(e.target.value) })} />
                </label>
                <motion.button whileTap={{ scale: 0.95 }} onClick={resetPaper} className="flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm hover:bg-white/5">
                  <RotateCcw size={16} /> Simulation zurücksetzen
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Section>

      {/* Coins */}
      <Section title="Coins & Gewichtung" icon={<Coins size={20} />} delay={0.05}
        desc="Zielanteil pro Coin, solange sein Trend positiv ist. Der Rest bleibt in USDC.">
        <WeightBar assets={draft.assets} total={totalWeight} />
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {draft.assets.map((a, i) => {
              const isPreset = presets.some((p) => p.symbol === a.symbol);
              return (
                <motion.div key={a.symbol} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: a.enabled ? 1 : 0.55, scale: 1 }} exit={{ opacity: 0, scale: 0.9, height: 0 }}
                  className="rounded-2xl border border-line bg-white/[0.02] p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full" style={{ background: a.color, boxShadow: `0 0 12px ${a.color}` }} />
                    <div className="mr-auto">
                      <span className="font-semibold">{a.symbol}</span> <span className="text-sm text-muted">{a.name}</span>
                    </div>
                    {!isPreset && (
                      <button onClick={() => setDraft((d) => ({ ...d, assets: d.assets.filter((_, j) => j !== i) }))} className="rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-300" title="Entfernen">
                        <Trash2 size={16} />
                      </button>
                    )}
                    <Toggle on={a.enabled} onChange={(v) => setAsset(i, { enabled: v })} />
                  </div>
                  <Slider label="Zielgewicht" value={a.weight} min={0} max={100} unit=" %" onChange={(v) => setAsset(i, { weight: v })} />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
        <AnimatePresence mode="wait">
          {adding ? (
            <AddAsset key="form" existing={draft.assets} onCancel={() => setAdding(false)}
              onAdd={(a) => { setDraft((d) => ({ ...d, assets: [...d.assets, a] })); setAdding(false); }} />
          ) : (
            <motion.button key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} whileHover={{ scale: 1.01 }}
              onClick={() => setAdding(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 py-3 text-sm text-muted hover:border-violet-400/50 hover:text-white">
              <Plus size={16} /> Eigenen Coin hinzufügen
            </motion.button>
          )}
        </AnimatePresence>
      </Section>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Strategie */}
        <Section title="Trend-Strategie" icon={<TrendingUp size={20} />} delay={0.1}
          desc="Ein Coin wird gehalten, wenn der Tageskurs über seinem gleitenden Durchschnitt liegt.">
          <Slider label="Gleitender Durchschnitt (SMA)" value={draft.strategy.smaDays} min={10} max={200} unit=" Tage"
            hint="Kürzer = schnellere Reaktion, aber mehr Fehlsignale und Gebühren. Üblich: 50–100." onChange={(v) => set("strategy", { smaDays: v })} />
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm text-white/80">Momentum-Filter</div>
              <p className="text-xs text-muted">Zusätzlich: Kurs muss höher sein als vor X Tagen.</p>
            </div>
            <Toggle on={draft.strategy.useMomentum} onChange={(v) => set("strategy", { useMomentum: v })} />
          </div>
          <AnimatePresence>
            {draft.strategy.useMomentum && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <Slider label="Momentum-Zeitraum" value={draft.strategy.momentumDays} min={7} max={180} unit=" Tage" onChange={(v) => set("strategy", { momentumDays: v })} />
              </motion.div>
            )}
          </AnimatePresence>
        </Section>

        {/* Risiko */}
        <Section title="Risiko" icon={<ShieldAlert size={20} />} delay={0.15} desc="Schutzmechanismen, die immer greifen.">
          <Slider label="Notbremse bei Drawdown" value={draft.risk.maxDrawdownPct} min={5} max={60} unit=" %"
            hint="Fällt das Portfolio so weit unter seinen Höchststand, wird alles in USDC getauscht und der Bot pausiert." onChange={(v) => set("risk", { maxDrawdownPct: v })} />
          <Slider label="Max. Betrag pro Swap" value={draft.execution.maxTradeUsdc} min={5} max={2000} step={5} format={(v) => usd(v, 0)}
            hint="Größere Umschichtungen werden auf mehrere Prüfungen verteilt." onChange={(v) => set("execution", { maxTradeUsdc: v })} />
          <Slider label="Max. Trades pro Tag" value={draft.execution.maxTradesPerDay} min={1} max={50} onChange={(v) => set("execution", { maxTradesPerDay: v })}
            hint="Gilt für Käufe – Verkäufe zum Schutz sind immer erlaubt." />
          <Slider label="SOL-Reserve für Gebühren" value={draft.risk.minSolReserve} min={0.01} max={0.5} step={0.01} unit=" SOL" format={(v) => v.toFixed(2)} onChange={(v) => set("risk", { minSolReserve: v })} />
        </Section>
      </div>

      {/* Ausführung */}
      <Section title="Ausführung" icon={<Timer size={20} />} delay={0.2} desc="Wie oft und wie vorsichtig der Bot handelt.">
        <div className="space-y-2.5">
          <span className="text-sm text-white/80">Prüfintervall</span>
          <Chips id="interval" value={draft.execution.checkIntervalMin} onChange={(v) => set("execution", { checkIntervalMin: v })}
            options={[{ value: 15, label: "15 min" }, { value: 30, label: "30 min" }, { value: 60, label: "1 h" }, { value: 240, label: "4 h" }, { value: 1440, label: "1 Tag" }]} />
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Slider label="Rebalance-Schwelle" value={draft.execution.rebalanceThresholdPct} min={1} max={20} step={0.5} unit=" %"
            hint="Erst umschichten, wenn Ist und Ziel so weit auseinander liegen." onChange={(v) => set("execution", { rebalanceThresholdPct: v })} />
          <Slider label="Max. Slippage" value={draft.execution.slippageBps} min={10} max={300} step={5} format={(v) => (v / 100).toFixed(2)} unit=" %" onChange={(v) => set("execution", { slippageBps: v })} />
          <Slider label="Max. Price Impact" value={draft.execution.maxPriceImpactPct} min={0.1} max={5} step={0.1} format={(v) => v.toFixed(1)} unit=" %" onChange={(v) => set("execution", { maxPriceImpactPct: v })} />
        </div>
      </Section>

      {/* Speicherleiste */}
      <AnimatePresence>
        {dirty && (
          <motion.div initial={{ y: 120, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 120, opacity: 0 }} transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="fixed inset-x-3 bottom-24 z-40 mx-auto flex max-w-2xl items-center gap-3 rounded-2xl border border-violet-400/30 bg-[#12121f]/95 p-3 pl-5 shadow-2xl shadow-violet-900/40 backdrop-blur-xl lg:bottom-6">
            <span className="mr-auto text-sm">Ungespeicherte Änderungen</span>
            <button onClick={() => setDraft(structuredClone(settings))} className="rounded-xl px-3 py-2 text-sm text-muted hover:text-white">Verwerfen</button>
            <motion.button whileTap={{ scale: 0.95 }} disabled={saving} onClick={() => save()}
              className="relative flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-semibold">
              {saving && <span className="shimmer absolute inset-0" />}
              <Save size={16} /> Speichern
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmLive && (
          <LiveConfirm onCancel={() => setConfirmLive(false)} onConfirm={() => {
            setConfirmLive(false);
            const next = { ...draft, dryRun: false };
            setDraft(next);
            void save(next);
          }} />
        )}
      </AnimatePresence>
    </div>
  );
}

function WeightBar({ assets, total }: { assets: AssetSetting[]; total: number }) {
  const over = total > 100;
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-muted">Verteilung bei positivem Trend</span>
        <motion.span key={total} initial={{ scale: 1.2 }} animate={{ scale: 1 }} className={`num font-medium ${over ? "text-rose-300" : "text-white"}`}>
          {total} % Coins · {Math.max(0, 100 - total)} % USDC
        </motion.span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-white/5">
        {assets.filter((a) => a.enabled && a.weight > 0).map((a) => (
          <motion.div key={a.symbol} layout className="h-full first:rounded-l-full" style={{ background: a.color }}
            animate={{ width: `${(a.weight / Math.max(100, total)) * 100}%` }} transition={{ type: "spring", stiffness: 200, damping: 25 }} />
        ))}
      </div>
      <AnimatePresence>
        {over && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0, x: [0, -6, 6, -3, 0] }} exit={{ opacity: 0 }} className="mt-2 text-sm text-rose-300">
            Summe über 100 % – bitte Gewichte reduzieren.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

const COLORS = ["#f472b6", "#facc15", "#4ade80", "#fb923c", "#38bdf8", "#e879f9"];

function AddAsset({ existing, onAdd, onCancel }: { existing: AssetSetting[]; onAdd: (a: AssetSetting) => void; onCancel: () => void }) {
  const [f, setF] = useState({ symbol: "", name: "", mint: "", decimals: 6, binanceSymbol: "" });
  const valid = f.symbol && f.mint.length >= 32 && f.binanceSymbol && !existing.some((a) => a.symbol === f.symbol);
  const input = (key: keyof typeof f, label: string, placeholder: string, type = "text") => (
    <label className="space-y-1.5">
      <span className="text-xs text-muted">{label}</span>
      <input className="field text-sm" type={type} placeholder={placeholder} value={f[key]}
        onChange={(e) => setF({ ...f, [key]: type === "number" ? Number(e.target.value) : e.target.value })} />
    </label>
  );
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <div className="space-y-3 rounded-2xl border border-violet-400/30 bg-violet-500/5 p-4">
        <div className="flex items-center justify-between">
          <span className="font-medium">Neuer Coin</span>
          <button onClick={onCancel} className="text-muted hover:text-white"><X size={18} /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {input("symbol", "Symbol", "z.B. BONK")}
          {input("name", "Name", "z.B. Bonk")}
          {input("mint", "Solana Mint-Adresse", "Token-Adresse aus Solscan/Jupiter")}
          {input("decimals", "Dezimalstellen", "6", "number")}
          {input("binanceSymbol", "Binance-Kurssymbol (Tageskerzen)", "z.B. BONKUSDT")}
        </div>
        <p className="text-xs text-muted">Die Kurshistorie kommt von Binance, gehandelt wird auf Solana über Jupiter. Prüfe die Mint-Adresse genau – falsche Token sind ein häufiger Betrug.</p>
        <motion.button whileTap={{ scale: 0.96 }} disabled={!valid}
          onClick={() => onAdd({ ...f, symbol: f.symbol.trim(), name: f.name || f.symbol, mint: f.mint.trim(), binanceSymbol: f.binanceSymbol.trim().toUpperCase(), weight: 0, enabled: false, color: COLORS[existing.length % COLORS.length] })}
          className="rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-semibold disabled:opacity-40">
          Hinzufügen
        </motion.button>
      </div>
    </motion.div>
  );
}

function LiveConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const [text, setText] = useState("");
  return (
    <motion.div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}>
      <motion.div onClick={(e) => e.stopPropagation()} initial={{ scale: 0.85, y: 30, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }} className="card w-full max-w-md border-rose-400/40 p-6">
        <motion.div animate={{ rotate: [0, -10, 10, -6, 0] }} transition={{ duration: 0.6, delay: 0.2 }} className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-rose-500/20 text-rose-300">
          <ShieldAlert size={24} />
        </motion.div>
        <h3 className="text-lg font-semibold">Live-Handel aktivieren?</h3>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Der Bot tauscht dann <b className="text-white">echtes Geld</b> in deiner Wallet.</li>
          <li>Verluste sind möglich, Transaktionen sind endgültig.</li>
          <li>Nutze ein separates Phantom-Konto mit kleinem Budget.</li>
        </ul>
        <label className="mt-5 block space-y-2">
          <span className="text-sm">Tippe <b className="font-mono text-rose-300">LIVE</b> zur Bestätigung</span>
          <input autoFocus className="field font-mono" value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-xl px-4 py-2 text-sm text-muted hover:text-white">Abbrechen</button>
          <motion.button whileTap={{ scale: 0.95 }} disabled={text !== "LIVE"} onClick={onConfirm}
            className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold disabled:opacity-30">
            Live schalten
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
