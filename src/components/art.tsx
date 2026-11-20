import { useEffect, useMemo, useRef, useState } from "react";
import { bizInfo } from "../lib/catalog";
import { signed } from "../lib/format";

const PAL: Record<string, string> = {
  k: "#150b2e", w: "#ffffff", r: "#e63946", y: "#ffd23f", o: "#ff8a3d", b: "#8d5524", g: "#3ddc84", c: "#35d0ff",
  p: "#ff5fa2", u: "#7b2ff7", n: "#f1c27d", e: "#9aa0b4", d: "#4361ee", l: "#c8a96a",
};

export function Grid({ rows, size = 4, className = "" }: { rows: string[]; size?: number; className?: string }) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const rects: JSX.Element[] = [];
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== "." && PAL[ch]) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={PAL[ch]} />); }));
  return <svg className={`px ${className}`} viewBox={`0 0 ${w} ${h}`} width={w * size} height={h * size} aria-hidden>{rects}</svg>;
}

// 8x8 emblems
const EMBLEM: Record<string, string[]> = {
  pizza: ["oooooooo", "orooyoro", ".oroyro.", ".ooyoro.", "..orro..", "..oyoo..", "...oo...", "...o...."],
  coffee: ["..e..e..", "...e..e.", "wwwwww..", "wbbbbwww", "wbbbbw.w", "wbbbbwww", ".wwwww..", "wwwwwwww"],
  videogame: [".eeeeee.", "eeeeeeee", "ekeeeyoe", "kkkeeoye", "ekeeeyoe", "eeeeeeee", "ee.ee.ee", "e..ee..e"],
  clothing: ["pp....pp", "ppp..ppp", "pppppppp", ".pwppwp.", ".pppppp.", ".pppppp.", ".pppppp.", ".pppppp."],
  foodtruck: ["..oooooo", ".oooooow", "oooooocw", "ooyyoooo", "oooooooo", "kkooookk", ".kk.o.kk", "..k...k."],
  tech: ["..cccc..", ".cccccc.", "cckkkkcc", "ckcccckc", "ckccddkc", "cckkkkcc", ".cccccc.", "wwwwwwww"],
  pet: ["pp.pp.pp", "pp.pp.pp", "...pp...", ".pppppp.", "pppppppp", "pppppppp", ".pppppp.", "..pppp.."],
  fitness: ["k......k", "kk.kk.kk", "kkkkkkkk", "kkkkkkkk", "kk.kk.kk", "k......k", "........", "........"],
  arcade: [".dddddd.", "dddddddd", "dwwwwwwd", "dwkkkkwd", "dwkrrkwd", "dwkkkkwd", "dddyydgd", "dddddddd"],
  landscaping: ["..gggg..", ".gggggg.", "gggggggg", ".gggggg.", "..gggg..", "...bb...", "...bb...", "..bbbb.."],
};

export function Emblem({ id, size = 4 }: { id: string; size?: number }) {
  return <Grid rows={EMBLEM[id] ?? EMBLEM.pizza} size={size} />;
}

