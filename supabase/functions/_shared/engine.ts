// PIXEL EMPIRE simulation engine.
// Pure, deterministic TypeScript: no Deno / Node / DB imports, so it runs in Edge Functions and in tests.

export const ROUNDS = 8;
export const START_CASH = 10000;

export type Tag = "food" | "retail" | "service" | "digital" | "entertainment" | "outdoor" | "local";

export interface Decision {
  marketing: number;
  quality: number;
  operations: number;
  expansion: number;
}
export const ZERO_DECISION: Decision = { marketing: 0, quality: 0, operations: 0, expansion: 0 };

export interface Business {
  id: string;
  name: string;
  tags: Tag[];
  demand: number; // starting monthly customer demand
  capacity: number; // starting monthly capacity
  price: number; // average sale value per customer
  varCost: number; // variable cost per customer
  fixed: number; // monthly fixed overhead
  growth: number; // organic monthly demand growth
  volatility: number; // demand noise
  skewed?: boolean; // hit-or-miss demand (still mean ~1)
  season?: number[]; // optional monthly demand multipliers (rounds 1-8)
  mkt: number; // effectiveness multipliers for each investment
  qual: number;
  ops: number;
  exp: number;
}

// Tuned with tests/engine.test.ts (balance simulation). Every business earns roughly $2.4k/month at baseline.
export const BUSINESSES: Business[] = [
  { id: "pizza", name: "Pizza Shop", tags: ["food", "local"], demand: 640, capacity: 720, price: 19, varCost: 9.5, fixed: 3600, growth: 0.012, volatility: 0.04, mkt: 1.0, qual: 1.0, ops: 1.0, exp: 1.0 },
  { id: "coffee", name: "Coffee Shop", tags: ["food", "local"], demand: 1200, capacity: 1340, price: 7.5, varCost: 2.5, fixed: 3500, growth: 0.015, volatility: 0.04, mkt: 0.9, qual: 1.2, ops: 1.0, exp: 1.0 },
  { id: "videogame", name: "Video Game Studio", tags: ["digital"], demand: 158, capacity: 178, price: 70, varCost: 20, fixed: 5000, growth: 0.02, volatility: 0.26, skewed: true, mkt: 1.1, qual: 1.1, ops: 0.9, exp: 1.1 },
  { id: "clothing", name: "Clothing Brand", tags: ["retail"], demand: 300, capacity: 335, price: 45, varCost: 24, fixed: 3800, growth: 0.012, volatility: 0.08, mkt: 1.3, qual: 1.0, ops: 0.9, exp: 1.0 },
  { id: "foodtruck", name: "Food Truck", tags: ["food", "outdoor"], demand: 700, capacity: 785, price: 13, varCost: 5.5, fixed: 2700, growth: 0.012, volatility: 0.07, mkt: 1.05, qual: 1.0, ops: 1.1, exp: 1.0 },
  { id: "tech", name: "Tech Startup", tags: ["digital"], demand: 92, capacity: 103, price: 120, varCost: 40, fixed: 5300, growth: 0.03, volatility: 0.12, mkt: 1.0, qual: 1.0, ops: 0.85, exp: 1.25 },
  { id: "pet", name: "Pet Grooming", tags: ["service", "local"], demand: 170, capacity: 186, price: 50, varCost: 15, fixed: 3450, growth: 0.012, volatility: 0.04, mkt: 1.0, qual: 1.35, ops: 0.85, exp: 0.9 },
  { id: "fitness", name: "Fitness Studio", tags: ["service"], demand: 230, capacity: 258, price: 40, varCost: 8, fixed: 5000, growth: 0.015, volatility: 0.05, mkt: 1.05, qual: 1.1, ops: 1.0, exp: 1.0 },
  { id: "arcade", name: "Arcade", tags: ["entertainment"], demand: 600, capacity: 670, price: 14, varCost: 4, fixed: 3500, growth: 0.012, volatility: 0.09, mkt: 1.1, qual: 1.0, ops: 0.9, exp: 1.0 },
  { id: "landscaping", name: "Landscaping Company", tags: ["outdoor", "service"], demand: 85, capacity: 95, price: 160, varCost: 80, fixed: 4400, growth: 0.012, volatility: 0.07, season: [0.8, 0.95, 1.1, 1.2, 1.2, 1.1, 0.95, 0.8], mkt: 1.0, qual: 1.0, ops: 1.1, exp: 1.0 },
];

