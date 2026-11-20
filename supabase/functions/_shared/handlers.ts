// Game API. Runtime-agnostic: receives a `postgres` (porsager) client, so it runs in Supabase Edge Functions
// (Deno) and in Node tests against a real Postgres.
import {
  BUSINESSES, ROUNDS, START_CASH, ZERO_DECISION, buildFinal, eventEffectFor, eventForRound, explainRound,
  getBusiness, getEvent, initialState, rankTeams, simulateRound, validateDecision,
  type Decision, type ResultRow, type TeamState,
} from "./engine.ts";

// deno-lint-ignore no-explicit-any
type Sql = any;
// deno-lint-ignore no-explicit-any
type Json = any;

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
const fail = (status: number, msg: string): never => {
  throw new HttpError(status, msg);
};

const MAX_TEAMS = 40;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomString(len: number, alphabet: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}
const newToken = () => randomString(40, "abcdefghijklmnopqrstuvwxyz0123456789");

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const normCode = (c: unknown): string => (typeof c === "string" ? c.trim().toUpperCase() : "");
const str = (v: unknown, max = 200): string => (typeof v === "string" ? v.slice(0, max) : "");

// ---------- public views ----------
function gameView(g: Json) {
  const ev = getEvent(g.event_id);
  return {
    id: g.id,
    code: g.code,
    status: g.status,
    round: g.round,
    totalRounds: ROUNDS,
    roundOpenedAt: g.round_opened_at,
    event: ev ? { id: ev.id, name: ev.name, icon: ev.icon, tagline: ev.tagline, description: ev.description } : null,
    final: g.final ?? null,
    version: g.version,
  };
}
function teamView(t: Json) {
  const s = t.state as TeamState;
  return {
    id: t.id, name: t.name, business: t.business, cash: t.cash, netEarnings: t.net_earnings, rank: t.rank,
    prevRank: t.prev_rank, submitted: t.submitted, last: t.last,
    stats: {
      reputation: Math.round(s.reputation), satisfaction: Math.round(s.satisfaction), capacity: Math.floor(s.capacity),
      expLevel: s.expLevel, totalRevenue: s.totalRevenue, totalCustomers: s.totalCustomers, totalInvested: s.totalInvested,
      cumProfit: s.cumProfit,
    },
  };
}

async function loadGame(sql: Sql, code: unknown, lock?: "update" | "share"): Promise<Json> {
  const c = normCode(code);
  if (!/^[A-Z2-9]{6}$/.test(c)) fail(400, "Game codes are 6 characters.");
  const rows = lock === "update"
    ? await sql`select * from games where code = ${c} for update`
    : lock === "share"
    ? await sql`select * from games where code = ${c} for share`
    : await sql`select * from games where code = ${c}`;
  if (!rows.length) fail(404, "No game found with that code.");
  return rows[0];
}

async function requireAdmin(sql: Sql, gameId: string, token: unknown) {
  const t = str(token, 100);
  const rows = await sql`select admin_token_hash from game_secrets where game_id = ${gameId}`;
  if (!t || !rows.length || !safeEqual(rows[0].admin_token_hash, await sha256(t))) fail(403, "Invalid teacher token.");
}

async function requireTeam(sql: Sql, gameId: string, teamId: unknown, token: unknown, lock = false): Promise<Json> {
  const id = str(teamId, 64);
  const t = str(token, 100);
  if (!/^[0-9a-f-]{36}$/.test(id) || !t) fail(403, "Invalid team token.");
  const rows = lock
    ? await sql`select t.*, s.token_hash from teams t join team_secrets s on s.team_id = t.id where t.id = ${id} and t.game_id = ${gameId} for update of t`
    : await sql`select t.*, s.token_hash from teams t join team_secrets s on s.team_id = t.id where t.id = ${id} and t.game_id = ${gameId}`;
  if (!rows.length || !safeEqual(rows[0].token_hash, await sha256(t))) fail(403, "Invalid team token.");
  return rows[0];
}

