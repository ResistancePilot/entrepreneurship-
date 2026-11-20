import { useMemo, useState } from "react";
import { CATEGORIES } from "../lib/catalog";
import { signed, tone, usd } from "../lib/format";
import type { Decision, MyResult, Team } from "../lib/types";
import { FloatDelta, Money } from "./art";
import { Label, Panel, RankDelta } from "./ui";

export const ZERO: Decision = { marketing: 0, quality: 0, operations: 0, expansion: 0 };
const sum = (d: Decision) => d.marketing + d.quality + d.operations + d.expansion;
const same = (a: Decision, b: Decision | null) => !!b && a.marketing === b.marketing && a.quality === b.quality && a.operations === b.operations && a.expansion === b.expansion;

export function DecisionPanel({ team, round, saved, onSubmit, locked }: {
  team: Team; round: number; saved: Decision | null; onSubmit: (d: Decision) => Promise<void>; locked: boolean;
}) {
  const cash = Math.max(0, team.cash);
  const [d, setD] = useState<Decision>(saved ?? ZERO);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  // Parent mounts this with key={round} only after the saved decision has loaded.

  const planned = sum(d);
  const remaining = cash - planned;
  const set = (k: keyof Decision, v: number) => {
    const others = planned - d[k];
    const clean = Math.max(0, Math.min(Math.round(v) || 0, cash - others));
    setD({ ...d, [k]: clean });
    setMsg("");
  };
  const isSaved = same(d, saved);
  const submit = async () => {
    setBusy(true); setMsg("");
    try { await onSubmit(d); setMsg("ok"); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  return (
    <Panel>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="font-pixel text-sm text-gold">MONTH {round} · ALLOCATE CASH</div>
        <button className="px-btn px-btn-ghost px-btn-sm" onClick={() => { setD(ZERO); setMsg(""); }} disabled={locked}>CLEAR</button>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4 text-center">
        <div className="bg-black/30 p-2"><Label>Available</Label><div className="font-pixel text-sm mt-1 text-mint">{usd(cash)}</div></div>
        <div className="bg-black/30 p-2"><Label>Planned</Label><div className="font-pixel text-sm mt-1 text-gold">{usd(planned)}</div></div>
        <div className="bg-black/30 p-2"><Label>Remaining</Label><div className="font-pixel text-sm mt-1">{usd(remaining)}</div></div>
      </div>
      <div className="flex h-5 mt-3 border-4 border-edge bg-black/50" aria-hidden>
        {CATEGORIES.map((c) => <div key={c.key} style={{ width: `${cash ? (d[c.key as keyof Decision] / cash) * 100 : 0}%`, background: c.color }} />)}
      </div>

      <div className="mt-4 space-y-5">
        {CATEGORIES.map((c) => {
          const k = c.key as keyof Decision;
          return (
            <div key={c.key}>
              <div className="flex items-center justify-between gap-2">
                <div className="font-pixel text-[11px]" style={{ color: c.color }}>{c.icon} {c.label}</div>
                <div className="flex items-center gap-1">
                  <button className="px-btn px-btn-ghost px-btn-sm !px-3" aria-label={`decrease ${c.label}`} onClick={() => set(k, d[k] - 100)} disabled={locked}>−</button>
                  <input className="px-input !w-28 !py-2 text-right" inputMode="numeric" aria-label={`${c.label} amount`} value={d[k]} disabled={locked}
                    onChange={(e) => set(k, Number(e.target.value.replace(/[^0-9]/g, "")))} />
                  <button className="px-btn px-btn-ghost px-btn-sm !px-3" aria-label={`increase ${c.label}`} onClick={() => set(k, d[k] + 100)} disabled={locked}>+</button>
                </div>
              </div>
              <input type="range" className="px-range mt-1" style={{ ["--thumb" as any]: c.color }} min={0} max={cash} step={50} value={d[k]} disabled={locked}
                onChange={(e) => set(k, Number(e.target.value))} aria-label={`${c.label} slider`} />
              <div className="text-lg leading-5 text-white/85"><span className="text-mint">▲</span> {c.benefit}</div>
              <div className="text-lg leading-5 text-white/60"><span className="text-ruby">▼</span> {c.risk}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 text-lg text-white/70">Tip: each extra dollar in a category helps less than the one before. Spending everything is rarely the best plan.</div>
      <button className={`px-btn w-full mt-4 ${isSaved ? "px-btn-blue" : "px-btn-green"}`} disabled={busy || locked} onClick={submit}>
        {busy ? "SAVING..." : isSaved ? "✓ LOCKED IN · TAP TO RE-SAVE" : saved ? "UPDATE DECISIONS" : "LOCK IN DECISIONS"}
      </button>
      {msg && msg !== "ok" && <div className="text-ruby text-2xl mt-3" role="alert">⚠ {msg}</div>}
      {(isSaved || msg === "ok") && <div className="text-mint text-2xl mt-3">✓ Submitted! You can change it until the teacher closes the month.</div>}
      {!saved && planned === 0 && <div className="text-white/60 text-lg mt-2">No submission = $0 invested.</div>}
    </Panel>
  );
}

const Row = ({ label, value, delta, goodUp = true, big = false, i = 0, children }: {
  label: string; value: React.ReactNode; delta?: number | null; goodUp?: boolean; big?: boolean; i?: number; children?: React.ReactNode;
}) => (
  <div className="flex items-center justify-between gap-3 px-3 py-2 bg-black/30 anim-slide" style={{ animationDelay: `${i * 90}ms` }}>
    <div className={`font-pixel ${big ? "text-xs" : "text-[10px]"} text-white/90`}>{label}</div>
    <div className="flex items-baseline gap-3">
      {delta != null && delta !== 0 && (
        <span className={`text-lg ${(delta > 0) === goodUp ? "text-mint" : "text-ruby"}`}>{delta > 0 ? "▲" : "▼"}{Math.abs(Math.round(delta)).toLocaleString("en-US")}</span>
      )}
      <div className={`font-pixel ${big ? "text-xl" : "text-sm"}`}>{value}</div>
      {children}
    </div>
  </div>
);

export function ResultsScreen({ res, prev, team }: { res: MyResult; prev?: MyResult; team: Team }) {
  const r = res.result, p = prev?.result;
  const d = (k: keyof typeof r) => (p ? (r[k] as number) - (p[k] as number) : null);
  const good = r.netChange >= 0;
  const eventLine = useMemo(() => `${r.eventName}`, [r.eventName]);
  return (
    <div className="space-y-4">
      <div className={`px-panel p-5 text-center anim-pop ${good ? "" : "anim-shake"}`}>
        <div className="font-pixel text-gold text-xl md:text-2xl text-shadow-px">MONTH {res.round} COMPLETE!</div>
        <div className={`font-pixel text-xs mt-3 ${good ? "text-mint" : "text-ruby"}`}>{res.explanation.headline}</div>
        <div className="text-xl text-white/70 mt-2">Market event: {eventLine}</div>
      </div>

      <div className="relative">
        <FloatDelta value={r.netChange} id={res.round} />
        <div className={`px-panel px-panel-dark p-4 text-center`}>
          <Label>Monthly Net Earnings</Label>
          <div className={`font-pixel text-3xl mt-2 ${tone(r.netChange)}`}><Money value={r.netChange} signedMode /></div>
          <div className="text-white/60 text-xl mt-1">revenue − operating costs − investments − event costs</div>
        </div>
      </div>

      <Panel>
        <div className="space-y-2">
          <Row i={0} label="CUSTOMERS SERVED" value={r.customers.toLocaleString("en-US")} delta={d("customers")} />
          <Row i={1} label="REVENUE" value={<span className="text-mint">{usd(r.revenue)}</span>} delta={d("revenue")} />
          <Row i={2} label="OPERATING EXPENSES" value={<span className="text-ruby">{usd(r.opex)}</span>} delta={d("opex")} goodUp={false} />
          <Row i={3} label="INVESTMENTS" value={<span className="text-tangerine">{usd(r.invested)}</span>} delta={d("invested")} goodUp={false} />
          {r.eventCost > 0 && <Row i={4} label="EVENT COSTS" value={<span className="text-ruby">{usd(r.eventCost)}</span>} />}
          <Row i={5} label="CASH BALANCE" big value={<Money value={r.endCash} />} delta={p ? r.endCash - p.endCash : null} />
          <Row i={6} label="CUSTOMER SATISFACTION" value={`${Math.round(r.satisfaction)}%`} delta={d("satisfaction")} />
          <Row i={7} label="REPUTATION" value={`${Math.round(r.reputation)}`} delta={d("reputation")} />
          <Row i={8} label="RANK" value={`#${res.rank}`}>{prev ? <RankDelta rank={res.rank} prev={prev.rank} /> : null}</Row>
          <Row i={9} label="TOTAL NET EARNINGS" value={<span className={tone(team.netEarnings)}>{signed(team.netEarnings)}</span>} />
        </div>
      </Panel>

      <Panel variant="dark">
        <Label>Why it happened</Label>
        <ul className="mt-3 space-y-2 text-2xl">{res.explanation.lines.map((l, i) => <li key={i}>▸ {l}</li>)}</ul>
      </Panel>
      <div className="px-panel px-panel-gold p-4">
        <div className="font-pixel text-[10px] text-gold">💡 BUSINESS LESSON</div>
        <div className="text-2xl mt-2">{res.explanation.lesson}</div>
      </div>
    </div>
  );
}