export function getBusiness(id: string): Business | undefined {
  return BUSINESSES.find((b) => b.id === id);
}

// ---------- Events ----------
export interface EventEffect {
  demand: number; // additive change to demand multiplier (0.2 = +20%)
  varCost: number; // fractional change to variable cost
  fixed: number; // fractional change to fixed overhead
  flat: number; // one-off event cost in dollars
}
export interface MarketEvent {
  id: string;
  name: string;
  icon: string;
  tagline: string;
  description: string;
  base: Partial<EventEffect>;
  byTag: Partial<Record<Tag, Partial<EventEffect>>>;
}

export const EVENTS: MarketEvent[] = [
  { id: "viral", name: "Viral Social Media Trend", icon: "📱", tagline: "IT'S TRENDING!", description: "A clip goes viral. Online and trendy brands surge; everyone gets a little buzz.",
    base: { demand: 0.1 }, byTag: { digital: { demand: 0.28 }, retail: { demand: 0.22 }, food: { demand: 0.06 } } },
  { id: "slowdown", name: "Economic Slowdown", icon: "📉", tagline: "BELT-TIGHTENING!", description: "Shoppers cut back on extras. Luxuries and entertainment feel it most.",
    base: { demand: -0.1 }, byTag: { entertainment: { demand: -0.1 }, retail: { demand: -0.08 }, digital: { demand: -0.04 }, food: { demand: 0.04 } } },
  { id: "supply", name: "Supply Chain Disruption", icon: "🚚", tagline: "SHELVES RUNNING EMPTY!", description: "Deliveries are late and ingredients cost more. Goods-based businesses pay extra.",
    base: { varCost: 0.07 }, byTag: { food: { varCost: 0.14, flat: 200 }, retail: { varCost: 0.16, flat: 250 }, digital: { varCost: -0.05 } } },
  { id: "festival", name: "Local Festival", icon: "🎪", tagline: "TOWN PARTY!", description: "The streets fill with visitors looking for food and fun.",
    base: { demand: 0.06 }, byTag: { food: { demand: 0.2 }, entertainment: { demand: 0.22 }, local: { demand: 0.06 }, digital: { demand: -0.03 } } },
  { id: "competitor", name: "New Competitor Opens", icon: "🏪", tagline: "RIVAL SPOTTED!", description: "A competitor opens down the street. Local businesses lose customers.",
    base: { demand: -0.04 }, byTag: { local: { demand: -0.12 }, digital: { demand: 0.02 } } },
  { id: "labor", name: "Rising Labor Costs", icon: "💼", tagline: "WAGES GO UP!", description: "Everybody wants a raise. Overhead climbs, especially in service businesses.",
    base: { fixed: 0.06 }, byTag: { service: { fixed: 0.1 }, digital: { fixed: 0.06 } } },
  { id: "boom", name: "Consumer Spending Boom", icon: "💰", tagline: "WALLETS OPEN!", description: "Confidence is high and people are spending. Retail and fun lead the way.",
    base: { demand: 0.1 }, byTag: { retail: { demand: 0.14 }, entertainment: { demand: 0.14 }, digital: { demand: 0.06 } } },
  { id: "weather", name: "Severe Weather", icon: "⛈️", tagline: "STORM WARNING!", description: "Storms keep people home and damage outdoor equipment.",
    base: { demand: -0.02 }, byTag: { outdoor: { demand: -0.24, flat: 450 }, food: { demand: -0.04 }, digital: { demand: 0.06 } } },
  { id: "tech", name: "Technology Breakthrough", icon: "🔬", tagline: "NEW TECH UNLOCKED!", description: "A breakthrough makes digital products hotter and cheaper to deliver.",
    base: {}, byTag: { digital: { demand: 0.2, varCost: -0.08 }, entertainment: { demand: 0.06 } } },
  { id: "influencer", name: "Influencer Endorsement", icon: "🌟", tagline: "A STAR LIKES YOU!", description: "A big influencer raves about local favorites. Trendy brands benefit.",
    base: { demand: 0.07 }, byTag: { retail: { demand: 0.14 }, food: { demand: 0.08 }, service: { demand: 0.05 } } },
  { id: "wellness", name: "Health & Wellness Craze", icon: "🏃", tagline: "EVERYONE'S WORKING OUT!", description: "A health kick sweeps the town. Service and active businesses benefit.",
    base: {}, byTag: { service: { demand: 0.16 }, outdoor: { demand: 0.08 }, food: { demand: -0.03 }, entertainment: { demand: -0.05 } } },
  { id: "utility", name: "Utility Rate Hike", icon: "⚡", tagline: "POWER BILLS SPIKE!", description: "Energy prices jump, raising fixed costs for everyone.",
    base: { fixed: 0.09, flat: 150 }, byTag: { entertainment: { fixed: 0.07 }, digital: { fixed: 0.03 } } },
];

