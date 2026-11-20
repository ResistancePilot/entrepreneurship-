import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { saveAdmin } from "../lib/storage";
import { CityBackground, Logo } from "../components/art";
import { Label, Panel } from "../components/ui";

export default function Teacher() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");

  const create = async () => {
    setBusy(true); setErr("");
    try {
      const r = await api<{ code: string; adminToken: string }>("create");
      saveAdmin(r.code, r.adminToken);
      nav(`/host/${r.code}`);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const resume = async () => {
    setErr("");
    const c = code.trim().toUpperCase();
    try {
      await api("state", { code: c });
      saveAdmin(c, token.trim());
      nav(`/host/${c}`);
    } catch (e: any) { setErr(e.message); }
  };
  return (
    <div className="min-h-screen relative">
      <CityBackground stage={3} />
      <div className="relative z-10 max-w-xl mx-auto px-4 py-10 space-y-6">
        <div className="text-center"><Logo size="lg" /></div>
        <Panel className="text-center">
          <div className="font-pixel text-sm text-gold mb-4">TEACHER CONTROL ROOM</div>
          <div className="text-2xl mb-4">Create a game, project the display, and run all 8 rounds.</div>
          <button className="px-btn px-btn-green" onClick={create} disabled={busy}>{busy ? "CREATING..." : "★ CREATE GAME ★"}</button>
        </Panel>
        <Panel>
          <Label>Resume an existing game on this device</Label>
          <input className="px-input mt-3 uppercase" maxLength={6} placeholder="GAME CODE" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <input className="px-input mt-3" placeholder="Teacher key" value={token} onChange={(e) => setToken(e.target.value)} type="password" />
          <button className="px-btn px-btn-blue mt-4" onClick={resume} disabled={!code || !token}>RESUME</button>
        </Panel>
        {err && <div className="text-ruby text-2xl text-center" role="alert">⚠ {err}</div>}
        <div className="text-center"><Link to="/" className="font-pixel text-[10px] text-sky underline">◀ STUDENT JOIN</Link></div>
      </div>
    </div>
  );
}
