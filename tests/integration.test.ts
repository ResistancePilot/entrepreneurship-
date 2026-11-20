// Runs the real handlers against a real Postgres (local cluster). Requires PG env, see README.
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { handle } from "../supabase/functions/_shared/handlers";

const sql = postgres({
  host: process.env.PGHOST ?? "/tmp", port: Number(process.env.PGPORT ?? 54329), user: process.env.PGUSER ?? "postgres",
  database: process.env.PGDATABASE ?? "pixel", max: 10, onnotice: () => {},
});
const api = async (body: Record<string, unknown>) => handle(sql, body);
const ok = async (body: Record<string, unknown>) => {
  const r = await api(body);
  if (r.status !== 200) throw new Error(`${body.action} failed: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
};

beforeAll(async () => {
  const h = process.env.PGHOST ?? "/tmp";
  if (!(h.startsWith("/") || h === "localhost" || h === "127.0.0.1")) throw new Error("Refusing to drop schema on a non-local database");
  await sql.unsafe("drop schema public cascade; create schema public;");
  await sql.unsafe("do $$ begin if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; end $$;");
  await sql.unsafe(readFileSync("supabase/migrations/0001_init.sql", "utf8"));
});
afterAll(async () => { await sql.end(); });

const TEAMS = [
  { name: "Slice Kings", business: "pizza" },
  { name: "Bean Team", business: "coffee" },
  { name: "Pixel Forge", business: "videogame" },
  { name: "Paws & Co", business: "pet" },
];
const plans: Record<string, (cash: number, r: number) => Record<string, number>> = {
  "Slice Kings": (c, r) => (r <= 5 ? { marketing: 400, quality: 400, operations: 400, expansion: 400 } : { marketing: 0, quality: 0, operations: 0, expansion: 0 }),
  "Bean Team": (c, r) => ({ marketing: 1500, quality: 0, operations: 0, expansion: 0 }),
  "Pixel Forge": (c) => ({ marketing: Math.floor(c / 4), quality: Math.floor(c / 4), operations: Math.floor(c / 4), expansion: Math.floor(c / 4) }),
  "Paws & Co": () => ({ marketing: 0, quality: 0, operations: 0, expansion: 0 }),
};

describe("full classroom game", () => {
  it("runs 4 teams through 8 rounds with all safeguards", async () => {
    const t0 = Date.now();
    const { code, adminToken } = (await ok({ action: "create" })) as { code: string; adminToken: string };
    expect(code).toMatch(/^[A-Z2-9]{6}$/);

    // invalid codes / tokens
    expect((await api({ action: "state", code: "ZZZZZZ" })).status).toBe(404);
    expect((await api({ action: "state", code: "bad" })).status).toBe(400);
    expect((await api({ action: "start", code, adminToken: "nope" })).status).toBe(403);
    expect((await api({ action: "start", code, adminToken })).status).toBe(409); // no teams yet

    // join
    const joined: Record<string, { teamId: string; teamToken: string }> = {};
    for (const t of TEAMS) joined[t.name] = (await ok({ action: "join", code: code.toLowerCase(), teamName: t.name, business: t.business })) as never;
    expect((await api({ action: "join", code, teamName: "slice kings", business: "arcade" })).status).toBe(409);
    expect((await api({ action: "join", code, teamName: "X", business: "arcade" })).status).toBe(400);
    expect((await api({ action: "join", code, teamName: "Fine Name", business: "bank" })).status).toBe(400);
    expect((await api({ action: "join", code: "ABCDEF", teamName: "Fine Name", business: "arcade" })).status).toBe(404);

    let st = (await ok({ action: "state", code })) as { game: any; teams: any[] };
    expect(st.teams).toHaveLength(4);
    expect(st.teams.every((t) => t.cash === 10000)).toBe(true);
    expect(JSON.stringify(st)).not.toMatch(/token/i);

    // a student cannot use teacher controls
    for (const action of ["start", "advance", "end", "reset"]) {
      expect((await api({ action, code, adminToken: joined["Slice Kings"].teamToken })).status).toBe(403);
    }
    // cannot submit before the game opens
    expect((await api({ action: "submit", code, ...joined["Slice Kings"], decision: plans["Slice Kings"](10000, 1) })).status).toBe(409);

    await ok({ action: "start", code, adminToken });
    expect(((await ok({ action: "start", code, adminToken })) as any).stale).toBe(true); // idempotent
    st = (await ok({ action: "state", code })) as never;
    expect(st.game.status).toBe("open");
    expect(st.game.round).toBe(1);

    for (let round = 1; round <= 8; round++) {
      st = (await ok({ action: "state", code })) as never;
      expect(st.game.status).toBe("open");
      expect(st.game.round).toBe(round);
      expect(st.game.event).toBeTruthy();

      // team auth + validation
      const other = joined["Bean Team"];
      expect((await api({ action: "submit", code, teamId: other.teamId, teamToken: joined["Slice Kings"].teamToken, decision: plans["Bean Team"](10000, round) })).status).toBe(403);
      const cashNow = st.teams.find((t) => t.name === "Pixel Forge").cash;
      const me = joined["Pixel Forge"];
      expect((await api({ action: "submit", code, ...me, decision: { marketing: -5, quality: 0, operations: 0, expansion: 0 } })).status).toBe(400);
      expect((await api({ action: "submit", code, ...me, decision: { marketing: cashNow + 1, quality: 0, operations: 0, expansion: 0 } })).status).toBe(400);
      expect((await api({ action: "submit", code, ...me, decision: { marketing: cashNow, quality: 1, operations: 0, expansion: 0 } })).status).toBe(400);

      for (const t of TEAMS) {
        if (t.name === "Paws & Co" && round === 3) continue; // one team never submits in round 3 => zero investment
        const cash = st.teams.find((x) => x.name === t.name).cash;
        // first submit something else, then edit before closing
        await ok({ action: "submit", code, ...joined[t.name], decision: { marketing: 1, quality: 0, operations: 0, expansion: 0 } });
        const dec = plans[t.name](Math.max(0, cash), round);
        const total = Object.values(dec).reduce((a, b) => a + b, 0);
        if (total <= cash) await ok({ action: "submit", code, ...joined[t.name], decision: dec });
        else await ok({ action: "submit", code, ...joined[t.name], decision: { marketing: 0, quality: 0, operations: 0, expansion: 0 } });
      }
      // "refresh": team can recover their saved decision
      const meState = (await ok({ action: "me", code, ...joined["Slice Kings"] })) as any;
      expect(meState.decision).toBeTruthy();
      st = (await ok({ action: "state", code })) as never;
      expect(st.teams.filter((t) => t.submitted)).toHaveLength(round === 3 ? 3 : 4);

      // double-click / two tabs: concurrent advances must compute once
      const exp = { status: "open", round };
      const rs = await Promise.all([1, 2, 3].map(() => ok({ action: "advance", code, adminToken, expect: exp })));
      expect(rs.filter((r: any) => !r.stale)).toHaveLength(1);
      const [{ n }] = await sql`select count(*)::int n from round_results r join games g on g.id = r.game_id where g.code = ${code} and r.round = ${round}`;
      expect(n).toBe(4);

      // submissions after close are rejected
      expect((await api({ action: "submit", code, ...joined["Slice Kings"], decision: plans["Slice Kings"](10000, 1) })).status).toBe(409);

      st = (await ok({ action: "state", code })) as never;
      expect(st.game.status).toBe("results");
      // cash identity: cash = 10000 + net earnings; ranks are a permutation sorted by net earnings
      for (const t of st.teams) expect(t.cash).toBe(10000 + t.netEarnings);
      const byRank = [...st.teams].sort((a, b) => a.rank - b.rank);
      expect(byRank.map((t) => t.rank)).toEqual([1, 2, 3, 4]);
      for (let i = 1; i < byRank.length; i++) expect(byRank[i - 1].netEarnings).toBeGreaterThanOrEqual(byRank[i].netEarnings);

      const myRes = (await ok({ action: "me", code, ...joined["Paws & Co"] })) as any;
      expect(myRes.results).toHaveLength(round);
      if (round === 3) {
        expect(myRes.results[2].submitted).toBe(false);
        expect(myRes.results[2].result.invested).toBe(0);
      }
      expect(myRes.results[round - 1].explanation.lesson.length).toBeGreaterThan(10);

      if (round < 8) await ok({ action: "advance", code, adminToken, expect: { status: "results", round } });
    }

    // advance after round 8 -> finished
    await ok({ action: "advance", code, adminToken, expect: { status: "results", round: 8 } });
    st = (await ok({ action: "state", code })) as never;
    expect(st.game.status).toBe("finished");
    const fin = st.game.final;
    expect(fin.champion.name).toBe(st.teams.find((t) => t.rank === 1).name);
    expect(fin.rankings).toHaveLength(4);
    expect(fin.achievements.map((a: any) => a.key)).toEqual(expect.arrayContaining(["profit_king", "customer_magnet", "efficiency_expert"]));
    expect(fin.summary.length).toBeGreaterThan(2);
    // investments mattered: different strategies, different outcomes
    const nets = st.teams.map((t) => t.netEarnings);
    expect(new Set(nets).size).toBe(4);
    // reconnect after the game still works
    const again = (await ok({ action: "me", code, ...joined["Bean Team"] })) as any;
    expect(again.results).toHaveLength(8);
    expect((await api({ action: "advance", code, adminToken })).body.stale).toBe(true);
    console.log("full game of 4 teams x 8 rounds completed in", Date.now() - t0, "ms; champion:", fin.champion.name, fin.champion.netEarnings);
    console.log(st.teams.map((t) => `${t.rank}. ${t.name} (${t.business}) net ${t.netEarnings}`).join("\n"));
  });

  it("supports force-end, reset (keep teams) and mid-round join", async () => {
    const { code, adminToken } = (await ok({ action: "create" })) as any;
    const a = (await ok({ action: "join", code, teamName: "Alpha", business: "arcade" })) as any;
    await ok({ action: "start", code, adminToken });
    const late = (await ok({ action: "join", code, teamName: "Latecomer", business: "tech" })) as any; // round 1 still open
    await ok({ action: "submit", code, ...a, decision: { marketing: 500, quality: 0, operations: 0, expansion: 0 } });
    await ok({ action: "advance", code, adminToken }); // force-advance: Latecomer never submitted
    expect(((await api({ action: "join", code, teamName: "TooLate", business: "pizza" })) as any).status).toBe(409);
    const s1 = (await ok({ action: "state", code })) as any;
    expect(s1.teams.find((t: any) => t.name === "Latecomer").last.invested).toBe(0);
    await ok({ action: "end", code, adminToken });
    expect(((await ok({ action: "state", code })) as any).game.status).toBe("finished");
    await ok({ action: "reset", code, adminToken });
    const s2 = (await ok({ action: "state", code })) as any;
    expect(s2.game.status).toBe("lobby");
    expect(s2.teams).toHaveLength(2);
    expect(s2.teams.every((t: any) => t.cash === 10000 && t.netEarnings === 0 && t.last === null)).toBe(true);
    // old tokens still valid after reset
    expect(((await ok({ action: "me", code, ...late })) as any).results).toHaveLength(0);
    await ok({ action: "kick", code, adminToken, teamId: late.teamId });
    expect(((await ok({ action: "state", code })) as any).teams).toHaveLength(1);
  });
});