export function getEvent(id: string | null | undefined): MarketEvent | undefined {
  return EVENTS.find((e) => e.id === id);
}

export function eventEffectFor(event: MarketEvent, tags: Tag[]): EventEffect {
  const out: EventEffect = { demand: 0, varCost: 0, fixed: 0, flat: 0 };
  const add = (p?: Partial<EventEffect>) => {
    if (!p) return;
    out.demand += p.demand ?? 0;
    out.varCost += p.varCost ?? 0;
    out.fixed += p.fixed ?? 0;
    out.flat += p.flat ?? 0;
  };
  add(event.base);
  for (const t of tags) add(event.byTag[t]);
  return out;
}

// ---------- Deterministic randomness ----------
export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One shared event per round, deterministic from the game seed; no repeats within a game. */
export function eventForRound(seed: string, round: number): MarketEvent {
  const rng = mulberry32(hashString("events|" + seed));
  const order = EVENTS.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return EVENTS[order[(round - 1) % order.length]];
}

// ---------- Simulation ----------
export interface TeamState {
  cash: number;
  baseDemand: number;
  capacity: number;
  reputation: number; // 0-100
  satisfaction: number; // 0-100
  buzz: number; // lingering marketing bonus
  opsEff: number; // cumulative variable-cost reduction (0-0.22)
  expPoints: number; // cumulative expansion (diminishes further gains)
  expLevel: number; // 0-4, for the city view
  cumProfit: number; // sum of operating profit - event costs
  netEarnings: number; // cumProfit - all investments
  totalRevenue: number;
  totalCustomers: number;
  totalInvested: number;
  totalMarketing: number;
  roundsPlayed: number;
}

export function initialState(b: Business): TeamState {
  return {
    cash: START_CASH, baseDemand: b.demand, capacity: b.capacity, reputation: 50, satisfaction: 60, buzz: 0,
    opsEff: 0, expPoints: 0, expLevel: 0, cumProfit: 0, netEarnings: 0, totalRevenue: 0, totalCustomers: 0,
    totalInvested: 0, totalMarketing: 0, roundsPlayed: 0,
  };
}

/** Diminishing returns: 0 -> 0, large -> 1. */
export const sat = (x: number, k: number) => 1 - Math.exp(-x / k);
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export const TUNING = {
  mktMax: 0.6, mktK: 1800, buzzCarry: 0.35, buzzKeep: 0.1,
  qualGain: 12, qualK: 1600, repDecay: 1.5, repNowShare: 0.4,
  opsCap: 0.22, opsK: 2000, opsEffMax: 0.2, opsEffRate: 0.35,
  expDemand: 0.22, expCap: 0.16, expK: 2500, expDamp: 0.5,
  fixedPerCap: 0.45,
};

export interface RoundResult {
  customers: number;
  demand: number; // demand actually realized (after noise, before capacity)
  capacity: number;
  turnedAway: number;
  avgSale: number;
  varCostPer: number;
  revenue: number;
  fixedCost: number;
  opex: number;
  opProfit: number;
  invested: number;
  eventCost: number;
  netChange: number; // opProfit - invested - eventCost
  endCash: number;
  reputation: number;
  satisfaction: number;
  marketingCustomers: number;
  mktBonus: number;
  eventEffect: EventEffect;
  eventDemandPct: number;
  next: TeamState;
}

