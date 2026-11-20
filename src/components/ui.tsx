import type { ReactNode } from "react";
import { bizInfo } from "../lib/catalog";
import { signed, usd, tone } from "../lib/format";
import type { FinalSummary, GameEvent, Team } from "../lib/types";
import { BizIcon, Confetti, Money, Trophy } from "./art";

export const Panel = ({ children, className = "", variant = "" }: { children: ReactNode; className?: string; variant?: "dark" | "gold" | "" }) => (
  <div className={`px-panel ${variant === "dark" ? "px-panel-dark" : variant === "gold" ? "px-panel-gold" : ""} p-4 ${className}`}>{children}</div>
);

export const Label = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`font-pixel text-[10px] text-sky uppercase tracking-wide ${className}`}>{children}</div>
);

export function EventBanner({ event, compact = false }: { event: GameEvent; compact?: boolean }) {
  return (
    <div className={`px-panel px-panel-gold anim-pop ${compact ? "p-3" : "p-5"}`}>
      <div className="flex items-center gap-4">
        <div className={`${compact ? "text-4xl" : "text-6xl"} anim-bob`}>{event.icon}</div>
        <div className="min-w-0">
          <div className={`font-pixel text-bubble anim-blink ${compact ? "text-[10px]" : "text-xs"}`}>★ MARKET EVENT ★</div>
          <div className={`font-pixel text-gold text-shadow-px mt-1 ${compact ? "text-sm" : "text-lg md:text-xl"}`}>{event.name.toUpperCase()}</div>
          <div className={`text-white/90 mt-1 ${compact ? "text-lg" : "text-2xl"}`}>{event.description}</div>
        </div>
      </div>
    </div>
  );
}

export function RankDelta({ rank, prev }: { rank: number; prev: number }) {
  if (rank === prev) return <span className="text-white/40 font-pixel text-[10px]">–</span>;
  return rank < prev
    ? <span className="text-mint font-pixel text-[10px]">▲{prev - rank}</span>
    : <span className="text-ruby font-pixel text-[10px]">▼{rank - prev}</span>;
}

export function RankBadge({ rank }: { rank: number }) {
  const bg = rank === 1 ? "#ffd23f" : rank === 2 ? "#d7dbe8" : rank === 3 ? "#d98a4a" : "#3a2680";
  return (
    <div className="font-pixel text-center shrink-0 flex items-center justify-center" style={{ width: 44, height: 44, background: bg, color: rank <= 3 ? "#1b1040" : "#fff", border: "4px solid #0b0520", boxShadow: "inset 3px 3px 0 rgba(255,255,255,.5), inset -3px -3px 0 rgba(0,0,0,.25)", fontSize: 14 }}>
      {rank}
    </div>
  );
}

export function SimpleLeaderboard({ teams, meId }: { teams: Team[]; meId?: string }) {
  const sorted = [...teams].sort((a, b) => a.rank - b.rank);
  return (
    <div className="space-y-2">
      {sorted.map((t) => (
        <div key={t.id} className={`flex items-center gap-3 px-2 py-1.5 ${t.id === meId ? "bg-gold/20 outline outline-2 outline-gold" : "bg-black/25"}`}>
          <RankBadge rank={t.rank} />
          <BizIcon id={t.business} size={36} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xl leading-none">{t.name}</div>
            <div className="text-white/60 text-base leading-none">{bizInfo(t.business).name}</div>
          </div>
          <RankDelta rank={t.rank} prev={t.prevRank} />
          <div className="text-right">
            <div className={`font-pixel text-[11px] ${tone(t.netEarnings)}`}>{signed(t.netEarnings)}</div>
            <div className="text-white/60 text-base leading-none">cash {usd(t.cash)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChampionScreen({ final, teams, big = false }: { final: FinalSummary; teams?: Team[]; big?: boolean }) {
  const c = final.champion;
  if (!c) return <Panel><div className="font-pixel text-sm">No results yet.</div></Panel>;
  const stat = (label: string, value: ReactNode) => (
    <div className="bg-black/30 p-3"><div className="font-pixel text-[9px] text-sky">{label}</div><div className={`font-pixel mt-2 ${big ? "text-lg" : "text-sm"}`}>{value}</div></div>
  );
  void teams;
  return (
    <div className="space-y-5">
      <Confetti />
      <div className="px-panel px-panel-gold p-6 text-center anim-pop">
        <div className="font-pixel text-bubble text-xs anim-blink">★ ★ ★ GAME OVER ★ ★ ★</div>
        <div className={`font-pixel text-gold text-shadow-px mt-3 ${big ? "text-4xl" : "text-2xl"}`}>PIXEL EMPIRE CHAMPION</div>
        <div className="flex items-center justify-center gap-5 mt-5 flex-wrap">
          <Trophy size={big ? 9 : 7} />
          <div className="text-left">
            <div className={`font-pixel text-white text-shadow-px ${big ? "text-3xl" : "text-xl"}`}>{c.name}</div>
            <div className="flex items-center gap-2 mt-2"><BizIcon id={c.business} size={34} /><span className="text-2xl">{bizInfo(c.business).name}</span></div>
          </div>
        </div>
        <div className={`font-pixel mt-5 text-mint text-shadow-px ${big ? "text-3xl" : "text-xl"}`}><Money value={c.netEarnings} signedMode /> <span className="text-white text-xs">NET EARNINGS</span></div>
      </div>
      <div className={`grid gap-3 ${big ? "grid-cols-5" : "grid-cols-2 md:grid-cols-5"}`}>
        {stat("FINAL CASH", usd(c.cash))}
        {stat("TOTAL REVENUE", usd(c.totalRevenue))}
        {stat("CUSTOMERS SERVED", c.totalCustomers.toLocaleString("en-US"))}
        {stat("BEST MONTH", <span className={tone(c.bestRoundNet)}>{signed(c.bestRoundNet)}</span>)}
        {stat("OP. MARGIN", `${Math.round(c.margin * 100)}%`)}
      </div>
      <div className={`grid gap-4 ${big ? "grid-cols-2" : "md:grid-cols-2"}`}>
        <Panel>
          <Label>Achievements</Label>
          <div className="space-y-2 mt-3">
            {final.achievements.map((a) => (
              <div key={a.key} className="flex items-center gap-3 bg-black/25 p-2">
                <div className="text-3xl">{({ profit_king: "👑", customer_magnet: "🧲", marketing_master: "📣", efficiency_expert: "⚙️", comeback_kid: "🚀" } as Record<string, string>)[a.key]}</div>
                <div className="min-w-0">
                  <div className="font-pixel text-[10px] text-gold">{a.title}</div>
                  <div className="text-xl leading-none truncate">{a.teamName} <span className="text-white/60">· {a.value}</span></div>
                  <div className="text-white/50 text-base leading-none">{a.description}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <Label>Final Rankings</Label>
          <div className="space-y-1.5 mt-3 max-h-[360px] overflow-auto scroll-thin pr-1">
            {final.rankings.map((r) => (
              <div key={r.id} className="flex items-center gap-2 bg-black/25 px-2 py-1">
                <RankBadge rank={r.rank} />
                <BizIcon id={r.business} size={30} />
                <div className="flex-1 min-w-0 text-xl truncate">{r.name}</div>
                <div className={`font-pixel text-[10px] ${tone(r.netEarnings)}`}>{signed(r.netEarnings)}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel variant="dark">
        <Label>How the champion won</Label>
        <ul className="mt-3 space-y-2 text-2xl">{final.summary.map((s, i) => <li key={i}>▸ {s}</li>)}</ul>
      </Panel>
    </div>
  );
}
