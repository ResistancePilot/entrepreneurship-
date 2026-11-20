import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { BIZ } from "../lib/catalog";
import { lastTeamCode, loadTeam, saveTeam, setLastTeamCode } from "../lib/storage";
import { CityBackground, Logo, Storefront } from "../components/art";
import { Label, Panel } from "../components/ui";

export default function Landing() {
  const nav = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [biz, setBiz] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const saved = lastTeamCode();
  const savedSession = saved ? loadTeam(saved) : null;

  const next = async () => {
    setErr("");
    const c = code.trim().toUpperCase();
    if (!/^[A-Z2-9]{6}$/.test(c)) return setErr("Game codes are 6 letters/numbers.");
    if (name.trim().length < 2) return setErr("Pick a team name (2+ characters).");
    setBusy(true);
    try { await api("state", { code: c }); setStep(2); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const join = async () => {
    if (!biz) return setErr("Choose a business!");
    setBusy(true); setErr("");
    try {
      const c = code.trim().toUpperCase();
      const r = await api<{ teamId: string; teamToken: string }>("join", { code: c, teamName: name, business: biz });
      saveTeam(c, { teamId: r.teamId, teamToken: r.teamToken });
      setLastTeamCode(c);
      nav(`/play/${c}`);
    } catch (e: any) { setErr(e.message); if (/name/i.test(e.message)) setStep(1); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen relative">
      <CityBackground stage={step === 2 ? 4 : 2} />
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8">
        <div className="text-center mb-8"><Logo size="xl" /><div className="font-pixel text-[10px] md:text-xs text-white mt-6 leading-6">BUILD YOUR BUSINESS · BEAT THE MARKET · RULE THE CITY</div></div>

        {savedSession && saved && step === 1 && (
          <Panel className="max-w-xl mx-auto mb-6 text-center">
            <Label>Welcome back</Label>
            <button className="px-btn px-btn-green mt-3" onClick={() => nav(`/play/${saved}`)}>RESUME GAME {saved}</button>
          </Panel>
        )}

        {step === 1 ? (
          <Panel className="max-w-xl mx-auto anim-slide">
            <div className="font-pixel text-sm text-gold mb-5">JOIN A GAME</div>
            <Label className="mb-2">Game code</Label>
            <input className="px-input text-center text-2xl tracking-[.35em] uppercase" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="ABC123" autoCapitalize="characters" autoComplete="off" aria-label="Game code" />
            <Label className="mt-5 mb-2">Team name</Label>
            <input className="px-input" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} placeholder="The Money Makers" aria-label="Team name" onKeyDown={(e) => e.key === "Enter" && next()} />
            {err && <div className="mt-4 text-ruby text-2xl" role="alert">⚠ {err}</div>}
            <button className="px-btn px-btn-green w-full mt-6" disabled={busy} onClick={next}>{busy ? "CHECKING..." : "NEXT ▶"}</button>
          </Panel>
        ) : (
          <div className="anim-slide">
            <div className="font-pixel text-sm text-gold text-center mb-1">CHOOSE YOUR BUSINESS</div>
            <div className="text-center text-2xl mb-5">Every business starts with <span className="text-mint">$10,000</span>. Team: <span className="text-gold">{name}</span></div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {BIZ.map((b) => (
                <button key={b.id} onClick={() => setBiz(b.id)} aria-pressed={biz === b.id}
                  className={`px-panel p-3 text-left transition-transform hover:-translate-y-1 ${biz === b.id ? "outline outline-4 outline-gold -translate-y-1" : ""}`}>
                  <div className="flex justify-center -mt-1"><Storefront id={b.id} level={biz === b.id ? 2 : 0} width={84} /></div>
                  <div className="font-pixel text-[10px] mt-2 text-center leading-4">{b.name.toUpperCase()}</div>
                  <div className="text-lg mt-2 leading-none"><span className="text-mint">▲</span> {b.strength}</div>
                  <div className="text-lg mt-1 leading-none"><span className="text-ruby">▼</span> {b.weakness}</div>
                </button>
              ))}
            </div>
            {err && <div className="mt-4 text-ruby text-2xl text-center" role="alert">⚠ {err}</div>}
            <div className="flex justify-center gap-4 mt-8">
              <button className="px-btn px-btn-ghost" onClick={() => setStep(1)}>◀ BACK</button>
              <button className="px-btn px-btn-green" disabled={busy || !biz} onClick={join}>{busy ? "JOINING..." : "OPEN FOR BUSINESS ▶"}</button>
            </div>
          </div>
        )}

        <div className="text-center mt-10"><Link to="/teacher" className="font-pixel text-[10px] text-sky underline">TEACHER? CREATE A GAME</Link></div>
      </div>
    </div>
  );
}