export function validateDecision(d: unknown, cash: number): { ok: true; decision: Decision } | { ok: false; error: string } {
  if (typeof d !== "object" || d === null) return { ok: false, error: "Invalid decision" };
  const o = d as Record<string, unknown>;
  const out: Decision = { ...ZERO_DECISION };
  for (const k of ["marketing", "quality", "operations", "expansion"] as const) {
    const v = o[k];
    if (typeof v !== "number" || !Number.isFinite(v) || !Number.isInteger(v)) return { ok: false, error: `${k} must be a whole dollar amount` };
    if (v < 0) return { ok: false, error: `${k} cannot be negative` };
    if (v > 1_000_000) return { ok: false, error: `${k} is too large` };
    out[k] = v;
  }
  const total = out.marketing + out.quality + out.operations + out.expansion;
  if (total > Math.max(0, Math.floor(cash))) return { ok: false, error: "You cannot spend more than your available cash" };
  return { ok: true, decision: out };
}

export function simulateRound(
  b: Business, s: TeamState, d: Decision, event: MarketEvent, round: number, seed: string, teamKey: string,
): RoundResult {
  const T = TUNING;
  const ev = eventEffectFor(event, b.tags);

  const invested = d.marketing + d.quality + d.operations + d.expansion;
  const mktBonus = T.mktMax * b.mkt * sat(d.marketing, T.mktK);
  const qGain = T.qualGain * b.qual * sat(d.quality, T.qualK);
  const opsF = sat(d.operations, T.opsK) * b.ops;

  const repNow = clamp(s.reputation + T.repNowShare * qGain, 10, 100);
  const capacity = s.capacity + b.capacity * T.opsCap * opsF;
  const opsEff = s.opsEff + (T.opsEffMax - s.opsEff) * T.opsEffRate * opsF;

  // Random demand noise (deterministic per game seed / round / team).
  const rng = mulberry32(hashString(`${seed}|${round}|${teamKey}`));
  const r = rng();
  let noise: number;
  if (b.skewed) noise = r < 0.25 ? 1 + 2.2 * b.volatility : 1 - 0.7333 * b.volatility;
  else noise = 1 + b.volatility * (2 * r - 1);

  const repMult = 0.85 + 0.3 * (repNow / 100);
  const demandMult = Math.max(0.3, 1 + mktBonus + s.buzz + ev.demand);
  const seasonMult = b.season ? b.season[(round - 1) % b.season.length] : 1;
  const demand = Math.max(0, Math.round(s.baseDemand * repMult * demandMult * noise * seasonMult));
  const customers = Math.min(demand, Math.floor(capacity));
  const turnedAway = demand - customers;

  const avgSale = b.price * (0.9 + 0.2 * (repNow / 100));
  const varCostPer = b.varCost * (1 - opsEff) * (1 + ev.varCost);
  const fixedCost = Math.round(b.fixed * (1 + T.fixedPerCap * (capacity / b.capacity - 1)) * (1 + ev.fixed));

  const revenue = Math.round(customers * avgSale);
  const opex = fixedCost + Math.round(customers * varCostPer);
  const opProfit = revenue - opex;
  const eventCost = Math.round(ev.flat);
  const netChange = opProfit - invested - eventCost;
  const endCash = s.cash + netChange;

  // Customers attributable to marketing (this round's bonus + lingering buzz share of the multiplier)
  const mktShare = (mktBonus + s.buzz) / demandMult;
  const marketingCustomers = Math.round(customers * clamp(mktShare, 0, 1));

  const overload = demand > 0 ? turnedAway / demand : 0;
  const satisfaction = clamp(0.8 * repNow + 14 - 30 * overload, 0, 100);
  const repEnd = clamp(s.reputation + qGain - T.repDecay - 4 * overload, 10, 100);

  // Expansion pays off next round
  const expF = sat(d.expansion, T.expK) * b.exp / (1 + T.expDamp * s.expPoints);
  const baseDemandNext = (s.baseDemand + b.demand * T.expDemand * expF) * (1 + b.growth);
  const capacityNext = capacity + b.capacity * T.expCap * expF;
  const expPoints = s.expPoints + sat(d.expansion, T.expK);

  const cumProfit = s.cumProfit + opProfit - eventCost;
  const next: TeamState = {
    cash: endCash,
    baseDemand: baseDemandNext,
    capacity: capacityNext,
    reputation: repEnd,
    satisfaction,
    buzz: T.buzzCarry * mktBonus + T.buzzKeep * s.buzz,
    opsEff,
    expPoints,
    expLevel: Math.min(4, Math.floor(expPoints / 0.45)),
    cumProfit,
    netEarnings: cumProfit - (s.totalInvested + invested),
    totalRevenue: s.totalRevenue + revenue,
    totalCustomers: s.totalCustomers + customers,
    totalInvested: s.totalInvested + invested,
    totalMarketing: s.totalMarketing + d.marketing,
    roundsPlayed: s.roundsPlayed + 1,
  };

  return {
    customers, demand, capacity: Math.floor(capacity), turnedAway, avgSale: Math.round(avgSale * 100) / 100,
    varCostPer: Math.round(varCostPer * 100) / 100, revenue, fixedCost, opex, opProfit, invested, eventCost,
    netChange, endCash, reputation: repNow, satisfaction, marketingCustomers, mktBonus, eventEffect: ev,
    eventDemandPct: Math.round(ev.demand * 100), next,
  };
}

