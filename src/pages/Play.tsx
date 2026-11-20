import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { bizInfo } from "../lib/catalog";
import { clearTeam, loadTeam } from "../lib/storage";
import { signed, tone, usd, mmss } from "../lib/format";
import { useGame, useMe, useNow } from "../lib/hooks";
import type { Decision } from "../lib/types";
import { BizIcon, CityBackground, Logo, Money, Storefront, Walkers } from "../components/art";
import { DecisionPanel, ResultsScreen } from "../components/round";
import { ChampionScreen, EventBanner, Label, Panel } from "../components/ui";

export default function Play() {
  const code = (useParams().code ?? "").toUpperCase();
  const [session, setSession] = useState(() => loadTeam(code));
  const { data, error, offline, skew } = useGame(code);
  const game = data?.game;
  const { me, error: meErr, refetch } = useMe(code, session, `${game?.status}-${game?.round}`);
  const now = useNow(1000) + skew;
  const [showLast, setShowLast] = useState(false);
  useEffect(() => { if (meErr === "invalid") { clearTeam(code); setSession(null); } }, [meErr, code]);

  if (!session) {
    return (
      <Shell stage={2}>
        <Panel className="max-w-xl mx-auto text-center">
          <div className="font-pixel text-sm text-gold">NO TEAM ON THIS DEVICE</div>
          <div className="text-2xl my-4">You haven't joined game {code} on this device (or the teacher removed your team).</div>
          <Link to="/" className="px-btn px-btn-green inline-block">JOIN A GAME</Link>
        </Panel>
      </Shell>
    );
  }
  if (error) return <Shell stage={0}><Panel className="max-w-xl mx-auto text-center"><div className="font-pixel text-sm text-ruby">{error}</div><Link to="/" className="px-btn mt-4 inline-block">HOME</Link></Panel></Shell>;
  if (!game || !data || !me) return <Shell stage={0}><div className="font-pixel text-center text-sm anim-blink mt-20">LOADING...</div></Shell>;

  const team = me.team;
  const myLive = data.teams.find((t) => t.id === team.id) ?? team;
  const biz = bizInfo(team.business);
  const results = me.results;
  const current = results.find((r) => r.round === game.round);
  const prevOf = (round: number) => results.find((r) => r.round === round - 1);
  const elapsed = game.roundOpenedAt ? now - new Date(game.roundOpenedAt).getTime() : 0;

  const submit = async (d: Decision) => {
    await api("submit", { code, ...session, decision: d });
    await refetch();
  };

  return (
    <Shell stage={game.round}>
      {/* HUD */}
      <div className="px-panel p-3 flex items-center gap-3 flex-wrap">
        <BizIcon id={team.business} size={48} />
        <div className="min-w-[8rem] flex-1">
          <div className="font-pixel text-xs leading-4 break-words">{team.name}</div>
          <div className="text-xl text-white/70 leading-none mt-1">{biz.name}</div>
        </div>
        <div className="text-center"><Label>Month</Label><div className="font-pixel text-sm">{Math.max(1, game.round)}/{game.totalRounds}</div></div>
        <div className="text-center"><Label>Cash</Label><div className="font-pixel text-sm"><Money value={myLive.cash} /></div></div>
        <div className="text-center"><Label>Rank</Label><div className="font-pixel text-sm text-gold">#{myLive.rank}</div></div>
      </div>
      {offline && <div className="bg-ruby text-white font-pixel text-[10px] p-2 text-center mt-3 anim-blink">RECONNECTING... YOUR PROGRESS IS SAFE</div>}

      <div className="mt-5 space-y-5">
        {game.status === "lobby" && (
          <Panel className="text-center">
            <div className="font-pixel text-sm text-gold">YOU'RE IN!</div>
            <div className="flex justify-center my-4 relative h-36"><div className="relative pb-6"><Storefront id={team.business} level={0} width={112} /><Walkers count={5} seed={3} /></div></div>
            <div className="text-2xl">Waiting for the teacher to start the game…</div>
            <div className="text-xl text-white/60 mt-2">{data.teams.length} team{data.teams.length === 1 ? "" : "s"} connected</div>
            <div className="flex flex-wrap gap-2 justify-center mt-4">{data.teams.map((t) => <span key={t.id} className="bg-black/30 px-2 py-1 text-xl flex items-center gap-2"><BizIcon id={t.business} size={22} />{t.name}</span>)}</div>
          </Panel>
        )}

        {game.status === "open" && game.event && (
          <>
            <EventBanner event={game.event} />
            {me.eventForYou && (
              <Panel variant="dark">
                <Label>Market update for your {biz.name}</Label>
                <div className="text-2xl mt-2 flex flex-wrap gap-x-5 gap-y-1">
                  <Impact label="Customer demand" v={me.eventForYou.demand} up />
                  <Impact label="Cost per customer" v={me.eventForYou.varCost} />
                  <Impact label="Overhead" v={me.eventForYou.fixed} />
                  {me.eventForYou.flat > 0 && <span className="text-ruby">One-time cost {usd(me.eventForYou.flat)}</span>}
                  {me.eventForYou.demand === 0 && me.eventForYou.varCost === 0 && me.eventForYou.fixed === 0 && me.eventForYou.flat === 0 && <span className="text-white/70">Little direct effect on you.</span>}
                </div>
                <div className="text-lg text-white/50 mt-1">Your own spending changes how well you handle it.</div>
              </Panel>
            )}
            <div className="text-center font-pixel text-[10px] text-sky">TIME THIS MONTH {mmss(elapsed)} · TARGET 2:00</div>
            {prevOf(game.round) && <LastMonth r={prevOf(game.round)!} onOpen={() => setShowLast(!showLast)} open={showLast} team={myLive} />}
            <DecisionPanel key={game.round} team={myLive} round={game.round} saved={me.decision} onSubmit={submit} locked={false} />
          </>
        )}

        {game.status === "results" && (
          current
            ? <>
                <ResultsScreen res={current} prev={prevOf(game.round)} team={myLive} />
                <Panel className="text-center">
                  <div className="font-pixel text-xs anim-blink text-sky">WAITING FOR THE TEACHER TO OPEN MONTH {Math.min(game.round + 1, game.totalRounds)}…</div>
                  {game.round >= game.totalRounds && <div className="font-pixel text-xs text-gold mt-3">THAT WAS THE FINAL MONTH! CHAMPION REVEAL NEXT…</div>}
                </Panel>
              </>
            : <Panel className="text-center"><div className="font-pixel text-xs anim-blink">CALCULATING RESULTS...</div></Panel>
        )}

        {game.status === "finished" && (
          <>
            <Panel className="text-center">
              <Label>Your finish</Label>
              <div className="font-pixel text-3xl text-gold mt-2">#{myLive.rank} of {data.teams.length}</div>
              <div className={`font-pixel text-lg mt-3 ${tone(myLive.netEarnings)}`}>{signed(myLive.netEarnings)} net earnings</div>
            </Panel>
            {game.final && <ChampionScreen final={game.final} />}
            {results.length > 0 && <button className="px-btn px-btn-ghost w-full" onClick={() => setShowLast(!showLast)}>{showLast ? "HIDE" : "SHOW"} MY LAST MONTH</button>}
            {showLast && results.length > 0 && <ResultsScreen res={results[results.length - 1]} prev={results[results.length - 2]} team={myLive} />}
          </>
        )}
      </div>
    </Shell>
  );
}