/** Procedural storefront; `level` (0-4) grows the building (floors, annex, flag, lights). */
export function Storefront({ id, level = 0, width = 96, glow = false }: { id: string; level?: number; width?: number; glow?: boolean }) {
  const b = bizInfo(id);
  const floors = 1 + Math.floor(level / 2);
  const top = 30 - 8 * (floors - 1);
  const annex = level % 2 === 1 || level >= 4;
  const els: JSX.Element[] = [];
  let k = 0;
  const R = (x: number, y: number, w: number, h: number, fill: string) => els.push(<rect key={k++} x={x} y={y} width={w} height={h} fill={fill} />);
  // ground shadow & sidewalk
  R(0, 42, 32, 2, "#5a4a7a");
  // annex
  if (annex) { R(26, 33, 5, 9, "#d9c49a"); R(26, 32, 5, 1, "#150b2e"); R(27, 36, 3, 3, "#35d0ff"); }
  // body
  R(2, top, 24, 42 - top, "#f6ead0");
  R(2, top, 1, 42 - top, "#d9c49a"); R(25, top, 1, 42 - top, "#d9c49a");
  // roof
  R(1, top - 2, 26, 2, "#150b2e"); R(1, top - 2, 26, 1, b.color);
  // upper floor windows
  for (let f = 1; f < floors; f++) {
    const y = 30 - 8 * f + 2;
    [5, 12, 19].forEach((x, i) => { R(x, y, 5, 4, "#150b2e"); R(x + 1, y + 1, 3, 2, (i + f) % 2 ? "#ffd23f" : "#35d0ff"); });
  }
  // awning stripes
  for (let i = 0; i < 8; i++) R(2 + i * 3, 30, 3, 3, i % 2 ? "#ffffff" : b.color);
  R(2, 33, 24, 1, "#150b2e");
  // windows + door
  R(4, 35, 7, 5, "#150b2e"); R(5, 36, 5, 3, "#8ee8ff"); R(5, 36, 2, 1, "#ffffff");
  R(17, 35, 7, 5, "#150b2e"); R(18, 36, 5, 3, "#8ee8ff"); R(18, 36, 2, 1, "#ffffff");
  R(12, 35, 4, 7, "#150b2e"); R(13, 36, 2, 6, "#8d5524"); R(14, 39, 1, 1, "#ffd23f");
  // billboard sign with emblem
  R(13, top - 5, 2, 3, "#150b2e");
  R(8, top - 15, 12, 10, "#150b2e"); R(9, top - 14, 10, 8, b.color2 === "#ffffff" ? "#f6ead0" : b.color2);
  // flag & lights by level
  if (level >= 3) { R(24, top - 8, 1, 6, "#150b2e"); R(25, top - 8, 4, 3, b.color); }
  if (level >= 4) for (let i = 0; i < 8; i++) R(3 + i * 3, 34, 1, 1, i % 2 ? "#ffd23f" : "#ff5fa2");
  return (
    <div className={`relative inline-block ${glow ? "anim-glow" : ""}`} style={{ width }}>
      <svg className="px block" viewBox="0 0 32 44" width={width} height={(width * 44) / 32} aria-hidden>{els}</svg>
      <div className="absolute" style={{ left: `${(10 / 32) * 100}%`, top: `${((top - 14) / 44) * 100}%`, width: `${(8 / 32) * 100}%` }}>
        <Emblem id={id} size={(width * 8) / 32 / 8} />
      </div>
    </div>
  );
}

/** Small icon tile for lists. */
export function BizIcon({ id, size = 40 }: { id: string; size?: number }) {
  const b = bizInfo(id);
  return (
    <div className="shrink-0 flex items-center justify-center" style={{ width: size, height: size, background: b.color, border: "3px solid #0b0520", boxShadow: "inset 3px 3px 0 rgba(255,255,255,.35), inset -3px -3px 0 rgba(0,0,0,.3)" }}>
      <Emblem id={id} size={Math.floor((size - 6) / 8)} />
    </div>
  );
}

const WALKER = ["..kk..", ".knnk.", ".kkkk.", "kccccK", ".cccc.", ".k..k."];
function Walker({ shirt, skin }: { shirt: string; skin: string }) {
  const rows = ["..hh..", ".ssss.", "..ss..", ".tttt.", ".tttt.", ".l..l."];
  const map: Record<string, string> = { h: "#3a2a1a", s: skin, t: shirt, l: "#150b2e" };
  return (
    <svg className="px" viewBox="0 0 6 6" width={18} height={18} aria-hidden>
      {rows.flatMap((r, y) => [...r].map((c, x) => (c === "." ? null : <rect key={`${x}${y}`} x={x} y={y} width={1} height={1} fill={map[c]} />)))}
    </svg>
  );
}
void WALKER;

