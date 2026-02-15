import { AppError } from "./errors.js";

export type AppConfig = {
  host: string;
  port: number;
  dbFile: string;
};

function parsePort(v: string | undefined): number {
  if (!v || v.trim() === "") return 3000;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new AppError("BAD_REQUEST", 400, "invalid PORT");
  }
  return n;
}

function parseHost(v: string | undefined): string {
  const h = (v ?? "").trim();
  return h === "" ? "127.0.0.1" : h;
}

function parseDbFile(v: string | undefined): string {
  const f = (v ?? "").trim();
  return f === "" ? "app.sqlite" : f;
}

export function getConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    host: parseHost(env.HOST),
    port: parsePort(env.PORT),
    dbFile: parseDbFile(env.DB_FILE)
  };
}
