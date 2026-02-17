#!/usr/bin/env -S npx tsx
/**
 * Ingest latest conversation from openclawd session -> conversations/current.jsonl
 * Incremental: tail-only read, cursor cache, configurable limits.
 * Does NOT overwrite current.jsonl on failure.
 */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  statSync,
  openSync,
  readSync,
  closeSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const OPENCLAW_HOME = process.env.OPENCLAW_HOME ?? resolve(homedir(), ".openclaw");
const SESSIONS_DIR = resolve(OPENCLAW_HOME, "agents", "main", "sessions");
const SESSIONS_JSON = resolve(SESSIONS_DIR, "sessions.json");
const CURSOR_PATH = resolve(ROOT, "runtime", ".ingest_cursor.json");
const METRICS_PATH = resolve(ROOT, "out", "ingest_metrics.json");

const MAX_FILES = parseInt(process.env.OC_INGEST_MAX_FILES || "3", 10) || 3;
const TAIL_LINES = parseInt(process.env.OC_INGEST_TAIL_LINES || "400", 10) || 400;
const MAX_EXPAND = parseInt(process.env.OC_INGEST_MAX_EXPAND || "2", 10) || 2;
const MAX_BYTES_TAIL = Math.min(TAIL_LINES * 1024, 512 * 1024);

const PROBED_PATHS = [OPENCLAW_HOME, SESSIONS_DIR, SESSIONS_JSON];

type SessionEntry = { sessionId?: string; updatedAt?: number };
type MessageEvent = {
  type?: string;
  message?: { role?: string; content?: Array<{ type?: string; text?: string }> };
  timestamp?: string;
  id?: string;
};
type Cursor = { sessionFile: string; last_mtime: number; last_message_id?: string };

function extractText(msg: MessageEvent["message"]): string {
  if (!msg?.content || !Array.isArray(msg.content)) return "";
  const first = msg.content[0];
  return (first && typeof first === "object" && "text" in first && first.text) || "";
}

function readTail(path: string, maxLines: number): { lines: string[]; bytesRead: number } {
  const stat = statSync(path);
  const toRead = Math.min(stat.size, MAX_BYTES_TAIL);
  if (toRead <= 0) return { lines: [], bytesRead: 0 };
  const fd = openSync(path, "r");
  const buf = Buffer.alloc(toRead);
  readSync(fd, buf, 0, toRead, stat.size - toRead);
  closeSync(fd);
  const text = buf.toString("utf-8");
  const all = text.split("\n").filter((l) => l.length > 0);
  const lines = all.slice(-maxLines);
  return { lines, bytesRead: toRead };
}