// ---------- Explanations (generated from actual results) ----------
export interface Explanation {
  headline: string;
  lines: string[];
  lesson: string;
}

export interface PrevSummary {
  netChange: number;
  customers: number;
  revenue: number;
  opProfit: number;
}

const usd = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US");

export function explainRound(
  b: Business, event: MarketEvent, round: number, startCash: number, d: Decision, r: RoundResult, prev: PrevSummary | null,
): Explanation {
  const lines: string[] = [];
  const demandInfo = r.turnedAway > 0
    ? `${r.demand} customers wanted to buy but you could only serve ${r.customers} (capacity ${r.capacity}).`
    : `You served ${r.customers} customers and had room for ${Math.max(0, r.capacity - r.customers)} more.`;
  lines.push(demandInfo);

  const e = r.eventEffect;
  const evBits: string[] = [];
  if (e.demand !== 0) evBits.push(`customer demand ${e.demand > 0 ? "+" : ""}${Math.round(e.demand * 100)}%`);
  if (e.varCost !== 0) evBits.push(`cost per customer ${e.varCost > 0 ? "+" : ""}${Math.round(e.varCost * 100)}%`);
  if (e.fixed !== 0) evBits.push(`overhead ${e.fixed > 0 ? "+" : ""}${Math.round(e.fixed * 100)}%`);
  if (r.eventCost > 0) evBits.push(`${usd(r.eventCost)} in one-time costs`);
  lines.push(`${event.name} hit ${b.name} with ${evBits.length ? evBits.join(", ") : "little effect"}.`);

  if (d.marketing > 0 && r.marketingCustomers > 0) {
    lines.push(`Your ${usd(d.marketing)} in marketing brought roughly ${r.marketingCustomers} extra customers.`);
  }
  if (d.quality > 0) lines.push(`Quality spending lifted your reputation to ${Math.round(r.reputation)} and your average sale to ${usd(r.avgSale)}.`);
  if (d.operations > 0) lines.push(`Operations spending raised capacity to ${r.capacity} and cut your cost per customer to $${r.varCostPer.toFixed(2)}.`);
  if (d.expansion > 0) lines.push(`Expansion of ${usd(d.expansion)} will boost demand and capacity from next month.`);
  if (prev) {
    const diff = r.netChange - prev.netChange;
    lines.push(`Monthly net earnings ${diff >= 0 ? "improved" : "fell"} by ${usd(Math.abs(diff))} vs last month (${usd(prev.netChange)} → ${usd(r.netChange)}).`);
  }

  const share = startCash > 0 ? r.invested / startCash : 0;
  const overload = r.demand > 0 ? r.turnedAway / r.demand : 0;
  let lesson: string;
  if (overload > 0.06 && d.marketing > 0) {
    lesson = `Your marketing brought in customers, but your limited capacity prevented you from serving ${r.turnedAway} of them. Consider investing in operations (or expansion) so demand doesn't go to waste.`;
  } else if (overload > 0.06) {
    lesson = `${r.turnedAway} customers were turned away because demand outgrew your capacity. Turned-away customers hurt reputation, so invest in operations or expansion.`;
  } else if (round >= 7 && r.invested >= 1500) {
    const left = ROUNDS - round;
    lesson = `You invested ${usd(r.invested)} with ${left === 0 ? "no months" : left + " month" + (left === 1 ? "" : "s")} left. Investments take time to pay back, so late spending often just lowers your net earnings.`;
  } else if (r.invested === 0 && round <= 5) {
    lesson = `You invested nothing this month. Businesses that never reinvest stall as reputation fades and competitors grow. Early investment compounds over later months.`;
  } else if (share > 0.7 && r.netChange < 0) {
    lesson = `You put ${Math.round(share * 100)}% of your cash into investments and finished the month in the red. Returns diminish: the first dollars in each category help the most, so spread spending and keep a cash cushion.`;
  } else if (r.eventCost > 0 && r.netChange < 0) {
    lesson = `A surprise event cost you ${usd(r.eventCost)}. Keeping a cash reserve lets you absorb shocks without cutting investments.`;
  } else if (r.reputation < 42) {
    lesson = `Your reputation is slipping to ${Math.round(r.reputation)}. Without quality investment customers drift away and you can't charge as much. Put some money into quality.`;
  } else if (e.demand < -0.1 && d.marketing === 0) {
    lesson = `Demand dropped ${Math.abs(Math.round(e.demand * 100))}% because of the event. In slow months marketing can help you hold on to customers.`;
  } else if (r.netChange < 0) {
    lesson = `You lost money this month even after serving ${r.customers} customers. Check whether your investment size was justified by the extra profit it could earn.`;
  } else if (r.revenue > 0 && r.opProfit / r.revenue > 0.3) {
    lesson = `A healthy ${Math.round((r.opProfit / r.revenue) * 100)}% operating margin. Keep reinvesting the money that earns the best return, and stop where returns flatten.`;
  } else {
    lesson = `A balanced month. Compare what each dollar of investment returned and move more money toward the category that helps your ${b.name} most.`;
  }

  const headline = r.netChange >= 0
    ? (prev && r.netChange > prev.netChange ? "PROFITS ARE CLIMBING!" : "SOLID MONTH!")
    : "TOUGH MONTH!";
  return { headline, lines, lesson };
}

