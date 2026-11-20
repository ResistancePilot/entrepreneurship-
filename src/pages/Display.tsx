import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { bizInfo } from "../lib/catalog";
import { mmss, signed, tone, usd } from "../lib/format";
import { useGame, useNow } from "../lib/hooks";
import type { Team } from "../lib/types";
import { BizIcon, CityBackground, FloatDelta, Logo, Money, Storefront, Walkers } from "../components/art";
import { ChampionScreen, EventBanner, RankBadge, RankDelta } from "../components/ui";

type View = "board" | "city";

export default function Display() {
  const code = (useParams().code ?? "").toUpperCase();
  const { data, error, offline, skew } = useGame(code);
  const [view, setView] = useState<View>("board");
  const [showFinal, setShowFinal] = useState(true);
  const now = useNow(1000) + skew;
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "l" || e.key === "L") setView("board"); if (e.key === "c" || e.key === "C") setView("city"); if (e.key === "f" || e.key === "F") document.documentElement.requestFullscreen?.(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  if (error) return <div className="min-h-screen flex items-center justify-center font-pixel text-ruby p-8 text-center">{error}</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center font-pixel anim-blink">LOADING...</div>;
  const { game, teams } = data;
  const elapsed = game.roundOpenedAt ? now - new Date(game.roundOpenedAt).getTime() : 0;
  const submitted = teams.filter((t) => t.submitted).length;
  const origin = window.location.host;

  return (
    <div className="h-screen w-screen relative overflow-hidden flex flex-col">
      <CityBackground stage={game.round} />
      <div className="relative z-10 flex flex-col h-full p-4 gap-3">
        {/* Header */}
        <div className="flex items-center gap-4 flex-wrap">
          <Logo size="lg" />
          <div className="px-panel px-panel-dark !p-2 flex items-center gap-1" aria-label="round progress">
            {Array.from({ length: game.totalRounds }).map((_, i) => (
              <div key={i} className="font-pixel text-[10px] flex items-center justify-center" style={{ width: 28, height: 28, border: "3px solid #0b0520", background: i + 1 < game.round || (i + 1 === game.round && game.status === "results") || game.status === "finished" ? "#3ddc84" : i + 1 === game.round ? "#ffd23f" : "#2a1a5a", color: "#150b2e" }}>{i + 1}</div>
            ))}
          </div>
          <div className="font-pixel text-sm md:text-lg text-white text-shadow-px">
            {game.status === "lobby" ? "WAITING FOR TEAMS" : game.status === "finished" ? "FINAL RESULTS" : `MONTH ${game.round} · ${game.status === "open" ? "DECISIONS OPEN" : "RESULTS"}`}
          </div>
          {game.status === "open" && (
            <>
              <div className="px-panel px-panel-dark !p-2 font-pixel text-lg">⏱ {mmss(Math.max(0, 120000 - elapsed))}{elapsed > 120000 && <span className="text-ruby"> +{mmss(elapsed - 120000)}</span>}</div>
              <div className="px-panel px-panel-dark !p-2 font-pixel text-sm text-mint">{submitted}/{teams.length} READY</div>
            </>
          )}
          <div className="ml-auto flex items-center gap-3">
            {game.status !== "lobby" && (
              <div className="px-panel px-panel-dark !p-2 text-right"><div className="font-pixel text-[9px] text-sky">JOIN CODE</div><div className="font-pixel text-lg text-gold tracking-widest">{code}</div></div>
            )}
            <div className="flex">
              {(["board", "city"] as View[]).map((v) => (
                <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={`px-btn px-btn-sm ${view === v ? "" : "px-btn-ghost"}`} style={{ margin: "0 3px" }}>{v === "board" ? "LEADERBOARD" : "CITY"}</button>
              ))}
            </div>
          </div>
        </div>

        {game.event && (game.status === "open" || game.status === "results") && <EventBanner event={game.event} compact />}
        {offline && <div className="bg-ruby text-white font-pixel text-xs p-2 text-center anim-blink">RECONNECTING...</div>}

        {game.status === "lobby" && (
          <div className="px-panel text-center !p-4 shrink-0">
            <div className="font-pixel text-xs text-sky">JOIN THE GAME AT {origin} WITH CODE</div>
            <div className="font-pixel text-7xl text-gold tracking-[.25em] my-3 text-shadow-px select-all">{code}</div>
            <div className="font-pixel text-sm text-white">{teams.length} TEAM{teams.length === 1 ? "" : "S"} CONNECTED</div>
          </div>
        )}

        <div className="flex-1 min-h-0">
          {game.status === "finished" && game.final && showFinal ? (
            <div className="h-full overflow-auto scroll-thin pr-2">
              <ChampionScreen final={game.final} big />
              <div className="text-center mt-4"><button className="px-btn px-btn-ghost" onClick={() => setShowFinal(false)}>SHOW LEADERBOARD</button></div>
            </div>
          ) : view === "board" && game.status !== "lobby" ? <Board teams={teams} open={game.status === "open"} /> : <City teams={teams} lobby={game.status === "lobby"} />}
        </div>
      </div>
    </div>
  );
}

