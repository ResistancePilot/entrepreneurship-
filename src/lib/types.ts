export type Status = "lobby" | "open" | "results" | "finished";
export interface GameEvent { id: string; name: string; icon: string; tagline: string; description: string }
export interface FinalTeam {
  id: string; name: string; business: string; cash: number; netEarnings: number; totalRevenue: number;
  totalCustomers: number; totalInvested: number; cumProfit: number;
}
export interface FinalSummary {
  champion: (FinalTeam & { bestRound: number; bestRoundNet: number; margin: number }) | null;
  rankings: (FinalTeam & { rank: number; bestRoundNet: number })[];
  achievements: { key: string; title: string; description: string; teamId: string; teamName: string; business: string; value: string }[];
  summary: string[];
}
export interface Game {
  id: string; code: string; status: Status; round: number; totalRounds: number; roundOpenedAt: string | null;
  event: GameEvent | null; final: FinalSummary | null; version: number;
}
export interface LastRound { round: number; customers: number; revenue: number; opex: number; invested: number; eventCost: number; opProfit: number; netChange: number }
export interface Team {
  id: string; name: string; business: string; cash: number; netEarnings: number; rank: number; prevRank: number;
  submitted: boolean; last: LastRound | null;
  stats: { reputation: number; satisfaction: number; capacity: number; expLevel: number; totalRevenue: number; totalCustomers: number; totalInvested: number; cumProfit: number };
}
export interface Decision { marketing: number; quality: number; operations: number; expansion: number }
export interface RoundResultFull {
  customers: number; demand: number; capacity: number; turnedAway: number; avgSale: number; varCostPer: number; revenue: number;
  fixedCost: number; opex: number; opProfit: number; invested: number; eventCost: number; netChange: number; endCash: number;
  reputation: number; satisfaction: number; marketingCustomers: number; eventName: string; eventDemandPct: number;
}
export interface MyResult {
  round: number; eventId: string; submitted: boolean; decision: Decision; startCash: number; result: RoundResultFull;
  explanation: { headline: string; lines: string[]; lesson: string }; rank: number;
}
export interface MeResponse {
  team: Team; results: MyResult[]; decision: Decision | null;
  eventForYou: { demand: number; varCost: number; fixed: number; flat: number } | null;
}
export interface StateResponse { game: Game; teams: Team[]; serverTime: number }