/** Animated customers strolling along the street. */
export function Walkers({ count, seed = 1 }: { count: number; seed?: number }) {
  const n = Math.max(0, Math.min(count, 14));
  const people = useMemo(() => Array.from({ length: n }, (_, i) => {
    const r = (Math.sin((i + 1) * 91.7 + seed * 13.1) + 1) / 2;
    const shirts = ["#ff5fa2", "#35d0ff", "#ffd23f", "#3ddc84", "#ff8a3d", "#9b6bff"];
    return { shirt: shirts[i % shirts.length], skin: ["#f1c27d", "#c68642", "#8d5524", "#ffdbac"][i % 4], dur: 9 + r * 9, delay: -r * 14, top: (i % 3) * 5 };
  }), [n, seed]);
  return (
    <div className="absolute inset-x-0 bottom-0 h-8 overflow-hidden pointer-events-none">
      {people.map((p, i) => (
        <div key={i} className="absolute left-0" style={{ bottom: p.top, animation: `walk ${p.dur}s linear ${p.delay}s infinite`, width: "100%" }}>
          <div className="anim-bob" style={{ animationDelay: `${i * 0.13}s`, display: "inline-block" }}><Walker shirt={p.shirt} skin={p.skin} /></div>
        </div>
      ))}
    </div>
  );
}

export function Coin({ size = 18 }: { size?: number }) {
  return (
    <span className="coin-spin inline-block align-middle" style={{ width: size, height: size }}>
      <Grid size={size / 6} rows={[".kkkk.", "kyyyyk", "kywyyk", "kyyyyk", "kyyyyk", ".kkkk."]} />
    </span>
  );
}

export function Trophy({ size = 6 }: { size?: number }) {
  return (
    <Grid size={size} className="anim-glow" rows={[
      "kkkkkkkkkkkk", "kyyyyyyyyyyk", "kywyyyyyyyyk", "kykyyyyyyyky", ".kkyyyyyykk.", "...kyyyyk...", "....kyyk....", "....kyyk....", "...kkyykk...", "..kyyyyyyk..", "..kkkkkkkk..",
    ]} />
  );
}

/** Animated count-up money (or number) with green/red flash on change. */
export function Money({ value, signedMode = false, className = "", prefix = "" }: { value: number; signedMode?: boolean; className?: string; prefix?: string }) {
  const [shown, setShown] = useState(value);
  const [flash, setFlash] = useState("");
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    if (from === value) return;
    setFlash(value > from ? "flash-green" : "flash-red");
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 900);
      setShown(Math.round(from + (value - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    prev.current = value;
    const ft = setTimeout(() => setFlash(""), 1000);
    return () => { cancelAnimationFrame(raf); clearTimeout(ft); };
  }, [value]);
  const text = signedMode ? signed(shown) : (shown < 0 ? "-$" : "$") + Math.abs(shown).toLocaleString("en-US");
  const color = signedMode ? (shown > 0 ? "text-mint" : shown < 0 ? "text-ruby" : "text-white") : shown < 0 ? "text-ruby" : "";
  return <span className={`${color} ${flash} px-1 ${className}`}>{prefix}{text}</span>;
}

/** Floating "+$123" bubble that appears whenever `value` changes (not on first render). */
export function FloatDelta({ value, id }: { value: number | null | undefined; id: string | number }) {
  const [show, setShow] = useState<{ v: number; k: string } | null>(null);
  const prev = useRef<string | number | null>(null);
  useEffect(() => {
    if (value == null) return;
    if (prev.current !== null && prev.current !== id) {
      setShow({ v: value, k: String(id) });
      const t = setTimeout(() => setShow(null), 1900);
      prev.current = id;
      return () => clearTimeout(t);
    }
    prev.current = id;
  }, [id, value]);
  if (!show) return null;
  return (
    <span key={show.k} className={`float-up absolute font-pixel text-xs z-20 text-shadow-px ${show.v >= 0 ? "text-mint" : "text-ruby"}`} style={{ right: 4, top: -6 }}>
      {show.v >= 0 ? "🪙 " : ""}{signed(show.v)}
    </span>
  );
}