// ---------- Ranking & final summary ----------
export interface RankTeam {
  id: string;
  name: string;
  business: string;
  netEarnings: number;
  cash: number;
}

export function rankTeams<T extends { id: string; name: string; netEarnings: number; cash: number }>(teams: T[]): T[] {
  return [...teams].sort((a, b) => b.netEarnings - a.netEarnings || b.cash - a.cash || a.name.localeCompare(b.name));
}

export interface ResultRow {
  teamId: string;
  round: number;
  decision: Decision;
  customers: number;
  revenue: number;
  opProfit: number;
  invested: number;
  eventCost: number;
  netChange: number;
  netEarnings: number; // cumulative after this round
  rank: number;
  marketingCustomers: number;
}

export interface FinalTeam {
  id: string;
  name: string;
  business: string;
  cash: number;
  netEarnings: number;
  totalRevenue: number;
  totalCustomers: number;
  totalInvested: number;
  cumProfit: number;
}

export interface FinalSummary {
  champion: (FinalTeam & { bestRound: number; bestRoundNet: number; margin: number }) | null;
  rankings: (FinalTeam & { rank: number; bestRoundNet: number })[];
  achievements: { key: string; title: string; description: string; teamId: string; teamName: string; business: string; value: string }[];
  summary: string[];
}

