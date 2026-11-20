// Local stand-in for the Supabase Edge Function (same handlers) so the app runs without Supabase.
//   PGHOST=/tmp PGPORT=54329 PGUSER=postgres PGDATABASE=pixel npx tsx scripts/dev-server.ts
import { createServer } from "node:http";
import postgres from "postgres";
import { handle } from "../supabase/functions/_shared/handlers";

const sql = postgres(process.env.DATABASE_URL ?? {
  host: process.env.PGHOST ?? "/tmp", port: Number(process.env.PGPORT ?? 54329), user: process.env.PGUSER ?? "postgres",
  database: process.env.PGDATABASE ?? "pixel", max: 5, onnotice: () => {},
} as never);

createServer(async (req, res) => {
  if (req.method !== "POST" || !req.url?.startsWith("/api/game")) { res.writeHead(404).end(); return; }
  let raw = "";
  for await (const c of req) raw += c;
  let body: unknown = null;
  try { body = JSON.parse(raw); } catch { /* handled below */ }
  const out = await handle(sql, body);
  res.writeHead(out.status, { "Content-Type": "application/json" }).end(JSON.stringify(out.body));
}).listen(8787, () => console.log("dev api on :8787"));
