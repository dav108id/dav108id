import express, { NextFunction, Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { runBacktest } from "./backtest.js";
import { env } from "./config.js";
import { Engine } from "./engine.js";
import { PRESET_ASSETS, Settings } from "./settings.js";

export function createServer(engine: Engine) {
  const app = express();
  app.use(express.json({ limit: "200kb" }));

  // Optionaler Schutz, falls das Dashboard nicht nur lokal erreichbar ist
  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    if (!env.token) return next();
    const given = req.header("x-dashboard-token") ?? req.query.token;
    if (given === env.token) return next();
    res.status(401).json({ error: "Token fehlt oder ist falsch" });
  });

  const wrap = (fn: (req: Request, res: Response) => unknown) => async (req: Request, res: Response) => {
    try {
      const out = await fn(req, res);
      if (!res.headersSent) res.json(out ?? { ok: true });
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    }
  };

  app.get("/api/status", wrap(() => engine.status()));
  app.get("/api/equity", wrap(() => engine.state.equity));
  app.get("/api/trades", wrap(() => engine.state.trades));
  app.get("/api/logs", wrap(() => engine.logs));
  app.get("/api/settings", wrap(() => ({ settings: engine.settings, presets: PRESET_ASSETS })));
  app.put("/api/settings", wrap((req) => {
    engine.updateSettings({ ...engine.settings, ...(req.body as Partial<Settings>) });
    return { settings: engine.settings };
  }));
  app.post("/api/bot/start", wrap(() => engine.start()));
  app.post("/api/bot/pause", wrap(() => engine.pause()));
  app.post("/api/bot/run", wrap(async () => {
    await engine.runOnce();
  }));
  app.post("/api/paper/reset", wrap(() => engine.resetPaper()));
  app.post("/api/backtest", wrap((req) => {
    const { days = 730, feeBps = 10, settings } = req.body ?? {};
    return runBacktest({ ...engine.settings, ...(settings ?? {}) }, Number(days), Number(feeBps));
  }));

  // Live-Updates per Server-Sent Events
  app.get("/api/events", (req, res) => {
    res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.flushHeaders();
    const send = (type: string, data: unknown) => res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    const onStatus = () => send("status", engine.status());
    const onLog = (l: unknown) => send("log", l);
    const onTrade = (t: unknown) => send("trade", t);
    engine.on("status", onStatus);
    engine.on("log", onLog);
    engine.on("trade", onTrade);
    const ping = setInterval(() => res.write(": ping\n\n"), 25_000);
    req.on("close", () => {
      clearInterval(ping);
      engine.off("status", onStatus);
      engine.off("log", onLog);
      engine.off("trade", onTrade);
    });
  });

  const dist = path.resolve("web/dist");
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
  }
  return app;
}