function getRecentSessionFiles(k: number): Array<{ name: string; mtime: number }> {
  const entries = readdirSync(SESSIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".jsonl") && !d.name.includes(".deleted"))
    .map((d) => {
      const p = resolve(SESSIONS_DIR, d.name);
      const stat = statSync(p);
      return { name: d.name, mtime: stat.mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  return entries.slice(0, k);
}

function loadCursor(): Cursor | null {
  if (!existsSync(CURSOR_PATH)) return null;
  try {
    const raw = JSON.parse(readFileSync(CURSOR_PATH, "utf-8")) as Cursor;
    if (raw?.sessionFile && typeof raw.last_mtime === "number") return raw;
  } catch {
    /* ignore */
  }
  return null;
}

function saveCursor(cursor: Cursor) {
  mkdirSync(dirname(CURSOR_PATH), { recursive: true });
  writeFileSync(CURSOR_PATH, JSON.stringify(cursor, null, 2), "utf-8");
}

function parseLinesToMessages(
  lines: string[],
  maxMessages: number
): Array<{ role: string; content: string; ts?: string; message_id?: string }> {
  const out: Array<{ role: string; content: string; ts?: string; message_id?: string }> = [];
  const ALLOWED_ROLES = new Set(["user", "assistant", "system"]);
  for (let i = lines.length - 1; i >= 0 && out.length < maxMessages; i--) {
    try {
      const ev = JSON.parse(lines[i]) as MessageEvent;
      if (ev.type !== "message" || !ev.message?.role) continue;
      let role = ev.message.role;
      if (!ALLOWED_ROLES.has(role)) role = "assistant";
      const text = extractText(ev.message);
      if (!text.trim()) continue;
      out.unshift({
        role,
        content: text,
        ts: ev.timestamp,
        message_id: ev.id,
      });
    } catch {
      /* skip */
    }
  }
  return out;
}

function main() {
  const t0 = Date.now();
  const metrics: Record<string, number | string> = {
    scanned_files_count: 0,
    read_lines_count: 0,
    read_bytes_count: 0,
    candidate_messages_count: 0,
    ingest_runtime_ms: 0,
    strategy_used: "recent_files",
  };

  const attempted = PROBED_PATHS.join(", ");
  if (!existsSync(OPENCLAW_HOME)) {
    console.error("ingest_openclawd FAIL: OPENCLAW_HOME not found");
    console.error("Attempted paths:", attempted);
    process.exit(1);
  }
  if (!existsSync(SESSIONS_DIR)) {
    console.error("ingest_openclawd FAIL: sessions dir not found");
    console.error("Attempted paths:", attempted);
    process.exit(1);
  }
  if (!existsSync(SESSIONS_JSON)) {
    console.error("ingest_openclawd FAIL: sessions.json not found");
    console.error("Attempted paths:", attempted);
    process.exit(1);
  }

  const recent = getRecentSessionFiles(MAX_FILES);
  metrics.scanned_files_count = recent.length;
  if (recent.length === 0) {
    console.error("ingest_openclawd FAIL: no session files in", SESSIONS_DIR);
    process.exit(1);
  }

  const cursor = loadCursor();
  let fileOrder = recent.map((r) => r.name);
  if (cursor && fileOrder.includes(cursor.sessionFile)) {
    fileOrder = [cursor.sessionFile, ...fileOrder.filter((n) => n !== cursor.sessionFile)];
    metrics.strategy_used = "cursor";
  }

  let messages: Array<{ role: string; content: string; ts?: string; message_id?: string }> = [];
  let totalLines = 0;
  let totalBytes = 0;
  let n = TAIL_LINES;
  let expandCount = 0;
  let usedFile = "";

  for (const fname of fileOrder) {
    const path = resolve(SESSIONS_DIR, fname);
    if (!existsSync(path)) continue;
    const { lines, bytesRead } = readTail(path, n);
    totalLines += lines.length;
    totalBytes += bytesRead;
    messages = parseLinesToMessages(lines, 20);
    if (messages.length > 0) {
      usedFile = fname;
      break;
    }
  }

  while (messages.length === 0 && expandCount < MAX_EXPAND) {
    expandCount++;
    metrics.strategy_used = "fallback_expand";
    n = Math.min(n * 2, 2000);
    for (const fname of fileOrder) {
      const path = resolve(SESSIONS_DIR, fname);
      if (!existsSync(path)) continue;
      const { lines } = readTail(path, n);
      totalLines += lines.length;
      messages = parseLinesToMessages(lines, 20);
      if (messages.length > 0) {
        usedFile = fname;
        break;
      }
    }
  }

  metrics.read_lines_count = totalLines;
  metrics.read_bytes_count = totalBytes;
  metrics.candidate_messages_count = messages.length;

  if (messages.length === 0) {
    const firstPath = resolve(SESSIONS_DIR, fileOrder[0]);
    if (existsSync(firstPath)) {
      const { lines } = readTail(firstPath, 10);
      mkdirSync(resolve(ROOT, "out"), { recursive: true });
      writeFileSync(
        resolve(ROOT, "out", "ingest_debug.json"),
        JSON.stringify(
          { sessionFile: fileOrder[0], raw_tail: lines.slice(-3), hint: "log format may have changed" },
          null,
          2
        ),
        "utf-8"
      );
    }
    console.error("ingest_openclawd FAIL: no parseable messages; see out/ingest_debug.json");
    metrics.ingest_runtime_ms = Date.now() - t0;
    mkdirSync(resolve(ROOT, "out"), { recursive: true });
    writeFileSync(METRICS_PATH, JSON.stringify(metrics, null, 2), "utf-8");
    process.exit(1);
  }

  const lastUser = messages.filter((m) => m.role === "user").pop();
  const lastMsgId = lastUser?.message_id;
  const sessionFile = usedFile || fileOrder[0];
  const stat = statSync(resolve(SESSIONS_DIR, sessionFile));
  saveCursor({
    sessionFile,
    last_mtime: stat.mtimeMs,
    last_message_id: lastMsgId,
  });

  const convDir = resolve(ROOT, "conversations");
  mkdirSync(convDir, { recursive: true });
  const outPath = resolve(convDir, "current.jsonl");
  const lines = messages.map((m) =>
    JSON.stringify({
      role: m.role,
      content: m.content,
      ...(m.ts && { ts: m.ts }),
      ...(m.message_id && { message_id: m.message_id }),
    })
  );
  writeFileSync(outPath, lines.join("\n") + "\n", "utf-8");

  metrics.ingest_runtime_ms = Date.now() - t0;
  mkdirSync(resolve(ROOT, "out"), { recursive: true });
  writeFileSync(METRICS_PATH, JSON.stringify(metrics, null, 2), "utf-8");

  console.log("ingest_openclawd OK -> conversations/current.jsonl", `(${messages.length} messages)`);
}

main();
