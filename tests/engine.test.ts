import { describe, expect, it } from "vitest";
import {
  BUSINESSES, EVENTS, START_CASH, ZERO_DECISION, eventForRound, initialState, simulateRound, validateDecision, type Decision, type TeamState,
} from "../supabase/functions/_shared/engine";

function play(bid: string, plan: (cash: number, r: number) => Decision, seed = "s1", key = "k") {
  const b = BUSINESSES.find((x) => x.id === bid)!;
  let s: TeamState = initialState(b);
  const rows = [];
  for (let r = 1; r <= 8; r++) {
    const d = plan(Math.max(0, Math.floor(s.cash)), r);
    const res = simulateRound(b, s, d, eventForRound(seed, r), r, seed, key);
    rows.push({ d, res, start: s });
    s = res.next;
  }
  return { s, rows };
}
const even = (n: number): Decision => ({ marketing: n, quality: n, operations: n, expansion: n });

describe("engine", () => {
  it("has ten businesses and a different event each round", () => {
    expect(BUSINESSES).toHaveLength(10);
    const ids = new Set(Array.from({ length: 8 }, (_, i) => eventForRound("abc", i + 1).id));
    expect(ids.size).toBe(8);
    expect(EVENTS.length).toBeGreaterThanOrEqual(10);
  });
  it("is deterministic for the same seed", () => {
    const a = play("videogame", () => even(300));
    const b = play("videogame", () => even(300));
    expect(a.s).toEqual(b.s);
  });
  it("accounting identities hold with no double counting", () => {
    for (const biz of BUSINESSES) {
      const { s, rows } = play(biz.id, (c) => even(Math.min(300, Math.floor(c / 4))));
      let cash = START_CASH, cum = 0, inv = 0;
      for (const { res, d } of rows) {
        expect(res.customers).toBe(Math.min(res.demand, res.capacity));
        expect(res.opProfit).toBe(res.revenue - res.opex);
        expect(res.invested).toBe(d.marketing + d.quality + d.operations + d.expansion);
        expect(res.netChange).toBe(res.opProfit - res.invested - res.eventCost);
        cash += res.netChange; cum += res.opProfit - res.eventCost; inv += res.invested;
        expect(res.endCash).toBe(cash);
      }
      expect(s.cash).toBe(cash);
      expect(s.cumProfit).toBe(cum);
      expect(s.netEarnings).toBe(cum - inv);
      expect(s.netEarnings).toBe(s.cash - START_CASH);
    }
  });
  it("every business is profitable with no investment", () => {
    for (const b of BUSINESSES) {
      const { s } = play(b.id, () => ZERO_DECISION);
      expect(s.netEarnings).toBeGreaterThan(8000);
    }
  });
  it("validates decisions", () => {
    expect(validateDecision({ marketing: -1, quality: 0, operations: 0, expansion: 0 }, 1000).ok).toBe(false);
    expect(validateDecision({ marketing: 600, quality: 600, operations: 0, expansion: 0 }, 1000).ok).toBe(false);
    expect(validateDecision({ marketing: 1.5, quality: 0, operations: 0, expansion: 0 }, 1000).ok).toBe(false);
    expect(validateDecision({ marketing: "9", quality: 0, operations: 0, expansion: 0 }, 1000).ok).toBe(false);
    expect(validateDecision({ marketing: 250, quality: 250, operations: 250, expansion: 250 }, 1000).ok).toBe(true);
    expect(validateDecision(null, 1000).ok).toBe(false);
  });
  it("balance: moderate early investing beats nothing; spending everything is not best", () => {
    const seeds = Array.from({ length: 20 }, (_, i) => "bal" + i);
    let none = 0, moderate = 0, allin = 0;
    for (const b of BUSINESSES) for (const sd of seeds) {
      none += play(b.id, () => ZERO_DECISION, sd).s.netEarnings;
      moderate += play(b.id, (c, r) => (r <= 5 ? even(Math.min(400, Math.floor(c / 4))) : ZERO_DECISION), sd).s.netEarnings;
      allin += play(b.id, (c) => even(Math.floor(c / 4)), sd).s.netEarnings;
    }
    expect(moderate).toBeGreaterThan(none * 1.1);
    expect(moderate).toBeGreaterThan(allin * 1.5);
  });
  it("balance: no business dominates under the same strategy", () => {
    const seeds = Array.from({ length: 20 }, (_, i) => "bal" + i);
    const avgs = BUSINESSES.map((b) => seeds.reduce((a, sd) => a + play(b.id, (c, r) => (r <= 5 ? even(Math.min(400, Math.floor(c / 4))) : ZERO_DECISION), sd).s.netEarnings, 0) / seeds.length);
    const mean = avgs.reduce((a, b) => a + b, 0) / avgs.length;
    for (const a of avgs) { expect(a).toBeGreaterThan(mean * 0.8); expect(a).toBeLessThan(mean * 1.2); }
  });
  it("investments have diminishing returns", () => {
    const b = BUSINESSES[0];
    const s = initialState(b);
    const ev = eventForRound("x", 1);
    const profitAt = (m: number) => simulateRound(b, s, { ...ZERO_DECISION, marketing: m, operations: m }, ev, 1, "x", "k").opProfit;
    const gain1 = profitAt(1000) - profitAt(0), gain2 = profitAt(2000) - profitAt(1000), gain3 = profitAt(4000) - profitAt(3000);
    expect(gain2).toBeLessThan(gain1);
    expect(gain3).toBeLessThan(gain2);
  });
});
