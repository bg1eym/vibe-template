import { buildApp } from "./app.js";
import { getConfig } from "./lib/config.js";

const cfg = getConfig();

const app = buildApp();

app.listen({ port: cfg.port, host: cfg.host }).catch((err) => {
  console.error(err);
  process.exit(1);
});