export function buildFinal(teams: FinalTeam[], rows: ResultRow[]): FinalSummary {
  const ranked = rankTeams(teams);
  const byTeam = new Map<string, ResultRow[]>();
  for (const r of rows) byTeam.set(r.teamId, [...(byTeam.get(r.teamId) ?? []), r].sort((a, b) => a.round - b.round));
  const best = (id: string) => {
    const rs = byTeam.get(id) ?? [];
    let bestR = { round: 0, net: 0 };
    rs.forEach((r, i) => { if (i === 0 || r.netChange > bestR.net) bestR = { round: r.round, net: r.netChange }; });
    return bestR;
  };
  const rankings = ranked.map((t, i) => ({ ...t, rank: i + 1, bestRoundNet: best(t.id).net }));
  const bizName = (id: string) => getBusiness(id)?.name ?? id;
  const champ = ranked[0];
  const margin = (t: FinalTeam) => (t.totalRevenue > 0 ? t.cumProfit / t.totalRevenue : -1);
  const ach: FinalSummary["achievements"] = [];
  const give = (key: string, title: string, description: string, t: FinalTeam | undefined, value: string) => {
    if (t) ach.push({ key, title, description, teamId: t.id, teamName: t.name, business: t.business, value });
  };
  const maxBy = <T,>(arr: T[], f: (x: T) => number) => arr.length ? arr.reduce((a, b) => (f(b) > f(a) ? b : a)) : undefined;
  const usdS = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US");

  give("profit_king", "PROFIT KING", "Highest Net Earnings", champ, usdS(champ?.netEarnings ?? 0));
  const cm = maxBy(teams, (t) => t.totalCustomers);
  give("customer_magnet", "CUSTOMER MAGNET", "Most customers served", cm, `${cm?.totalCustomers.toLocaleString("en-US")} customers`);
  const mm = maxBy(teams, (t) => (byTeam.get(t.id) ?? []).reduce((a, r) => a + r.marketingCustomers, 0));
  const mmVal = mm ? (byTeam.get(mm.id) ?? []).reduce((a, r) => a + r.marketingCustomers, 0) : 0;
  if (mm && mmVal > 0) give("marketing_master", "MARKETING MASTER", "Most customers won through marketing", mm, `${mmVal.toLocaleString("en-US")} marketing customers`);
  const ee = maxBy(teams.filter((t) => t.totalRevenue > 0), margin);
  give("efficiency_expert", "EFFICIENCY EXPERT", "Best operating margin", ee, ee ? `${Math.round(margin(ee) * 100)}% margin` : "");
  let ck: { t: FinalTeam; gain: number } | undefined;
  for (const t of teams) {
    const rs = byTeam.get(t.id) ?? [];
    if (!rs.length) continue;
    const worst = Math.max(...rs.map((r) => r.rank));
    const final = rankings.find((x) => x.id === t.id)!.rank;
    const gain = worst - final;
    if (gain > 0 && (!ck || gain > ck.gain)) ck = { t, gain };
  }
  if (ck) give("comeback_kid", "COMEBACK KID", "Biggest improvement in ranking", ck.t, `Up ${ck.gain} place${ck.gain === 1 ? "" : "s"}`);

  const summary: string[] = [];
  let championOut: FinalSummary["champion"] = null;
  if (champ) {
    const b = best(champ.id);
    championOut = { ...champ, bestRound: b.round, bestRoundNet: b.net, margin: margin(champ) };
    const rs = byTeam.get(champ.id) ?? [];
    const sum = (k: keyof Decision) => rs.reduce((a, r) => a + r.decision[k], 0);
    const cats = { Marketing: sum("marketing"), Quality: sum("quality"), Operations: sum("operations"), Expansion: sum("expansion") };
    const total = Object.values(cats).reduce((a, b) => a + b, 0);
    const top = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    const early = rs.filter((r) => r.round <= 4).reduce((a, r) => a + r.invested, 0);
    const late = rs.filter((r) => r.round > 4).reduce((a, r) => a + r.invested, 0);
    summary.push(`${champ.name} (${bizName(champ.business)}) won with ${usdS(champ.netEarnings)} in net earnings and ${usdS(champ.cash)} cash.`);
    if (total > 0) {
      summary.push(`They invested ${usdS(total)} in total, led by ${top[0][0]} (${usdS(top[0][1])}, ${Math.round((top[0][1] / total) * 100)}%) followed by ${top[1][0]} (${usdS(top[1][1])}).`);
      if (early > late * 1.5) summary.push(`Their spending was front-loaded (${usdS(early)} in months 1-4 vs ${usdS(late)} in months 5-8), giving investments time to pay back.`);
      else if (late > early * 1.5) summary.push(`They spent more in the late game (${usdS(late)} in months 5-8), a risky pattern that still paid off for them.`);
      else summary.push(`They spread investment evenly across the game (${usdS(early)} early, ${usdS(late)} late).`);
    } else {
      summary.push("They barely reinvested and relied on steady operations to win.");
    }
    summary.push(`Their best month was month ${b.round} with ${usdS(b.net)}, and their operating margin was ${Math.round(margin(champ) * 100)}%.`);
    summary.push("Lesson: winning teams invest early, stop when returns diminish, keep capacity in line with demand, and keep a cash cushion for surprise events.");
  }
  return { champion: championOut, rankings, achievements: ach, summary };
}