function Board({ teams, open }: { teams: Team[]; open: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(500);
  useLayoutEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(() => setH(el.clientHeight));
    ro.observe(el); setH(el.clientHeight);
    return () => ro.disconnect();
  }, []);
  const n = Math.max(1, teams.length);
  let cols = 1;
  while (cols < 4 && Math.floor(h / Math.ceil(n / cols)) < 56) cols++;
  const perCol = Math.ceil(n / cols);
  const rowH = Math.min(96, Math.floor(h / perCol));
  const f = Math.max(0.55, Math.min(1.25, rowH / 70)) * (cols > 1 ? 0.85 : 1);
  return (
    <div ref={ref} className="relative h-full">
      {teams.map((t) => {
        const i = t.rank - 1, col = Math.floor(i / perCol), row = i % perCol;
        const last = t.last;
        return (
          <div key={t.id} className="rank-row absolute top-0 left-0" style={{ width: `${100 / cols}%`, height: rowH, padding: "0 6px 6px 0", transform: `translate(${col * 100}%, ${row * rowH}px)` }}>
            <div className="px-panel !p-0 h-full flex items-center gap-3 px-3 relative" style={{ background: t.rank === 1 ? "#4a3a10" : undefined }}>
              <div style={{ transform: `scale(${Math.min(1, f)})`, transformOrigin: "left center", width: 44 * Math.min(1, f) + 4 }}><RankBadge rank={t.rank} /></div>
              <div style={{ transform: `scale(${Math.min(1, f)})`, transformOrigin: "left center", width: 40 * Math.min(1, f) }}><BizIcon id={t.business} size={40} /></div>
              <div className="min-w-0 flex-1">
                <div className="truncate leading-none text-shadow-px" style={{ fontSize: Math.round(30 * f) }}>{t.rank === 1 ? "👑 " : ""}{t.name}</div>
                <div className="text-white/60 leading-none truncate" style={{ fontSize: Math.round(20 * f) }}>{bizInfo(t.business).name}
                  {open && <span className={`ml-3 font-pixel ${t.submitted ? "text-mint" : "text-white/40"}`} style={{ fontSize: Math.round(11 * f) }}>{t.submitted ? "✓ READY" : "THINKING…"}</span>}
                </div>
              </div>
              <div className="w-10 text-center"><RankDelta rank={t.rank} prev={t.prevRank} /></div>
              {last && !open && (
                <div className="text-right relative hidden md:block" style={{ minWidth: 110 * f }}>
                  <div className="font-pixel text-white/60" style={{ fontSize: Math.round(9 * f) }}>LAST MONTH</div>
                  <div className={`font-pixel ${tone(last.netChange)}`} style={{ fontSize: Math.round(13 * f) }}>{signed(last.netChange)}</div>
                  <FloatDelta value={last.netChange} id={last.round} />
                </div>
              )}
              <div className="text-right" style={{ minWidth: 130 * f }}>
                <div className="font-pixel text-white/60" style={{ fontSize: Math.round(9 * f) }}>CASH</div>
                <div className="font-pixel" style={{ fontSize: Math.round(14 * f) }}><Money value={t.cash} /></div>
              </div>
              <div className="text-right" style={{ minWidth: 170 * f }}>
                <div className="font-pixel text-white/60" style={{ fontSize: Math.round(9 * f) }}>NET EARNINGS</div>
                <div className={`font-pixel ${tone(t.netEarnings)}`} style={{ fontSize: Math.round(20 * f) }}><Money value={t.netEarnings} signedMode /></div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function City({ teams, lobby }: { teams: Team[]; lobby: boolean }) {
  const n = teams.length;
  const w = n <= 4 ? 260 : n <= 8 ? 170 : n <= 14 ? 118 : n <= 24 ? 92 : 72;
  const ordered = [...teams].sort((a, b) => (lobby ? 0 : a.rank - b.rank));
  return (
    <div className="h-full overflow-hidden flex flex-wrap content-end justify-center gap-x-3 gap-y-6 pb-2">
      {ordered.map((t, idx) => {
        const walkers = lobby ? 3 : Math.max(1, Math.min(8, Math.round((t.last?.customers ?? 100) / Math.max(40, t.stats.capacity / 6))));
        return (
          <div key={t.id} className="relative flex flex-col items-center anim-pop" style={{ width: w + 16, animationDelay: `${idx * 60}ms` }}>
            {!lobby && t.rank === 1 && <div className="absolute -top-5 text-2xl anim-bob z-10">👑</div>}
            <div className="relative" style={{ width: w }}>
              <Storefront id={t.business} level={t.stats.expLevel} width={w} glow={!lobby && t.rank === 1} />
              <Walkers count={walkers} seed={idx + 1} />
              <FloatDelta value={t.last?.netChange} id={t.last?.round ?? 0} />
            </div>
            <div className="mt-1 bg-black/60 border-2 border-edge px-2 py-1 text-center w-full" style={{ borderStyle: "solid" }}>
              <div className="truncate leading-none" style={{ fontSize: Math.max(16, w / 6) }}>{!lobby && `#${t.rank} `}{t.name}</div>
              {!lobby && <div className={`font-pixel leading-none mt-1 ${tone(t.netEarnings)}`} style={{ fontSize: Math.max(8, w / 11) }}>{signed(t.netEarnings)}</div>}
              {!lobby && <div className="font-pixel text-white/60 leading-none mt-1" style={{ fontSize: Math.max(7, w / 14) }}>{usd(t.cash)}</div>}
            </div>
          </div>
        );
      })}
      {n === 0 && <div className="font-pixel text-sm text-white/70 anim-blink self-center">WAITING FOR TEAMS TO JOIN…</div>}
    </div>
  );
}
