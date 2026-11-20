const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "");
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/game` : "/api/game";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T = any>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(ANON ? { apikey: ANON, Authorization: `Bearer ${ANON}` } : {}) },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    throw new ApiError(0, "Can't reach the game server. Check your connection.");
  }
  let data: any = null;
  try { data = await res.json(); } catch { /* ignore */ }
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Server error (${res.status})`);
  return data as T;
}

export const hasRealtime = Boolean(SUPABASE_URL && ANON);
export const supabaseConfig = { url: SUPABASE_URL, anon: ANON };
