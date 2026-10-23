import { AnimatePresence, motion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, Coins, Gauge, Repeat, Wallet } from "lucide-react";
import { Area, AreaChart, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ago, AssetView, LogEntry, pct, price, Settings, Status, Trade, usd } from "../api";
import { AnimatedNumber, Card, SignalPill } from "../components/ui";

const tooltipStyle = { background: "#11111d", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 };

export function Overview({ status, equity, trades, logs, settings }: {
  status: Status; equity: { time: number; value: number }[]; trades: Trade[]; logs: LogEntry[]; settings: Settings;
}) {
  const up = status.pnl >= 0;
  const curve = equity.length > 1 ? equity : [{ time: Date.now() - 3600_000, value: status.equity }, { time: Date.now(), value: status.equity }];
  const alloc = [
    ...status.assets.filter((a) => a.value > 0.01).map((a) => ({ name: a.symbol, value: a.value, color: a.color })),
    ...(status.cash > 0.01 ? [{ name: "USDC", value: status.cash, color: "#2775ca" }] : []),
  ];
  const targetCash = 100 - status.assets.reduce((t, a) => t + a.targetPct, 0);

  const kpis = [
    { label: "Portfolio-Wert", icon: Wallet, node: <AnimatedNumber value={status.equity} format={(v) => usd(v)} /> },
    {
      label: "Gewinn / Verlust", icon: up ? ArrowUpRight : ArrowDownRight,
      node: <span className={up ? "text-emerald-300" : "text-rose-300"}><AnimatedNumber value={status.pnl} format={(v) => (v >= 0 ? "+" : "") + usd(v)} /></span>,
      sub: <span className={up ? "text-emerald-300/80" : "text-rose-300/80"}>{pct(status.pnlPct, 2)}</span>,
    },
    {
      label: "Drawdown vom Hoch", icon: Gauge,
      node: <AnimatedNumber value={status.drawdownPct} format={(v) => `${v.toFixed(1)} %`} />,
      sub: <DrawdownBar value={status.drawdownPct} max={settings.risk.maxDrawdownPct} />,
    },
    { label: "Trades heute", icon: Repeat, node: <AnimatedNumber value={status.tradesToday} format={(v) => `${Math.round(v)} / ${settings.execution.maxTradesPerDay}`} /> },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k, i) => (
          <Card key={k.label} className="p-5" delay={i * 0.06}>
            <div className="mb-3 flex items-center justify-between text-sm text-muted">
              {k.label}
              <k.icon size={18} className="text-violet-300" />
            </div>
            <div className="text-2xl font-semibold tracking-tight">{k.node}</div>
            {k.sub && <div className="mt-1.5 text-sm">{k.sub}</div>}
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2" delay={0.2} hover={false}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Portfolio-Verlauf</h3>
            <span className="text-xs text-muted">{equity.length} Messpunkte</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={curve}>
                <defs>
                  <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="eqLine" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#a78bfa" />
                    <stop offset="100%" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" tickFormatter={(t) => new Date(t).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} stroke="#555" fontSize={11} tickLine={false} axisLine={false} minTickGap={40} />
                <YAxis domain={["auto", "auto"]} stroke="#555" fontSize={11} tickLine={false} axisLine={false} width={70} tickFormatter={(v) => usd(v, 0)} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(t) => new Date(t).toLocaleString("de-DE")} formatter={(v: number) => [usd(v), "Wert"]} />
                <Area type="monotone" dataKey="value" stroke="url(#eqLine)" strokeWidth={2.5} fill="url(#eqFill)" animationDuration={1400} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5" delay={0.26} hover={false}>
          <h3 className="mb-2 font-semibold">Aufteilung</h3>
          <div className="relative h-52">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={alloc.length ? alloc : [{ name: "leer", value: 1, color: "#222" }]} dataKey="value" innerRadius={62} outerRadius={88} paddingAngle={3} stroke="none" animationDuration={1200}>
                  {(alloc.length ? alloc : [{ color: "#222" }]).map((a, i) => <Cell key={i} fill={a.color} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [usd(v), n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="text-xs text-muted">Investiert</div>
                <div className="text-xl font-semibold"><AnimatedNumber value={status.equity > 0 ? (1 - status.cash / status.equity) * 100 : 0} format={(v) => `${v.toFixed(0)} %`} /></div>
              </div>
            </div>
          </div>
          <div className="mt-3 space-y-2.5">
            {[...status.assets.map((a) => ({ s: a.symbol, c: a.color, ist: a.weightPct, ziel: a.targetPct })),
              { s: "USDC", c: "#2775ca", ist: status.equity > 0 ? (status.cash / status.equity) * 100 : 100, ziel: targetCash }].map((r, i) => (
              <div key={r.s} className="text-sm">
                <div className="mb-1 flex justify-between">
                  <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: r.c }} />{r.s}</span>
                  <span className="num text-muted">{r.ist.toFixed(1)} % <span className="text-white/30">→</span> <span className="text-white">{r.ziel.toFixed(0)} %</span></span>
                </div>
                <div className="relative h-1.5 overflow-hidden rounded-full bg-white/5">
                  <motion.div className="absolute inset-y-0 left-0 rounded-full" style={{ background: r.c }}
                    initial={{ width: 0 }} animate={{ width: `${Math.min(100, r.ist)}%` }} transition={{ duration: 1, delay: 0.3 + i * 0.08, ease: "easeOut" }} />
                  <motion.div className="absolute inset-y-0 w-0.5 bg-white" initial={{ left: 0 }} animate={{ left: `${Math.min(99.5, r.ziel)}%` }} transition={{ duration: 1, delay: 0.5 }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {status.assets.map((a, i) => <AssetCard key={a.symbol} a={a} smaDays={settings.strategy.smaDays} delay={0.3 + i * 0.07} />)}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card className="p-5" delay={0.4} hover={false}>
          <h3 className="mb-3 font-semibold">Letzte Trades</h3>
          <TradeList trades={trades.slice(0, 6)} />
        </Card>
        <Card className="p-5" delay={0.45} hover={false}>
          <h3 className="mb-3 font-semibold">Live-Log</h3>
          <LogList logs={logs.slice(-8).reverse()} />
        </Card>
      </div>
    </div>
  );
}

function DrawdownBar({ value, max }: { value: number; max: number }) {
  const ratio = Math.min(1, value / max);
  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
        <motion.div className="h-full rounded-full" animate={{ width: `${ratio * 100}%`, backgroundColor: ratio > 0.7 ? "#f87171" : ratio > 0.4 ? "#fbbf24" : "#34d399" }} transition={{ duration: 0.8 }} />
      </div>
      Notbremse {max} %
    </div>
  );
}

function AssetCard({ a, smaDays, delay }: { a: AssetView; smaDays: number; delay: number }) {
  const sig = a.signal;
  return (
    <Card className="overflow-hidden p-5" delay={delay}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <motion.div className="grid h-11 w-11 place-items-center rounded-2xl text-sm font-bold" style={{ background: `${a.color}22`, color: a.color }}
            whileHover={{ rotate: 360 }} transition={{ duration: 0.8 }}>
            {a.symbol.replace(/^(cb|w)/, "").slice(0, 3)}
          </motion.div>
          <div>
            <div className="font-semibold">{a.symbol}</div>
            <div className="text-xs text-muted">{a.name}</div>
          </div>
        </div>
        <SignalPill on={sig ? sig.in : null} />
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <div className="text-xs text-muted">Kurs</div>
          <div className="text-xl font-semibold"><AnimatedNumber value={a.price} format={(v) => `$${price(v)}`} /></div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted">Bestand</div>
          <div className="num text-sm">{a.amount.toLocaleString("de-DE", { maximumFractionDigits: 5 })}</div>
          <div className="num text-xs text-muted">{usd(a.value)}</div>
        </div>
      </div>

      <div className="-mx-1 mt-3 h-24">
        <ResponsiveContainer>
          <LineChart data={a.history}>
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={(_, p) => (p?.[0] ? new Date(p[0].payload.time).toLocaleDateString("de-DE") : "")}
              formatter={(v: number, n: string) => [`$${price(v)}`, n === "close" ? "Kurs" : `SMA ${smaDays}`]} />
            <Line type="monotone" dataKey="sma" stroke="rgba(255,255,255,0.35)" strokeDasharray="4 4" dot={false} strokeWidth={1.5} animationDuration={1600} />
            <Line type="monotone" dataKey="close" stroke={a.color} dot={false} strokeWidth={2} animationDuration={1600} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {sig && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl bg-white/[0.04] px-3 py-2">
            <div className="text-muted">Abstand SMA {smaDays}</div>
            <div className={`num font-medium ${sig.trendPct >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{pct(sig.trendPct)}</div>
          </div>
          <div className="rounded-xl bg-white/[0.04] px-3 py-2">
            <div className="text-muted">Momentum</div>
            <div className={`num font-medium ${sig.momentumPct >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{pct(sig.momentumPct)}</div>
          </div>
        </div>
      )}
    </Card>
  );
}

export function TradeList({ trades }: { trades: Trade[] }) {
  if (!trades.length) return <Empty icon={<Coins size={20} />} text="Noch keine Trades" />;
  return (
    <ul className="space-y-2">
      <AnimatePresence initial={false}>
        {trades.map((t) => (
          <motion.li key={`${t.time}-${t.symbol}-${t.side}`} layout initial={{ opacity: 0, x: -20, height: 0 }} animate={{ opacity: 1, x: 0, height: "auto" }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm">
            <span className={`grid h-8 w-8 place-items-center rounded-lg ${t.side === "buy" ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300"}`}>
              {t.side === "buy" ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{t.side === "buy" ? "Kauf" : "Verkauf"} {t.symbol} {t.dryRun && <span className="ml-1 rounded bg-cyan-400/10 px-1.5 py-0.5 text-[10px] text-cyan-300">SIM</span>}</div>
              <div className="truncate text-xs text-muted">{t.reason}</div>
            </div>
            <div className="text-right">
              <div className="num">{usd(t.usdc)}</div>
              <div className="text-xs text-muted">
                {t.signature ? <a className="text-violet-300 hover:underline" href={`https://solscan.io/tx/${t.signature}`} target="_blank" rel="noreferrer">{ago(t.time)} ↗</a> : ago(t.time)}
              </div>
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

const LEVEL = { info: "text-white/70", trade: "text-violet-300", warn: "text-amber-300", error: "text-rose-300" };

export function LogList({ logs }: { logs: LogEntry[] }) {
  if (!logs.length) return <Empty icon={<Repeat size={20} />} text="Noch keine Einträge" />;
  return (
    <ul className="space-y-1.5 font-mono text-xs">
      <AnimatePresence initial={false}>
        {logs.map((l) => (
          <motion.li key={`${l.time}-${l.message}`} layout initial={{ opacity: 0, y: -10, backgroundColor: "rgba(139,92,246,0.25)" }}
            animate={{ opacity: 1, y: 0, backgroundColor: "rgba(255,255,255,0.02)" }} transition={{ duration: 0.6 }}
            className="flex gap-3 rounded-lg px-2.5 py-1.5">
            <span className="shrink-0 text-white/30">{new Date(l.time).toLocaleTimeString("de-DE")}</span>
            <span className={LEVEL[l.level]}>{l.message}</span>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid place-items-center gap-2 py-10 text-sm text-muted">
      <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2.4, repeat: Infinity }} className="grid h-12 w-12 place-items-center rounded-2xl bg-white/5">{icon}</motion.div>
      {text}
    </motion.div>
  );
}
