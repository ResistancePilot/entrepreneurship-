# PIXEL EMPIRE

A 20-minute, teacher-controlled multiplayer business simulation. Teams pick one of ten businesses, allocate cash to
Marketing / Quality / Operations / Expansion for eight "months", and compete on cumulative **Net Earnings**.
React + TypeScript + Tailwind frontend, Supabase (Postgres + Realtime + one Edge Function) backend. No student accounts.

## How it works

| Piece | Where |
|---|---|
| Simulation engine (deterministic, seeded, pure TS) | `supabase/functions/_shared/engine.ts` |
| Game API (create / join / submit / advance / end / reset) | `supabase/functions/_shared/handlers.ts` |
| Edge Function entry point | `supabase/functions/game/index.ts` |
| Database schema + RLS + Realtime | `supabase/migrations/0001_init.sql` |
| Student `/`, `/play/:code` · Teacher `/teacher`, `/host/:code` · Projector `/display/:code` | `src/pages/*` |

**Security model.** The browser never writes to the database and never calculates money. All writes go through the `game`
Edge Function, which connects straight to Postgres and checks tokens itself. Teacher key and team tokens are stored only as
SHA-256 hashes in tables with RLS enabled and *no* policies (unreadable by the anon key). Private round decisions live in
`submissions` (also unreadable) and become public only inside `round_results` after the round closes. The anon key can only
`SELECT` `games`, `teams`, `round_results` (needed for Realtime), none of which contain secrets.

**Reliability.** Each round is resolved inside one DB transaction holding `SELECT … FOR UPDATE` on the game row, with
`unique(team_id, round)` on results, so a round can never be calculated twice (double-clicks, two teacher tabs, retries are
harmless: the second call returns `stale`). Submissions take a `FOR SHARE` lock on the same row, so nothing can sneak in
after the close. Missing submissions = $0 invested. Teams reconnect via a token in `localStorage`. The UI uses Realtime
to refetch instantly and also polls every 3.5 s, so a dropped websocket never desynchronises a classroom.

**Scoring.** `Net Earnings = Σ(operating profit − event costs) − Σ(all investment spending)` = `ending cash − $10,000`.
Investments are cash outflows only, never counted again as operating expenses.

## Setup

### 1. Supabase
1. Create a project at supabase.com (free tier is fine).
2. Run the schema: SQL Editor → paste `supabase/migrations/0001_init.sql` → Run (or `supabase db push`).
3. Deploy the function (Supabase CLI):
   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy game --no-verify-jwt
   ```
   `SUPABASE_DB_URL` is injected automatically into Edge Functions, so no secrets need to be set. (`supabase/config.toml`
   already sets `verify_jwt = false`; the function does its own token checks.)
4. Realtime: the migration adds `games`, `teams`, `round_results` to the `supabase_realtime` publication. Confirm under
   Database → Replication if you ever see no live updates (the app still works by polling).

### 2. Frontend (Lovable or anywhere)
- **Lovable:** connect this GitHub repo, connect your Supabase project; Lovable provides `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY`. Publish.
- **Manual:** copy `.env.example` to `.env`, fill both values, `npm install && npm run build`, host `dist/` on any static host
  with a SPA fallback to `index.html` (Netlify/Vercel/Cloudflare Pages all do this by default).

### 3. Run a class
1. Teacher opens `/teacher` → **Create Game** → project `/display/CODE` on the big screen (keys: `L` leaderboard, `C` city, `F` fullscreen).
2. Students open the site, enter the code, a team name and a business.
3. Teacher: **Start Game** → each month: students allocate cash → **Close Month & Calculate** → **Open Month N+1**.
   After month 8, **Reveal Champion**. Suggested pace: ~1.5 min deciding + ~0.5 min reviewing results = ~20 min.
4. The teacher key is saved in the teacher's browser. Use "Show" on the host page to copy it for another device.

## Local development & tests
```bash
npm install
npm test                 # engine unit tests + full multi-team integration test (needs local Postgres, see below)
npm run build            # type-check + production build
```
Integration tests and the local dev API need any Postgres (no Supabase required):
```bash
# example with a throwaway cluster
initdb -D /tmp/pgdata -A trust && pg_ctl -D /tmp/pgdata -o "-p 54329 -k /tmp" start && createdb -h /tmp -p 54329 pixel
export PGHOST=/tmp PGPORT=54329 PGUSER=postgres PGDATABASE=pixel
npm test                 # runs tests/engine.test.ts + tests/integration.test.ts
npm run dev:api &        # local stand-in for the Edge Function on :8787 (same handler code)
npm run dev              # app on :5173 (proxies /api to the dev API; no Supabase env vars needed)
npx tsx scripts/balance.ts      # prints net earnings per business × strategy (balance check)
node scripts/e2e.cjs            # Playwright: teacher + 4 students + projector, 8 rounds, reload mid-game
```

## Balance notes
All ten businesses earn ~$2–3k/month at baseline, differ in demand / price / costs / growth / event exposure, and respond
differently to each investment type (e.g. Clothing: marketing ×1.3, Pet: quality ×1.35, Tech: expansion ×1.25). Every
investment has diminishing returns (`1 − e^(−spend/k)`), expansion is delayed one month and damped when stacked, and late
spending cannot pay back, so spending all cash every month scores far below moderate, front-loaded investing
(see `scripts/balance.ts` and `tests/engine.test.ts`).
