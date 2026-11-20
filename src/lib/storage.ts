const safe = <T,>(f: () => T, d: T): T => { try { return f(); } catch { return d; } };
export interface TeamSession { teamId: string; teamToken: string }
export const loadTeam = (code: string): TeamSession | null =>
  safe(() => JSON.parse(localStorage.getItem(`pe:team:${code}`) ?? "null"), null);
export const saveTeam = (code: string, s: TeamSession) => safe(() => localStorage.setItem(`pe:team:${code}`, JSON.stringify(s)), undefined);
export const clearTeam = (code: string) => safe(() => localStorage.removeItem(`pe:team:${code}`), undefined);
export const loadAdmin = (code: string): string | null => safe(() => localStorage.getItem(`pe:admin:${code}`), null);
export const saveAdmin = (code: string, t: string) => safe(() => localStorage.setItem(`pe:admin:${code}`, t), undefined);
export const lastTeamCode = (): string | null => safe(() => localStorage.getItem("pe:lastTeamCode"), null);
export const setLastTeamCode = (c: string) => safe(() => localStorage.setItem("pe:lastTeamCode", c), undefined);
