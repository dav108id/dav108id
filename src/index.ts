import { env } from "./config.js";
import { Engine } from "./engine.js";
import { createServer } from "./server.js";

const engine = new Engine();
engine.setMaxListeners(50);

createServer(engine).listen(env.port, env.host, () => {
  engine.log("info", `Dashboard läuft auf http://${env.host}:${env.port}`);
  if (env.dataSource === "mock") engine.log("warn", "DEMO-DATEN aktiv (DATA_SOURCE=mock) – Kurse sind nicht echt");
  engine.refresh().catch((e) => engine.log("error", `Kurse konnten nicht geladen werden: ${e.message}`));
});
