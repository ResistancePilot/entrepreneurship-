export const usd = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US");
export const signed = (n: number) => (n > 0 ? "+" : n < 0 ? "-" : "") + "$" + Math.abs(Math.round(n)).toLocaleString("en-US");
export const tone = (n: number) => (n > 0 ? "text-mint" : n < 0 ? "text-ruby" : "text-white");
export const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
