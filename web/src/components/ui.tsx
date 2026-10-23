import { AnimatePresence, motion, useSpring, useTransform } from "motion/react";
import { ReactNode, useEffect, useState } from "react";

export function AnimatedNumber({ value, format, className }: { value: number; format: (v: number) => string; className?: string }) {
  const spring = useSpring(value, { stiffness: 70, damping: 18, mass: 0.8 });
  const text = useTransform(spring, (v) => format(v));
  useEffect(() => spring.set(value), [spring, value]);
  return <motion.span className={`num ${className ?? ""}`}>{text}</motion.span>;
}

export function Card({ children, className = "", delay = 0, hover = true }: { children: ReactNode; className?: string; delay?: number; hover?: boolean }) {
  return (
    <motion.div
      className={`card ${className}`}
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 160, damping: 20, delay }}
      whileHover={hover ? { y: -3, borderColor: "rgba(139,92,246,0.35)" } : undefined}
    >
      {children}
    </motion.div>
  );
}

export function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full p-1 transition-colors disabled:opacity-40 ${on ? "bg-gradient-to-r from-violet-500 to-cyan-400" : "bg-white/10"}`}
      style={{ display: "flex", justifyContent: on ? "flex-end" : "flex-start" }}
      aria-pressed={on}
    >
      <motion.span layout transition={{ type: "spring", stiffness: 600, damping: 32 }} className="block h-5 w-5 rounded-full bg-white shadow-lg" />
    </button>
  );
}

export function Slider({ label, value, min, max, step = 1, unit = "", hint, onChange, format }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; hint?: string;
  onChange: (v: number) => void; format?: (v: number) => string;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-white/80">{label}</span>
        <motion.span key={value} initial={{ scale: 1.25, color: "#c4b5fd" }} animate={{ scale: 1, color: "#ffffff" }} className="num font-mono text-sm font-medium">
          {format ? format(value) : value}{unit}
        </motion.span>
      </div>
      <input type="range" className="slider" min={min} max={max} step={step} value={value}
        style={{ ["--fill" as string]: `${fill}%` }} onChange={(e) => onChange(Number(e.target.value))} />
      {hint && <p className="text-xs leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}

export function Chips<T extends string | number>({ options, value, onChange, id }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; id: string;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-2xl bg-white/[0.04] p-1">
      {options.map((o) => (
        <button key={String(o.value)} type="button" onClick={() => onChange(o.value)}
          className={`relative rounded-xl px-3.5 py-1.5 text-sm transition-colors ${value === o.value ? "text-white" : "text-muted hover:text-white"}`}>
          {value === o.value && (
            <motion.span layoutId={`chip-${id}`} className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-500/80 to-cyan-500/60"
              transition={{ type: "spring", stiffness: 400, damping: 30 }} />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function SignalPill({ on, label }: { on: boolean | null; label?: string }) {
  const color = on === null ? "bg-white/10 text-muted" : on ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300";
  return (
    <motion.span layout className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>
      <span className="relative flex h-2 w-2">
        {on && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${on === null ? "bg-white/40" : on ? "bg-emerald-400" : "bg-rose-400"}`} />
      </span>
      {label ?? (on === null ? "Warm-up" : on ? "Trend aktiv" : "In USDC")}
    </motion.span>
  );
}

export interface ToastMsg { id: number; text: string; kind: "ok" | "error" | "info" }

export function useToasts() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const push = (text: string, kind: ToastMsg["kind"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  };
  return { toasts, push };
}

export function Toasts({ toasts }: { toasts: ToastMsg[] }) {
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} layout
            initial={{ opacity: 0, x: 60, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 60, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className={`card pointer-events-auto max-w-sm px-4 py-3 text-sm shadow-2xl ${t.kind === "error" ? "border-rose-400/40 text-rose-200" : t.kind === "info" ? "text-white" : "border-emerald-400/40 text-emerald-200"}`}>
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function Section({ title, icon, children, delay = 0, desc }: { title: string; icon: ReactNode; children: ReactNode; delay?: number; desc?: string }) {
  return (
    <Card className="p-6" delay={delay} hover={false}>
      <div className="mb-5 flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500/30 to-cyan-400/20 text-violet-200">{icon}</div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          {desc && <p className="mt-0.5 text-sm text-muted">{desc}</p>}
        </div>
      </div>
      <div className="space-y-6">{children}</div>
    </Card>
  );
}
