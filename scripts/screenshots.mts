// README screenshots from the running dev server. Usage: npx tsx scripts/screenshots.mts [baseUrl]
import { chromium, devices, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3100";
const out = "docs/screenshots";
mkdirSync(out, { recursive: true });

async function seed(page: Page, courses: [string, string][]) {
  await page.goto(base);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "ลองด้วยข้อมูลตัวอย่าง" }).click();
  for (const [courseNo, sectionLabel] of courses) {
    await page.getByLabel("ค้นหาด้วยรหัสหรือชื่อวิชา", { exact: false }).fill(courseNo);
    await page.getByRole("button", { name: "เพิ่ม", exact: true }).first().click();
    await page.locator("li", { hasText: courseNo }).getByRole("button", { name: "เลือกตอน" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("li", { hasText: sectionLabel }).getByRole("button", { name: /^วาง/ }).click();
  }
  await page.getByLabel("ค้นหาด้วยรหัสหรือชื่อวิชา", { exact: false }).fill("");
}

const COURSES: [string, string][] = [
  ["204101", "ตอน 001"],
  ["204102", "แล็บ 002"],
  ["206111", "ตอน 001"],
  ["208101", "ตอน 001"],
  ["001101", "ตอน 002"],
  ["204217", "ตอน 002"],
];

const browser = await chromium.launch();

{
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 980 }, deviceScaleFactor: 1.5, locale: "th-TH" });
  const page = await ctx.newPage();
  await seed(page, COURSES);
  await page.screenshot({ path: `${out}/planner.png` });

  // Drag state: pick up 206111 with the keyboard so every section shows as a ghost slot.
  await page.locator('li [aria-roledescription="วิชาที่ลากได้"]', { hasText: "206111" }).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/drag.png` });
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "+ แผนใหม่" }).click();
  await page.goto(`${base}/compare`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/compare.png` });

  await page.goto(`${base}/ask`);
  await page.getByLabel("คำถาม").fill("เทอม 2/2569 ถอนวิชาแบบได้ W ได้ถึงวันไหน");
  await page.getByRole("button", { name: "ถาม", exact: true }).click();
  await page.locator("ol li").getByText("ตรวจสอบกับประกาศทางการอีกครั้ง").waitFor({ timeout: 90_000 });
  await page.screenshot({ path: `${out}/ask.png` });
  await ctx.close();
}

{
  const ctx = await browser.newContext({ ...devices["Pixel 7"], locale: "th-TH" });
  const page = await ctx.newPage();
  await seed(page, COURSES.slice(0, 4));
  await page.getByRole("tab", { name: "อ." }).click();
  await page.getByRole("tablist", { name: "เลือกวัน" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/mobile.png` });
  await ctx.close();
}

await browser.close();
console.log(`saved to ${out}/`);
