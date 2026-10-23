import { AnimatePresence, motion } from "motion/react";
import { Check, FlaskConical, Play } from "lucide-react";
import { useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, BacktestResult, pct, Settings, usd } from "../api";
import { AnimatedNumber, Card, Chips, Section, Slider, Toggle } from "../components/ui";

type Toast = (text: string, kind?: "ok" | "error" | "info") => void;

export function BacktestPage({ settings, onApply, toast }: { settings: Settings; onApply: (s: Settings) => void; toast: Toast }) {
  const [days, setDays] = useState(1095);
  const [feeBps, setFeeBps] = useState(10);
  const [strategy, setStrategy] = useState(settings.strategy);
  const [threshold, setThreshold] = useState(settings.execution.rebalanceThresholdPct);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const changed = JSON.stringify(strategy) !== JSON.stringify(settings.strategy) || threshold !== settings.execution.rebalanceThresholdPct;

  const run = async () => {
    setLoading(true);
    try {
      const r = await api<BacktestResult>("/backtest", {
        method: "POST",
        body: { days, feeBps, settings: { strategy, execution: { ...settings.execution, rebalanceThresholdPct: threshold } } },
      });
      setResult(r);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    try {
      const res = await api<{ settings: Settings }>("/settings", { method: "PUT", body: { strategy, execution: { ...settings.execution, rebalanceThresholdPct: threshold } } });
      onApply(res.settings);
      toast("Backtest-Parameter übernommen ✓");
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    }
  };

  const m = result?.metrics;
  const beat = m ? m.strategy.totalReturnPct - m.hold.totalReturnPct : 0;

  return (
    <div className="space-y-5">
      <Section title="Strategie testen" icon={<FlaskConical size={20} />}
        desc="Spielt die Trend-Strategie mit deinen aktiven Coins auf echten Tageskursen durch – inklusive Gebühren und Slippage – und vergleicht sie mit einfachem Halten.">
        <div className="flex flex-wrap items-center gap-4">
          <Chips id="period" value={days} onChange={setDays}
            options={[{ value: 365, label: "1 Jahr" }, { value: 730, label: "2 Jahre" }, { value: 1095, label: "3 Jahre" }, { value: 1460, label: "4 Jahre" }]} />
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <Slider label="SMA" value={strategy.smaDays} min={10} max={200} unit=" Tage" onChange={(v) => setStrategy({ ...strategy, smaDays: v })} />
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/80">Momentum</span>
              <Toggle on={strategy.useMomentum} onChange={(v) => setStrategy({ ...strategy, useMomentum: v })} />
            </div>
            <input type="range" className="slider" min={7} max={180} value={strategy.momentumDays} disabled={!strategy.useMomentum}
              style={{ ["--fill" as string]: `${((strategy.momentumDays - 7) / 173) * 100}%`, opacity: strategy.useMomentum ? 1 : 0.3 }}
              onChange={(e) => setStrategy({ ...strategy, momentumDays: Number(e.target.value) })} />
            <div className="num text-right font-mono text-xs text-muted">{strategy.momentumDays} Tage</div>
          </div>
          <Slider label="Rebalance-Schwelle" value={threshold} min={1} max={20} step={0.5} unit=" %" onChange={setThreshold} />
          <Slider label="DEX-Gebühr je Trade" value={feeBps} min={0} max={50} format={(v) => (v / 100).toFixed(2)} unit=" %" onChange={setFeeBps} />
        </div>
        <div className="flex flex-wrap gap-3">
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.95 }} onClick={run} disabled={loading}
            className="relative flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold shadow-lg shadow-violet-500/30">
            {loading && <span className="shimmer absolute inset-0" />}
            <motion.span animate={loading ? { rotate: 360 } : {}} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}><Play size={16} /></motion.span>
            {loading ? "Rechne …" : "Backtest starten"}
          </motion.button>
          <AnimatePresence>
            {changed && (
              <motion.button initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} whileTap={{ scale: 0.95 }} onClick={apply}
                className="flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm hover:bg-white/5">
                <Check size={16} /> Als Bot-Einstellung übernehmen
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </Section>

      <AnimatePresence mode="wait">
        {result && m && (
          <motion.div key={JSON.stringify(m)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className={`rounded-2xl border px-5 py-4 text-sm ${beat >= 0 ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100" : "border-amber-400/30 bg-amber-400/10 text-amber-100"}`}>
              {beat >= 0
                ? <>Die Strategie lag <b>{pct(beat)}</b> vor einfachem Halten, bei einem maximalen Rückgang von {m.strategy.maxDrawdownPct.toFixed(1)} % statt {m.hold.maxDrawdownPct.toFixed(1)} %.</>
                : <>Einfaches Halten war in diesem Zeitraum <b>{pct(-beat)}</b> besser. Die Strategie hatte dafür einen Rückgang von {m.strategy.maxDrawdownPct.toFixed(1)} % statt {m.hold.maxDrawdownPct.toFixed(1)} %.</>}
              <span className="mt-1 block text-xs opacity-70">Vergangene Ergebnisse garantieren keine zukünftigen.</span>
            </motion.div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                { l: "Rendite gesamt", s: m.strategy.totalReturnPct, h: m.hold.totalReturnPct, f: (v: number) => pct(v) },
                { l: "Rendite pro Jahr", s: m.strategy.cagrPct, h: m.hold.cagrPct, f: (v: number) => pct(v) },
                { l: "Max. Drawdown", s: -m.strategy.maxDrawdownPct, h: -m.hold.maxDrawdownPct, f: (v: number) => `${v.toFixed(1)} %` },
                { l: "Sharpe Ratio", s: m.strategy.sharpe, h: m.hold.sharpe, f: (v: number) => v.toFixed(2) },
              ].map((k, i) => (
                <Card key={k.l} className="p-5" delay={i * 0.07}>
                  <div className="text-sm text-muted">{k.l}</div>
                  <div className={`mt-2 text-2xl font-semibold ${k.s >= k.h ? "text-emerald-300" : "text-white"}`}><AnimatedNumber value={k.s} format={k.f} /></div>
                  <div className="mt-1 text-xs text-muted">Halten: <span className="num">{k.f(k.h)}</span></div>
                </Card>
              ))}
            </div>

            <Card className="p-5" delay={0.25} hover={false}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">Strategie vs. Halten</h3>
                <div className="flex gap-4 text-xs text-muted">
                  <span>{m.trades} Trades</span><span>Gebühren {usd(m.feesPaid)}</span><span>Investiert {m.exposurePct.toFixed(0)} % der Zeit</span>
                </div>
              </div>
              <div className="h-80">
                <ResponsiveContainer>
                  <LineChart data={result.curve}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="time" tickFormatter={(t) => new Date(t).toLocaleDateString("de-DE", { month: "short", year: "2-digit" })} stroke="#555" fontSize={11} tickLine={false} axisLine={false} minTickGap={50} />
                    <YAxis stroke="#555" fontSize={11} tickLine={false} axisLine={false} width={70} tickFormatter={(v) => usd(v, 0)} />
                    <Tooltip contentStyle={{ background: "#11111d", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }}
                      labelFormatter={(t) => new Date(t).toLocaleDateString("de-DE")} formatter={(v: number, n: string) => [usd(v), n === "strategy" ? "Strategie" : "Halten"]} />
                    <Legend formatter={(v) => (v === "strategy" ? "Trend-Strategie" : "Kaufen & Halten")} />
                    <Line type="monotone" dataKey="hold" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} dot={false} animationDuration={1800} />
                    <Line type="monotone" dataKey="strategy" stroke="#a78bfa" strokeWidth={2.5} dot={false} animationDuration={2200} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
