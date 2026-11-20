import { useCallback, useEffect, useRef, useState } from "react";
import { api, supabaseConfig } from "./api";
import type { MeResponse, StateResponse } from "./types";

let client: any = null;
async function getClient() {
  if (!supabaseConfig.url || !supabaseConfig.anon) return null;
  if (!client) {
    const { createClient } = await import("@supabase/supabase-js");
    client = createClient(supabaseConfig.url, supabaseConfig.anon, { auth: { persistSession: false } });
  }
  return client;
}

/** Live game snapshot: Supabase Realtime triggers instant refetches; light polling is the safety net. */
export function useGame(code: string) {
  const [data, setData] = useState<StateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [skew, setSkew] = useState(0);
  const seq = useRef(0);
  const timer = useRef<number | undefined>();

  const refetch = useCallback(async () => {
    const my = ++seq.current;
    try {
      const d = await api<StateResponse>("state", { code });
      if (my === seq.current) { setData(d); setSkew(d.serverTime - Date.now()); setError(null); setOffline(false); }
    } catch (e: any) {
      if (e?.status === 404 || e?.status === 400) setError(e.message);
      else setOffline(true);
    }
  }, [code]);
  const soon = useCallback(() => { window.clearTimeout(timer.current); timer.current = window.setTimeout(refetch, 120); }, [refetch]);

  useEffect(() => { refetch(); const i = window.setInterval(refetch, 3500); return () => window.clearInterval(i); }, [refetch]);
  useEffect(() => {
    const onVis = () => { if (!document.hidden) refetch(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", refetch);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("online", refetch); };
  }, [refetch]);

  const gameId = data?.game.id;
  useEffect(() => {
    if (!gameId) return;
    let ch: any; let dead = false;
    getClient().then((c) => {
      if (!c || dead) return;
      ch = c.channel(`pe-${gameId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, soon)
        .on("postgres_changes", { event: "*", schema: "public", table: "teams", filter: `game_id=eq.${gameId}` }, soon)
        .subscribe();
    });
    return () => { dead = true; if (ch && client) client.removeChannel(ch); };
  }, [gameId, soon]);

  return { data, error, offline, refetch, skew };
}

/** The signed-in team's private view (own results + saved decision). */
export function useMe(code: string, session: { teamId: string; teamToken: string } | null, trigger: string) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const refetch = useCallback(async () => {
    if (!session) return;
    const my = ++seq.current;
    try {
      const d = await api<MeResponse>("me", { code, ...session });
      if (my === seq.current) { setMe(d); setError(null); }
    } catch (e: any) {
      if (e?.status === 403) setError("invalid");
    }
  }, [code, session]);
  useEffect(() => { refetch(); }, [refetch, trigger]);
  return { me, error, refetch };
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = window.setInterval(() => setNow(Date.now()), ms); return () => window.clearInterval(i); }, [ms]);
  return now;
}
