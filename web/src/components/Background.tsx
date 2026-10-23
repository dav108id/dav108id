import { motion } from "motion/react";

/** Langsam treibende Farbflächen hinter dem Dashboard. */
export function Background({ live }: { live: boolean }) {
  const blobs = [
    { c: live ? "#f43f5e" : "#7c3aed", x: ["-10%", "15%", "-5%"], y: ["-10%", "10%", "-10%"], s: 620, top: "-10%", left: "-5%" },
    { c: "#06b6d4", x: ["10%", "-10%", "10%"], y: ["0%", "15%", "0%"], s: 520, top: "40%", left: "60%" },
    { c: "#4f46e5", x: ["0%", "12%", "0%"], y: ["10%", "-12%", "10%"], s: 460, top: "60%", left: "5%" },
  ];
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {blobs.map((b, i) => (
        <motion.div key={i} className="absolute rounded-full opacity-[0.16] blur-[110px]"
          style={{ width: b.s, height: b.s, top: b.top, left: b.left }}
          animate={{ x: b.x, y: b.y, backgroundColor: b.c }}
          transition={{ duration: 22 + i * 6, repeat: Infinity, ease: "easeInOut", backgroundColor: { duration: 1.5 } }} />
      ))}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,transparent,#07070d_75%)]" />
      <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
    </div>
  );
}
