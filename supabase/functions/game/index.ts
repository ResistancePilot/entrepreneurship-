// Supabase Edge Function: the only writer of game data. Deploy with: supabase functions deploy game --no-verify-jwt
import postgres from "npm:postgres@3.4.4";
import { handle } from "../_shared/handlers.ts";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { max: 3, prepare: false, idle_timeout: 20 });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
  const out = await handle(sql, body);
  return new Response(JSON.stringify(out.body), { status: out.status, headers: { ...cors, "Content-Type": "application/json" } });
});
