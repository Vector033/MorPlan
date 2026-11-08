/**
 * README / portfolio screenshots from a real deployment, using the built-in demo data.
 *   npx tsx scripts/screenshots.mts [baseUrl]   (default https://morplan.vercel.app)
 * Writes docs/screenshots/{planner,drag,compare,ask,mobile}.png at 2x.
 */
import { chromium, devices, type Page } from "@playwright/test";

const base = process.argv[2] ?? "https://morplan.vercel.app";
const out = (name: string) => `docs/screenshots/${name}.png`;

const trayItem = (page: Page, c: string) => page.locator('li [aria-roledescription="วิชาที่ลากได้"]', { hasText: c });

async function want(page: Page, c: string) {
  await page.getByLabel("ค้นหาด้วยรหัสหรือชื่อวิชา", { exact: false }).fill(c);
  await page.getByRole("button", { name: "เพิ่ม", exact: true }).first().click();
  await trayItem(page, c).waitFor();
}

async function place(page: Page, c: string, section: string) {
  await page.locator("li", { has: page.locator(`[aria-roledescription="วิชาที่ลากได้"]`, { hasText: c }) }).getByRole("button").nth(1).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("li", { hasText: section }).getByRole("button", { name: /วาง/ }).first().click();
  await dialog.waitFor({ state: "hidden" });
}

const browser = await chromium.launch();
const desktop = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2, locale: "th-TH" });
const page = await desktop.newPage();

await page.goto(base);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.getByRole("button", { name: "ลองด้วยข้อมูลตัวอย่าง" }).click();
for (const c of ["204101", "206111", "208101", "001101", "140104"]) await want(page, c);
await page.getByLabel("ค้นหาด้วยรหัสหรือชื่อวิชา", { exact: false }).fill("");
await place(page, "204101", "ตอน 001");
await place(page, "206111", "ตอน 002"); // same TuF 08:00 slot: one visible clash
await place(page, "208101", "ตอน 001");
await place(page, "001101", "ตอน 001");
await page.mouse.move(0, 0);
await page.waitForTimeout(600); // snap / shake settle
await page.screenshot({ path: out("planner") });

// Mid-drag: every section of the course appears as a slot, clashing ones in red.
// 206111 sits high in the list, so the pointer stays clear of the edge that autoscrolls.
await page.evaluate(() => window.scrollTo(0, 0));
const item = trayItem(page, "206111");
const box = (await item.boundingBox())!;
await page.mouse.move(box.x + 20, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + 60, box.y + box.height / 2, { steps: 6 });
await page.locator("div.border-dashed", { hasText: "ตอน" }).first().waitFor();
await page.mouse.move(1010, 470, { steps: 12 });
await page.waitForTimeout(300);
await page.screenshot({ path: out("drag") });
await page.keyboard.press("Escape");
await page.mouse.up();
await page.waitForTimeout(300);

// Plan B: copy of A without the clash, then compare.
await page.getByRole("button", { name: "+ แผนใหม่" }).click();
await page.getByRole("tab", { name: "แผน B", selected: true }).waitFor();
await place(page, "206111", "ตอน 003");
await page.goto(`${base}/compare`);
await page.getByRole("table").first().waitFor();
await page.screenshot({ path: out("compare") });

// Phone: same workspace, Tuesday (where the clash is) on plan A.
const state = await desktop.storageState();
const phone = await browser.newContext({ ...devices["Pixel 7"], storageState: state, locale: "th-TH" });
const mp = await phone.newPage();
await mp.goto(base);
await mp.getByRole("tab", { name: "แผน A" }).click();
await mp.getByRole("tab", { name: "อ." }).click();
await mp.locator("main").scrollIntoViewIfNeeded();
await mp.evaluate(() => window.scrollTo(0, (document.querySelector("main")?.getBoundingClientRect().top ?? 0) + window.scrollY - 64));
await mp.waitForTimeout(500);
await mp.screenshot({ path: out("mobile") });

// Rule Q&A with an opened citation.
await page.goto(`${base}/ask`);
await page.getByLabel("คำถาม").fill("ต้องเข้าเรียนกี่เปอร์เซ็นต์ถึงมีสิทธิ์สอบ");
await page.getByRole("button", { name: "ถาม", exact: true }).click();
const chip = page.getByText(/^หน้า \d+$/).first();
await chip.waitFor({ timeout: 60_000 });
await chip.click();
await page.waitForTimeout(400);
await page.screenshot({ path: out("ask") });

await browser.close();
console.log("saved to docs/screenshots/");
