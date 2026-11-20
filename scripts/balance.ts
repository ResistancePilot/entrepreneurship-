import { BUSINESSES, ZERO_DECISION, eventForRound, initialState, simulateRound, Decision, TeamState } from "../supabase/functions/_shared/engine";

type Strat = (cash: number, round: number) => Decision;
const split = (total: number, w: [number, number, number, number]): Decision => {
  const s = w[0] + w[1] + w[2] + w[3];
  return { marketing: Math.floor((total * w[0]) / s), quality: Math.floor((total * w[1]) / s), operations: Math.floor((total * w[2]) / s), expansion: Math.floor((total * w[3]) / s) };
};
const strats: Record<string, Strat> = {
  none: () => ZERO_DECISION,
  balanced15: (c, r) => split(Math.min(c, c * 0.15), [1, 1, 1, 1]),
  balanced_front: (c, r) => (r <= 5 ? split(Math.min(c, 1600), [1, 1, 1, 1]) : ZERO_DECISION),
  front_mq: (c, r) => (r <= 4 ? split(Math.min(c, 1600), [3, 2, 2, 1]) : ZERO_DECISION),
  mkt_only: (c, r) => (r <= 5 ? split(Math.min(c, 1500), [1, 0, 0, 0]) : ZERO_DECISION),
  qual_only: (c, r) => (r <= 5 ? split(Math.min(c, 1500), [0, 1, 0, 0]) : ZERO_DECISION),
  exp_heavy: (c, r) => (r <= 4 ? split(Math.min(c, 2000), [1, 1, 1, 4]) : ZERO_DECISION),
  allin: (c) => split(c, [1, 1, 1, 1]),
  allin_early: (c, r) => (r <= 2 ? split(c, [1, 1, 1, 1]) : ZERO_DECISION),
  always_bal30: (c) => split(c * 0.3, [1, 1, 1, 1]),
};
function run(bid: string, strat: Strat, seed: string, key = "t") {
  const b = BUSINESSES.find((x) => x.id === bid)!;
  let s: TeamState = initialState(b);
  for (let r = 1; r <= 8; r++) {
    const d = strat(Math.max(0, s.cash), r);
    const res = simulateRound(b, s, d, eventForRound(seed, r), r, seed, key);
    s = res.next;
  }
  return s.netEarnings;
}
const seeds = Array.from({ length: 40 }, (_, i) => "seed" + i);
console.log("business".padEnd(12), Object.keys(strats).map((k) => k.slice(0, 9).padStart(9)).join(" "));
const totals: Record<string, number[]> = {};
for (const b of BUSINESSES) {
  const row = Object.entries(strats).map(([k, st]) => {
    const avg = seeds.reduce((a, sd) => a + run(b.id, st, sd), 0) / seeds.length;
    (totals[k] ??= []).push(avg);
    return Math.round(avg).toString().padStart(9);
  });
  console.log(b.id.padEnd(12), row.join(" "));
}
console.log("MEAN".padEnd(12), Object.keys(strats).map((k) => Math.round(totals[k].reduce((a, b) => a + b, 0) / 10).toString().padStart(9)).join(" "));
