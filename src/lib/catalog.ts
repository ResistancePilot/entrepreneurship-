// Display info for the 10 businesses (numbers live server-side in the engine).
export interface BizInfo { id: string; name: string; strength: string; weakness: string; color: string; color2: string; blurb: string }
export const BIZ: BizInfo[] = [
  { id: "pizza", name: "Pizza Shop", strength: "Reliable demand", weakness: "High ingredient costs", color: "#e63946", color2: "#ffd23f", blurb: "Steady hungry crowds, thin margins." },
  { id: "coffee", name: "Coffee Shop", strength: "Repeat customers", weakness: "Heavy competition", color: "#8d5524", color2: "#f1c27d", blurb: "Loyal regulars love quality." },
  { id: "videogame", name: "Video Game Studio", strength: "High profit potential", weakness: "Unpredictable sales", color: "#7b2ff7", color2: "#35d0ff", blurb: "Hit or flop. Big upside." },
  { id: "clothing", name: "Clothing Brand", strength: "Strong marketing potential", weakness: "Inventory risk", color: "#ff5fa2", color2: "#ffffff", blurb: "Hype sells. Stock costs." },
  { id: "foodtruck", name: "Food Truck", strength: "Low overhead", weakness: "Weather sensitivity", color: "#ff8a3d", color2: "#3ddc84", blurb: "Lean and mobile; storms hurt." },
  { id: "tech", name: "Tech Startup", strength: "Scalable growth", weakness: "Expensive development", color: "#35d0ff", color2: "#1f1347", blurb: "Fast growth, big payroll." },
  { id: "pet", name: "Pet Grooming", strength: "Loyal customers", weakness: "Limited capacity", color: "#3ddc84", color2: "#ffd1e8", blurb: "Happy pets, tiny schedule." },
  { id: "fitness", name: "Fitness Studio", strength: "Recurring memberships", weakness: "High fixed costs", color: "#4361ee", color2: "#ffd23f", blurb: "Steady members, big rent." },
  { id: "arcade", name: "Arcade", strength: "Strong entertainment appeal", weakness: "Equipment costs", color: "#b5179e", color2: "#ffd23f", blurb: "Fun sells; machines break." },
  { id: "landscaping", name: "Landscaping Company", strength: "Good contract revenue", weakness: "Seasonal demand", color: "#2d9d4a", color2: "#c8a96a", blurb: "Big jobs, summer peaks." },
];
export const bizInfo = (id: string): BizInfo => BIZ.find((b) => b.id === id) ?? BIZ[0];

export const CATEGORIES = [
  { key: "marketing", label: "MARKETING", color: "#ff5fa2", icon: "📣", benefit: "Attracts more customers right now, with a small afterglow next month.", risk: "Extra customers are wasted if you lack capacity. Returns shrink fast." },
  { key: "quality", label: "QUALITY", color: "#3ddc84", icon: "⭐", benefit: "Builds reputation: more repeat demand, happier customers, higher prices.", risk: "Slow to build, and reputation fades if you stop investing." },
  { key: "operations", label: "OPERATIONS", color: "#35d0ff", icon: "⚙️", benefit: "Adds capacity right away and permanently lowers cost per customer.", risk: "Bigger operations raise overhead. Useless if demand is already low." },
  { key: "expansion", label: "EXPANSION", color: "#ffd23f", icon: "🏗️", benefit: "Grows demand and capacity from NEXT month onward, for the long run.", risk: "Pays back slowly. Late-game expansion rarely earns its money back." },
] as const;