// ---------- actions ----------
async function create(sql: Sql) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomString(6, CODE_ALPHABET);
    const seed = randomString(16, "abcdefghijklmnopqrstuvwxyz0123456789");
    const adminToken = newToken();
    try {
      await sql.begin(async (tx: Sql) => {
        const [g] = await tx`insert into games (code, seed) values (${code}, ${seed}) returning id`;
        await tx`insert into game_secrets (game_id, admin_token_hash) values (${g.id}, ${await sha256(adminToken)})`;
      });
      return { code, adminToken };
    } catch (e) {
      if ((e as { code?: string }).code !== "23505") throw e; // retry only on duplicate code
    }
  }
  return fail(500, "Could not create a game. Try again.");
}

async function state(sql: Sql, body: Json) {
  const g = await loadGame(sql, body.code);
  const teams = await sql`select * from teams where game_id = ${g.id} order by created_at, name`;
  return { game: gameView(g), teams: teams.map(teamView), serverTime: Date.now() };
}

async function join(sql: Sql, body: Json) {
  const name = str(body.teamName, 60).trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 24) fail(400, "Team name must be 2-24 characters.");
  if (!/^[\p{L}\p{N} .,'&!_-]+$/u.test(name)) fail(400, "Team name has unsupported characters.");
  const biz = getBusiness(str(body.business, 30));
  if (!biz) fail(400, "Choose one of the ten businesses.");
  const g = await loadGame(sql, body.code);
  return await sql.begin(async (tx: Sql) => {
    const [locked] = await tx`select * from games where id = ${g.id} for share`;
    if (!(locked.status === "lobby" || (locked.status === "open" && locked.round === 1))) {
      fail(409, "This game has already started. Ask your teacher.");
    }
    const [{ n }] = await tx`select count(*)::int as n from teams where game_id = ${g.id}`;
    if (n >= MAX_TEAMS) fail(409, "This game is full.");
    const token = newToken();
    let team: Json;
    try {
      const st = initialState(biz!);
      [team] = await tx`insert into teams (game_id, name, business, state, cash, rank, prev_rank)
        values (${g.id}, ${name}, ${biz!.id}, ${tx.json(st)}, ${START_CASH}, ${n + 1}, ${n + 1}) returning id`;
    } catch (e) {
      if ((e as { code?: string }).code === "23505") fail(409, "That team name is already taken.");
      throw e;
    }
    await tx`insert into team_secrets (team_id, token_hash) values (${team.id}, ${await sha256(token)})`;
    return { teamId: team.id, teamToken: token, code: g.code };
  });
}

async function me(sql: Sql, body: Json) {
  const g = await loadGame(sql, body.code);
  const t = await requireTeam(sql, g.id, body.teamId, body.teamToken);
  const results = await sql`select round, event_id, submitted, decision, start_cash, result, explanation, rank
    from round_results where team_id = ${t.id} order by round`;
  let decision: Decision | null = null;
  if (g.status === "open") {
    const [sub] = await sql`select decision from submissions where team_id = ${t.id} and round = ${g.round}`;
    decision = sub?.decision ?? null;
  }
  const ev = getEvent(g.event_id);
  const biz = getBusiness(t.business)!;
  return {
    team: teamView(t),
    results: results.map((r: Json) => ({
      round: r.round, eventId: r.event_id, submitted: r.submitted, decision: r.decision, startCash: r.start_cash,
      result: r.result, explanation: r.explanation, rank: r.rank,
    })),
    decision,
    eventForYou: ev && g.status === "open" ? eventEffectFor(ev, biz.tags) : null,
  };
}

async function submit(sql: Sql, body: Json) {
  const g0 = await loadGame(sql, body.code);
  return await sql.begin(async (tx: Sql) => {
    // Share lock: serialises with round resolution, which takes FOR UPDATE on the game row.
    const [g] = await tx`select * from games where id = ${g0.id} for share`;
    if (g.status !== "open") fail(409, "This round is closed. Wait for the results.");
    const t = await requireTeam(tx, g.id, body.teamId, body.teamToken, true);
    const v = validateDecision(body.decision, t.cash);
    if (!v.ok) fail(400, v.error);
    const decision = (v as { ok: true; decision: Decision }).decision;
    await tx`insert into submissions (game_id, team_id, round, decision) values (${g.id}, ${t.id}, ${g.round}, ${tx.json(decision)})
      on conflict (team_id, round) do update set decision = excluded.decision, updated_at = now()`;
    await tx`update teams set submitted = true where id = ${t.id}`;
    return { ok: true, decision, round: g.round };
  });
}

// ---------- round lifecycle (always inside a transaction holding FOR UPDATE on the game row) ----------
async function openRound(tx: Sql, g: Json, round: number) {
  const ev = eventForRound(g.seed, round);
  await tx`update teams set submitted = false where game_id = ${g.id}`;
  await tx`update games set status = 'open', round = ${round}, event_id = ${ev.id}, round_opened_at = now(), version = version + 1 where id = ${g.id}`;
}

async function resolveRound(tx: Sql, g: Json) {
  const round = g.round as number;
  const event = getEvent(g.event_id) ?? eventForRound(g.seed, round);
  const teams = await tx`select * from teams where game_id = ${g.id} order by created_at, id for update`;
  const subs = await tx`select team_id, decision from submissions where game_id = ${g.id} and round = ${round}`;
  const subMap = new Map<string, Decision>(subs.map((s: Json) => [s.team_id, s.decision]));
  const prevRows = round > 1
    ? await tx`select team_id, result from round_results where game_id = ${g.id} and round = ${round - 1}`
    : [];
  const prevMap = new Map<string, Json>(prevRows.map((r: Json) => [r.team_id, r.result]));

  const computed: { team: Json; next: TeamState; resultJson: Json; explanation: Json; decision: Decision; submitted: boolean }[] = [];
  for (const t of teams) {
    const biz = getBusiness(t.business)!;
    const st = t.state as TeamState;
    const sub = subMap.get(t.id);
    // Missing submission = zero investment. Re-validate against cash defensively; invalid => zero.
    let decision: Decision = ZERO_DECISION;
    if (sub) {
      const v = validateDecision(sub, st.cash);
      if (v.ok) decision = v.decision;
    }
    const r = simulateRound(biz, st, decision, event, round, g.seed, t.id);
    const p = prevMap.get(t.id);
    const explanation = explainRound(biz, event, round, st.cash, decision, r, p ? { netChange: p.netChange, customers: p.customers, revenue: p.revenue, opProfit: p.opProfit } : null);
    const { next, ...rest } = r;
    computed.push({ team: t, next, resultJson: { ...rest, eventName: event.name }, explanation, decision, submitted: !!sub });
  }

  // Ranking after this round
  const ranked = rankTeams(computed.map((c) => ({ id: c.team.id as string, name: c.team.name as string, netEarnings: c.next.netEarnings, cash: c.next.cash })));
  const rankOf = new Map<string, number>(ranked.map((t, i) => [t.id, i + 1]));

  for (const c of computed) {
    const t = c.team;
    const rank = rankOf.get(t.id)!;
    const r = c.resultJson;
    // unique (team_id, round) + the FOR UPDATE game lock make double processing impossible
    await tx`insert into round_results (game_id, team_id, round, event_id, submitted, decision, start_cash, result, explanation, rank)
      values (${g.id}, ${t.id}, ${round}, ${event.id}, ${c.submitted}, ${tx.json(c.decision)}, ${(t.state as TeamState).cash},
              ${tx.json(r)}, ${tx.json(c.explanation)}, ${rank})`;
    const last = { round, customers: r.customers, revenue: r.revenue, opex: r.opex, invested: r.invested, eventCost: r.eventCost, opProfit: r.opProfit, netChange: r.netChange };
    await tx`update teams set state = ${tx.json(c.next)}, cash = ${Math.round(c.next.cash)}, net_earnings = ${Math.round(c.next.netEarnings)},
      prev_rank = rank, rank = ${rank}, last = ${tx.json(last)} where id = ${t.id}`;
  }
  await tx`update games set status = 'results', version = version + 1 where id = ${g.id}`;
}

async function finalize(tx: Sql, g: Json) {
  const teams = await tx`select * from teams where game_id = ${g.id}`;
  const rows = await tx`select team_id, round, decision, result, rank from round_results where game_id = ${g.id}`;
  const resultRows: ResultRow[] = rows.map((r: Json) => ({
    teamId: r.team_id, round: r.round, decision: r.decision, customers: r.result.customers, revenue: r.result.revenue,
    opProfit: r.result.opProfit, invested: r.result.invested, eventCost: r.result.eventCost, netChange: r.result.netChange,
    netEarnings: 0, rank: r.rank, marketingCustomers: r.result.marketingCustomers,
  }));
  const fin = buildFinal(
    teams.map((t: Json) => ({
      id: t.id, name: t.name, business: t.business, cash: t.cash, netEarnings: t.net_earnings,
      totalRevenue: t.state.totalRevenue, totalCustomers: t.state.totalCustomers, totalInvested: t.state.totalInvested, cumProfit: Math.round(t.state.cumProfit),
    })),
    resultRows,
  );
  await tx`update games set status = 'finished', final = ${tx.json(fin)}, version = version + 1 where id = ${g.id}`;
}

async function admin(sql: Sql, action: string, body: Json) {
  const g0 = await loadGame(sql, body.code);
  await requireAdmin(sql, g0.id, body.adminToken);
  return await sql.begin(async (tx: Sql) => {
    const [g] = await tx`select * from games where id = ${g0.id} for update`;
    switch (action) {
      case "start": {
        if (g.status !== "lobby") return { ok: true, stale: true };
        const [{ n }] = await tx`select count(*)::int as n from teams where game_id = ${g.id}`;
        if (n < 1) fail(409, "At least one team must join before you start.");
        await openRound(tx, g, 1);
        return { ok: true };
      }
      case "advance": {
        const exp = body.expect as { status?: string; round?: number } | undefined;
        if (exp && (exp.status !== g.status || exp.round !== g.round)) return { ok: true, stale: true };
        if (g.status === "open") await resolveRound(tx, g);
        else if (g.status === "results") {
          if (g.round < ROUNDS) await openRound(tx, g, g.round + 1);
          else await finalize(tx, g);
        } else if (g.status === "lobby") fail(409, "Start the game first.");
        else return { ok: true, stale: true };
        return { ok: true };
      }
      case "end": {
        if (g.status === "finished") return { ok: true, stale: true };
        if (g.status === "lobby") fail(409, "The game has not started yet.");
        await finalize(tx, g);
        return { ok: true };
      }
      case "reset": {
        await tx`delete from round_results where game_id = ${g.id}`;
        await tx`delete from submissions where game_id = ${g.id}`;
        const teams = await tx`select id, business from teams where game_id = ${g.id} order by created_at, id`;
        let i = 1;
        for (const t of teams) {
          await tx`update teams set state = ${tx.json(initialState(getBusiness(t.business)!))}, cash = ${START_CASH}, net_earnings = 0,
            rank = ${i}, prev_rank = ${i}, submitted = false, last = null where id = ${t.id}`;
          i++;
        }
        const seed = randomString(16, "abcdefghijklmnopqrstuvwxyz0123456789");
        await tx`update games set status = 'lobby', round = 0, seed = ${seed}, event_id = null, round_opened_at = null, final = null, version = version + 1 where id = ${g.id}`;
        return { ok: true };
      }
      case "kick": {
        if (g.status !== "lobby") fail(409, "Teams can only be removed before the game starts.");
        await tx`delete from teams where id = ${str(body.teamId, 64)} and game_id = ${g.id}`;
        await tx`update games set version = version + 1 where id = ${g.id}`;
        return { ok: true };
      }
      default:
        return fail(400, "Unknown action");
    }
  });
}

export async function handle(sql: Sql, body: Json): Promise<{ status: number; body: Json }> {
  try {
    if (!body || typeof body !== "object") fail(400, "Invalid request");
    const action = str(body.action, 30);
    let out: Json;
    switch (action) {
      case "create": out = await create(sql); break;
      case "state": out = await state(sql, body); break;
      case "join": out = await join(sql, body); break;
      case "me": out = await me(sql, body); break;
      case "submit": out = await submit(sql, body); break;
      case "start": case "advance": case "end": case "reset": case "kick":
        out = await admin(sql, action, body); break;
      case "catalog": out = { businesses: BUSINESSES.map((b) => ({ id: b.id, name: b.name })) }; break;
      default: fail(400, "Unknown action");
    }
    return { status: 200, body: out };
  } catch (e) {
    if (e instanceof HttpError) return { status: e.status, body: { error: e.message } };
    console.error(e);
    return { status: 500, body: { error: "Server error. Please try again." } };
  }
}