/** Pixel city background that develops as the game progresses (stage 0-8). */
export function CityBackground({ stage = 0 }: { stage?: number }) {
  const buildings = useMemo(() => {
    const out: { x: number; w: number; h: number; at: number; c: string }[] = [];
    let x = 0, i = 0;
    const cols = ["#2d1f66", "#35267a", "#2a1b5e", "#3d2d8a"];
    while (x < 200) {
      const r = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const rr = Math.abs(r);
      const w = 8 + Math.floor(rr * 10);
      const h = 10 + Math.floor(Math.abs(Math.sin(i * 7.1)) * 26);
      out.push({ x, w, h, at: i % 8, c: cols[i % cols.length] });
      x += w + 1; i++;
    }
    return out;
  }, []);
  const lit = (stage / 8);
  return (
    <div className="fixed inset-0 -z-0 overflow-hidden pointer-events-none" aria-hidden>
      <div className="absolute inset-0" style={{ background: "linear-gradient(#150b2e 0%, #2d1b69 35%, #6b3fa0 62%, #ff7a8a 85%, #ffc46b 100%)" }} />
      {/* stars */}
      {Array.from({ length: 28 }).map((_, i) => (
        <span key={i} className="absolute bg-white" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 42}%`, width: 3, height: 3, animation: `twinkle ${2 + (i % 4)}s steps(2) ${i % 5}s infinite` }} />
      ))}
      {/* moon */}
      <div className="absolute" style={{ right: "9%", top: "7%", width: 54, height: 54, background: "#fff3c4", boxShadow: "inset -10px -10px 0 #f0d98a, 0 0 0 4px rgba(255,243,196,.25)" }} />
      {/* clouds */}
      {[0, 1, 2].map((i) => (
        <div key={i} className="absolute" style={{ top: `${10 + i * 11}%`, animation: `cloud ${70 + i * 25}s linear ${-i * 30}s infinite`, opacity: 0.35 }}>
          <div style={{ width: 90, height: 18, background: "#fff", boxShadow: "18px -12px 0 #fff, 48px -8px 0 #fff, 30px -22px 0 #fff" }} />
        </div>
      ))}
      {/* skyline */}
      <svg className="px absolute bottom-0 left-0 w-full" style={{ height: "42%" }} viewBox="0 0 200 40" preserveAspectRatio="xMidYMax slice">
        {buildings.map((b, i) => {
          const shown = b.at <= stage + 1;
          const h = shown ? b.h : 3;
          return (
            <g key={i} style={{ transition: "all 1s steps(8)" }}>
              <rect x={b.x} y={40 - h - 5} width={b.w} height={h} fill={shown ? b.c : "#241752"} />
              {shown && Array.from({ length: Math.floor(h / 4) }).map((_, wy) => Array.from({ length: Math.floor((b.w - 2) / 3) }).map((__, wx) => ((wx * 7 + wy * 3 + i) % 4 < 2 + lit * 2 ? <rect key={`${wx}-${wy}`} x={b.x + 1 + wx * 3} y={40 - h - 4 + wy * 4} width={1.5} height={1.5} fill="#ffd23f" opacity={0.85} /> : null)))}
            </g>
          );
        })}
        <rect x={0} y={35} width={200} height={5} fill="#1b1040" />
        <rect x={0} y={37} width={200} height={1} fill="#4a34a0" />
        {Array.from({ length: Math.min(8, stage + 1) }).map((_, i) => (
          <g key={`t${i}`}><rect x={6 + i * 25} y={30} width={2} height={5} fill="#5a3a1a" /><rect x={4 + i * 25} y={26} width={6} height={5} fill="#2d9d4a" /></g>
        ))}
      </svg>
    </div>
  );
}

export function Confetti({ count = 40 }: { count?: number }) {
  const cols = ["#ffd23f", "#ff5fa2", "#35d0ff", "#3ddc84", "#ff8a3d", "#9b6bff"];
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-40" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="absolute" style={{ left: `${(i * 97) % 100}%`, top: 0, width: 8 + (i % 3) * 4, height: 8 + (i % 3) * 4, background: cols[i % cols.length], animation: `confetti ${4 + (i % 5)}s linear ${(i % 10) * 0.5}s infinite` }} />
      ))}
    </div>
  );
}

export function Logo({ size = "lg" }: { size?: "sm" | "lg" | "xl" }) {
  const cls = size === "xl" ? "text-4xl md:text-6xl" : size === "lg" ? "text-2xl md:text-4xl" : "text-base";
  return (
    <div className={`font-pixel ${cls} text-gold text-shadow-px leading-tight`} style={{ textShadow: "4px 4px 0 #b3203d, 8px 8px 0 #0b0520" }}>
      PIXEL <span className="text-bubble">EMPIRE</span>
    </div>
  );
}
