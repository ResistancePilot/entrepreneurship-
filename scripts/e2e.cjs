// Browser end-to-end smoke test: teacher + 4 students + projector display, 8 rounds, reload mid-game.
// Usage: BASE=http://localhost:5173 SHOTS=/some/dir node scripts/e2e.cjs   (needs the app + API running)
const { chromium } = require("playwright");
const BASE = process.env.BASE || "http://localhost:5173";
const SHOTS = process.env.SHOTS || "/tmp/shots";
require("fs").mkdirSync(SHOTS, { recursive: true });
const TEAMS = [["Slice Kings", "Pizza Shop"], ["Bean Team", "Coffee Shop"], ["Pixel Forge", "Video Game Studio"], ["Paws & Co", "Pet Grooming"]];
const assert = (c, m) => { if (!c) { throw new Error("ASSERT FAILED: " + m); } console.log("ok -", m); };

(async () => {
  const browser = await chromium.launch();
  const mk = async (w, h) => { const c = await browser.newContext({ viewport: { width: w, height: h } }); const p = await c.newPage(); p.on("pageerror", (e) => console.log("PAGEERROR", e.message)); return p; };
  const teacher = await mk(1280, 900);
  await teacher.goto(BASE + "/teacher");
  await teacher.getByText("CREATE GAME").click();
  await teacher.waitForURL(/\/host\/[A-Z0-9]{6}/);
  const code = teacher.url().split("/").pop();
  console.log("game code", code);
  const display = await mk(1920, 1080);
  await display.goto(`${BASE}/display/${code}`);
  assert(!(await display.content()).match(/teacher key|adminToken/i), "display exposes no teacher controls");

  const students = [];
  for (const [name, biz] of TEAMS) {
    const p = await mk(430, 900);
    await p.goto(BASE);
    if (students.length === 0) await p.screenshot({ path: `${SHOTS}/01-landing.png` });
    await p.getByLabel("Game code").fill(code);
    await p.getByLabel("Team name").fill(name);
    await p.getByText("NEXT").click();
    await p.getByText(biz.toUpperCase()).first().click();
    if (students.length === 0) await p.screenshot({ path: `${SHOTS}/02-business.png`, fullPage: true });
    await p.getByText("OPEN FOR BUSINESS").click();
    await p.waitForURL(/\/play\//);
    students.push(p);
  }
  // duplicate team name rejected
  const dup = await mk(430, 900);
  await dup.goto(BASE); await dup.getByLabel("Game code").fill(code); await dup.getByLabel("Team name").fill("slice kings"); await dup.getByText("NEXT").click();
  await dup.getByText("ARCADE").first().click(); await dup.getByText("OPEN FOR BUSINESS").click();
  await dup.getByText(/already taken/).waitFor(); assert(true, "duplicate team name rejected");
  // invalid code rejected
  const bad = await mk(430, 900);
  await bad.goto(BASE); await bad.getByLabel("Game code").fill("ZZZZZZ"); await bad.getByLabel("Team name").fill("Nope"); await bad.getByText("NEXT").click();
  await bad.getByText(/No game found/).waitFor(); assert(true, "invalid code rejected");

  await teacher.getByText("1 teams", { exact: false }).count();
  await teacher.waitForFunction(() => document.body.innerText.includes("Pet Grooming"));
  await teacher.screenshot({ path: `${SHOTS}/03-host-lobby.png` });
  await display.screenshot({ path: `${SHOTS}/04-display-lobby.png` });
  // student cannot reach teacher controls
  const snoop = students[0];
  await snoop.goto(`${BASE}/host/${code}`);
  await snoop.getByText("TEACHER KEY REQUIRED").waitFor(); assert(true, "student sees no teacher controls");
  await snoop.goto(`${BASE}/play/${code}`);

  await teacher.getByText("START GAME").click();
  const strategies = [[400, 400, 400, 400], [1500, 0, 0, 0], [0, 0, 0, 0], [300, 600, 200, 300]];
  const cats = ["MARKETING", "QUALITY", "OPERATIONS", "EXPANSION"];
  for (let round = 1; round <= 8; round++) {
    for (let i = 0; i < students.length; i++) {
      const p = students[i];
      await p.getByText(`MONTH ${round} · ALLOCATE CASH`).waitFor();
      if (round === 3 && i === 3) continue; // never submits
      const s = round > 5 ? [0, 0, 0, 0] : strategies[i];
      for (let c = 0; c < 4; c++) await p.getByLabel(`${cats[c]} amount`).fill(String(s[c]));
      if (round === 1 && i === 0) await p.screenshot({ path: `${SHOTS}/05-student-decide.png`, fullPage: true });
      await p.getByText(/LOCK IN|UPDATE DECISIONS/).click();
      await p.getByText(/Submitted!/).waitFor();
    }
    if (round === 2) { // refresh mid-round: saved decision survives
      await students[0].reload();
      await students[0].getByText(`MONTH 2 · ALLOCATE CASH`).waitFor();
      const v = await students[0].getByLabel("MARKETING amount").inputValue();
      assert(v === "400", "refresh restores saved decision (marketing=400)");
    }
    await teacher.waitForFunction((n) => /submission status/i.test(document.body.innerText), round);
    if (round === 1) { await display.screenshot({ path: `${SHOTS}/06-display-open.png` }); await teacher.screenshot({ path: `${SHOTS}/07-host-open.png`, fullPage: true }); }
    teacher.once("dialog", (d) => d.accept());
    await teacher.getByText(/CLOSE MONTH/).click();
    for (const p of students) await p.getByText(`MONTH ${round} COMPLETE!`).waitFor();
    if (round === 1) await students[0].screenshot({ path: `${SHOTS}/08-student-results.png`, fullPage: true });
    if (round === 4) { await display.waitForTimeout(1500); await display.screenshot({ path: `${SHOTS}/09-display-board-r4.png` }); await display.getByText("CITY", { exact: true }).click(); await display.waitForTimeout(1200); await display.screenshot({ path: `${SHOTS}/10-display-city-r4.png` }); await display.getByText("LEADERBOARD").click(); }
    if (round === 8) { await display.waitForTimeout(1500); await display.screenshot({ path: `${SHOTS}/11-display-board-r8.png` }); }
    await teacher.getByText(round < 8 ? `OPEN MONTH ${round + 1}` : "REVEAL CHAMPION").click();
  }
  await display.getByText("PIXEL EMPIRE CHAMPION").waitFor();
  await display.waitForTimeout(1200);
  await display.screenshot({ path: `${SHOTS}/12-display-champion.png` });
  await students[1].getByText("PIXEL EMPIRE CHAMPION").waitFor();
  await students[1].screenshot({ path: `${SHOTS}/13-student-final.png`, fullPage: true });
  await teacher.screenshot({ path: `${SHOTS}/14-host-final.png`, fullPage: true });
  assert(true, "8 rounds completed and champion shown on display, student and host");
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
