import { buildApp } from "./app.js";
import { getConfig } from "./lib/config.js";

const cfg = getConfig();

const app = buildApp();

async function start() {
  try {
    await app.listen({ port: cfg.port, host: cfg.host });
    console.log(`server listening on http://${cfg.host}:${cfg.port}`);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    // Default behavior: if 3000 occupied and PORT not explicitly set, fallback to 3001.
    if (e?.code === "EADDRINUSE" && cfg.port === 3000 && !process.env.PORT) {
      const fallback = 3001;
      console.error(`port 3000 is in use, fallback to ${fallback}`);
      try {
        await app.listen({ port: fallback, host: cfg.host });
        console.log(`server listening on http://${cfg.host}:${fallback}`);
        return;
      } catch (e2) {
        console.error("fallback port 3001 also unavailable");
        console.error(e2);
      }
    } else if (e?.code === "EADDRINUSE") {
      console.error(`port ${cfg.port} is in use. try: PORT=${cfg.port + 1} npm run dev`);
    }
    console.error(err);
    process.exit(1);
  }
}

void start();
