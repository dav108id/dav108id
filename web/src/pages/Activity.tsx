import { LogEntry, Trade } from "../api";
import { Card } from "../components/ui";
import { LogList, TradeList } from "./Overview";

export function ActivityPage({ trades, logs }: { trades: Trade[]; logs: LogEntry[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <Card className="p-5" hover={false}>
        <h3 className="mb-3 font-semibold">Alle Trades <span className="text-sm font-normal text-muted">({trades.length})</span></h3>
        <div className="max-h-[70vh] overflow-y-auto pr-1"><TradeList trades={trades.slice(0, 100)} /></div>
      </Card>
      <Card className="p-5" delay={0.08} hover={false}>
        <h3 className="mb-3 font-semibold">Log</h3>
        <div className="max-h-[70vh] overflow-y-auto pr-1"><LogList logs={[...logs].reverse().slice(0, 150)} /></div>
      </Card>
    </div>
  );
}