function Impact({ label, v, up = false }: { label: string; v: number; up?: boolean }) {
  if (!v) return null;
  const good = up ? v > 0 : v < 0;
  return <span className={good ? "text-mint" : "text-ruby"}>{label} {v > 0 ? "+" : ""}{Math.round(v * 100)}%</span>;
}

function LastMonth({ r, open, onOpen, team }: { r: import("../lib/types").MyResult; open: boolean; onOpen: () => void; team: import("../lib/types").Team }) {
  return (
    <Panel variant="dark">
      <button className="w-full flex items-center justify-between text-left" onClick={onOpen} aria-expanded={open}>
        <span className="font-pixel text-[10px] text-sky">LAST MONTH (#{r.round})</span>
        <span className={`font-pixel text-xs ${tone(r.result.netChange)}`}>{signed(r.result.netChange)} {open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="mt-3"><ResultsScreen res={r} team={team} /></div>}
      {!open && <div className="text-xl text-white/70 mt-1">{r.result.customers} customers · revenue {usd(r.result.revenue)} · rank #{r.rank}. <span className="text-gold">{r.explanation.lesson}</span></div>}
    </Panel>
  );
}

function Shell({ children, stage }: { children: React.ReactNode; stage: number }) {
  return (
    <div className="min-h-screen relative">
      <CityBackground stage={stage} />
      <div className="relative z-10 max-w-2xl mx-auto px-3 py-4">
        <div className="flex justify-center mb-4"><Logo size="sm" /></div>
        {children}
      </div>
    </div>
  );
}
