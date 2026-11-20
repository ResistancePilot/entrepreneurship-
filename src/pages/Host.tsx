import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { bizInfo } from "../lib/catalog";
import { mmss } from "../lib/format";
import { loadAdmin, saveAdmin } from "../lib/storage";
import { useGame, useNow } from "../lib/hooks";
import { BizIcon, CityBackground, Logo } from "../components/art";
import { ChampionScreen, EventBanner, Label, Panel, SimpleLeaderboard } from "../components/ui";

export default function Host() {
  const code = (useParams().code ?? "").toUpperCase();
  const [token, setToken] = useState(() => loadAdmin(code));
  const [tokenInput, setTokenInput] = useState("");
  const { data, error, offline, refetch, skew } = useGame(code);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [reveal, setReveal] = useState(false);
  const now = useNow(1000) + skew;

  if (!token) {
    return (
      <Wrap stage={1}>
        <Panel className="max-w-md mx-auto">
          <div className="font-pixel text-sm text-gold mb-3">TEACHER KEY REQUIRED</div>
          <input className="px-input" type="password" placeholder="Teacher key" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} />
          <button className="px-btn mt-4" onClick={() => { saveAdmin(code, tokenInput.trim()); setToken(tokenInput.trim()); }}>UNLOCK</button>
          <div className="mt-4"><Link to="/teacher" className="font-pixel text-[10px] text-sky underline">◀ BACK</Link></div>
        </Panel>
      </Wrap>
    );
  }
  if (error) return <Wrap stage={0}><Panel className="max-w-md mx-auto text-center"><div className="font-pixel text-sm text-ruby">{error}</div><Link to="/teacher" className="px-btn mt-4 inline-block">BACK</Link></Panel></Wrap>;
  if (!data) return <Wrap stage={0}><div className="font-pixel text-center text-sm anim-blink mt-20">LOADING...</div></Wrap>;

  const { game, teams } = data;
  const submitted = teams.filter((t) => t.submitted).length;
  const origin = window.location.origin;
  const joinUrl = origin;
  const displayUrl = `${origin}/display/${code}`;
  const elapsed = game.roundOpenedAt ? now - new Date(game.roundOpenedAt).getTime() : 0;

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true); setErr("");
    try { await api(action, { code, adminToken: token, ...extra }); await refetch(); }
    catch (e: any) { setErr(e.message); if (/token/i.test(e.message)) setToken(null); }
    finally { setBusy(false); }
  };
  const expect = { status: game.status, round: game.round };

  let primary: React.ReactNode = null;
  if (game.status === "lobby") primary = <button className="px-btn px-btn-green" disabled={busy || teams.length < 1} onClick={() => act("start")}>▶ START GAME</button>;
  else if (game.status === "open") primary = <button className="px-btn px-btn-red" disabled={busy} onClick={() => {
    if (submitted < teams.length && !window.confirm(`${teams.length - submitted} team(s) have not submitted. They will invest $0 this month. Close the month now?`)) return;
    act("advance", { expect });
  }}>■ CLOSE MONTH & CALCULATE ({submitted}/{teams.length})</button>;
  else if (game.status === "results") primary = <button className="px-btn px-btn-green" disabled={busy} onClick={() => act("advance", { expect })}>{game.round < game.totalRounds ? `▶ OPEN MONTH ${game.round + 1}` : "★ REVEAL CHAMPION"}</button>;
  else primary = <button className="px-btn px-btn-blue" disabled={busy} onClick={() => window.confirm("Reset this game back to the lobby? All results are erased; teams stay joined.") && act("reset")}>↺ PLAY AGAIN (RESET)</button>;

  return (
    <Wrap stage={game.round}>
      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-5">
        <div className="space-y-5">
          <Panel className="text-center">
            <Label>Students join with code</Label>
            <div className="font-pixel text-5xl md:text-6xl text-gold tracking-[.2em] my-4 text-shadow-px select-all" aria-label="join code">{code}</div>
            <div className="text-xl text-white/70">Students open <span className="text-sky">{joinUrl.replace(/^https?:\/\//, "")}</span></div>
            <div className="flex flex-wrap gap-3 justify-center mt-4">
              <a href={displayUrl} target="_blank" rel="noreferrer" className="px-btn px-btn-blue px-btn-sm">📽 OPEN PROJECTOR DISPLAY</a>
              <button className="px-btn px-btn-ghost px-btn-sm" onClick={() => navigator.clipboard?.writeText(displayUrl)}>COPY DISPLAY LINK</button>
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div><Label>Game status</Label>
                <div className="font-pixel text-sm mt-2 text-gold">{game.status === "lobby" ? "LOBBY" : game.status === "finished" ? "FINISHED" : `MONTH ${game.round}/${game.totalRounds} · ${game.status === "open" ? "OPEN" : "RESULTS"}`}</div></div>
              {game.status === "open" && <div className="text-right"><Label>Elapsed</Label><div className="font-pixel text-sm mt-2">{mmss(elapsed)}</div></div>}
              <div className="text-right"><Label>Teams connected</Label><div className="font-pixel text-sm mt-2">{teams.length}</div></div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">{primary}</div>
            <div className="mt-5 flex flex-wrap gap-3">
              {(game.status === "open" || game.status === "results") && <button className="px-btn px-btn-ghost px-btn-sm" disabled={busy} onClick={() => window.confirm("End the game now and show the champion?") && act("end")}>END GAME NOW</button>}
              {game.status !== "finished" && game.status !== "lobby" && <button className="px-btn px-btn-ghost px-btn-sm" disabled={busy} onClick={() => window.confirm("Reset to the lobby and erase all results?") && act("reset")}>RESET</button>}
            </div>
            {game.status === "open" && <div className="text-lg text-white/60 mt-3">Slow teams can't block you: close the month any time. Missing submissions count as $0 invested.</div>}
            {offline && <div className="text-ruby text-xl mt-3">Connection hiccup, retrying…</div>}
            {err && <div className="text-ruby text-2xl mt-3" role="alert">⚠ {err}</div>}
          </Panel>

          <Panel variant="dark">
            <Label>Teacher key (keep private)</Label>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <code className="text-xl break-all">{reveal ? token : "•••••••••••••••••"}</code>
              <button className="px-btn px-btn-ghost px-btn-sm" onClick={() => setReveal(!reveal)}>{reveal ? "HIDE" : "SHOW"}</button>
              {reveal && <button className="px-btn px-btn-ghost px-btn-sm" onClick={() => navigator.clipboard?.writeText(token)}>COPY</button>}
            </div>
            <div className="text-lg text-white/50 mt-2">Needed to resume on another device. Never shown on the projector or to students.</div>
          </Panel>
        </div>

        <div className="space-y-5">
          {game.event && game.status !== "lobby" && <EventBanner event={game.event} compact />}
          {game.status === "finished" && game.final ? <ChampionScreen final={game.final} /> : (
            <>
              <Panel>
                <Label>{game.status === "lobby" ? "Teams" : "Live leaderboard (Net Earnings)"}</Label>
                <div className="mt-3">
                  {teams.length === 0 && <div className="text-2xl text-white/60">Waiting for teams to join…</div>}
                  {game.status === "lobby"
                    ? <div className="space-y-2">{teams.map((t) => (
                        <div key={t.id} className="flex items-center gap-3 bg-black/25 p-2"><BizIcon id={t.business} size={36} />
                          <div className="flex-1 text-2xl truncate">{t.name} <span className="text-white/50">· {bizInfo(t.business).name}</span></div>
                          <button className="px-btn px-btn-ghost px-btn-sm" onClick={() => window.confirm(`Remove ${t.name}?`) && act("kick", { teamId: t.id })}>✕</button></div>))}</div>
                    : <SimpleLeaderboard teams={teams} />}
                </div>
              </Panel>
              {game.status === "open" && (
                <Panel>
                  <Label>Submission status ({submitted}/{teams.length})</Label>
                  <div className="flex flex-wrap gap-2 mt-3">{teams.map((t) => <span key={t.id} className={`px-2 py-1 text-xl ${t.submitted ? "bg-mint/30 text-mint" : "bg-black/30 text-white/60"}`}>{t.submitted ? "✓" : "…"} {t.name}</span>)}</div>
                </Panel>
              )}
            </>
          )}
        </div>
      </div>
    </Wrap>
  );
}

function Wrap({ children, stage }: { children: React.ReactNode; stage: number }) {
  return (
    <div className="min-h-screen relative">
      <CityBackground stage={stage} />
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-5">
        <div className="flex items-center justify-between mb-5"><Logo size="lg" /><div className="font-pixel text-[10px] text-sky">TEACHER CONTROLS</div></div>
        {children}
      </div>
    </div>
  );
}
