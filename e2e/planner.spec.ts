import { expect, test, type Page } from "@playwright/test";

const live = (page: Page) => page.locator('[id^="DndLiveRegion"]');

async function loadDemo(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "ลองด้วยข้อมูลตัวอย่าง" }).click();
  await expect(page.getByLabel("ค้นหาด้วยรหัสหรือชื่อวิชา", { exact: false })).toBeVisible();
}

async function want(page: Page, courseNo: string) {
  await page.getByLabel("ค้นหาด้วยรหัสหรือชื่อวิชา", { exact: false }).fill(courseNo);
  await page.getByRole("button", { name: "เพิ่ม", exact: true }).first().click();
}

const trayItem = (page: Page, courseNo: string) =>
  page.locator('li [aria-roledescription="วิชาที่ลากได้"]', { hasText: courseNo });
const ghostSlots = (page: Page) => page.locator("div.border-dashed", { hasText: "ตอน" });
const calendar = (page: Page) => page.getByRole("group", { name: "ตารางเรียนรายสัปดาห์" }).first();

test("drag a course from the tray onto a section slot", async ({ page }) => {
  await loadDemo(page);
  await want(page, "MATH101");
  const item = trayItem(page, "MATH101");
  const box = (await item.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 40, box.y + box.height / 2, { steps: 5 });
  // Ghost slots appear for every section of the course.
  const slot = page.locator('div.border-dashed', { hasText: "ตอน 002" }).first();
  await expect(slot).toBeVisible();
  const target = (await slot.boundingBox())!;
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 15 });
  await page.mouse.up();

  await expect(calendar(page).getByRole("button", { name: /MATH101.*ตอน 002/ }).first()).toBeVisible();
  await expect(page.getByText("ไม่มีวิชาชน")).toBeVisible();
});

test("place sections with the keyboard and see a clash", async ({ page }) => {
  await loadDemo(page);
  await want(page, "CS101");
  await want(page, "MATH101");

  // CS101: pick up, first slot is section 002 (Mon), drop.
  await trayItem(page, "CS101").focus();
  await page.keyboard.press("Space");
  // The pick-up message is replaced at once by "over the tray" (where the item starts).
  await expect(live(page)).toContainText("เอาออกจากตาราง");
  // Arrow keys only move between slots once they are on screen.
  await expect(ghostSlots(page).first()).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(live(page)).toContainText("ตอน 002 วันจันทร์");
  await page.keyboard.press("ArrowRight");
  await expect(live(page)).toContainText("ตอน 001 วันอังคาร");
  await page.keyboard.press("Space");
  await expect(live(page)).toContainText("วาง CS101");

  // MATH101 section 002 is TuF 08:00 too, so it must be announced and shown as a clash.
  await trayItem(page, "MATH101").focus();
  await page.keyboard.press("Space");
  await expect(ghostSlots(page).first()).toBeVisible();
  for (let i = 0; i < 6; i++) {
    const before = await live(page).textContent();
    await page.keyboard.press("ArrowRight");
    // Read the announcement only after it changes; on a slow host the old text lingers.
    await expect.poll(() => live(page).textContent()).not.toBe(before);
    if ((await live(page).textContent())?.includes("ตอน 002 วันอังคาร")) break;
  }
  await expect(live(page)).toContainText("ชนกับวิชาอื่น");
  await page.keyboard.press("Space");

  await expect(page.getByLabel("สรุปแผนนี้")).toContainText(/จุดที่ชน\s*[1-9]/);
  const clash = /เวลาเรียนชน: CS101 ตอน \d{3} กับ MATH101 ตอน 002 วันอังคาร 08:00–09:30/;
  // Alert bar above the timetable, and the full list in the clash panel.
  await expect(page.getByRole("link", { name: clash })).toBeVisible();
  await expect(page.getByRole("region", { name: "สิ่งที่ชนกัน" }).getByText(clash)).toBeVisible();
});

test("section picker places a course without dragging", async ({ page }) => {
  await loadDemo(page);
  await want(page, "STAT101");
  await page.getByRole("button", { name: "เลือกตอน" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "วาง" }).first().click();
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel("สรุปแผนนี้")).toContainText(/วิชา\s*1\s*หน่วยกิต\s*3/);
});

test("the term can be changed and the .ics export asks for the term's first and last day", async ({ page }) => {
  await loadDemo(page);
  await page.getByLabel("ภาค", { exact: true }).selectOption("1");
  await page.getByLabel("ปีการศึกษา").selectOption("2570");
  await want(page, "STAT101");
  await page.getByRole("button", { name: "เลือกตอน" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "วาง" }).first().click();
  await page.reload();
  await expect(page.getByLabel("ภาค", { exact: true })).toHaveValue("1");

  await page.getByRole("button", { name: ".ics" }).click();
  const dialog = page.getByRole("dialog", { name: "ส่งออกปฏิทิน (.ics)" });
  await expect(dialog.getByLabel("วันเรียนวันแรก")).toHaveValue("2027-08-03");
  await dialog.getByLabel("วันเรียนวันแรก").fill("2027-07-01");
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "ดาวน์โหลด .ics" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("morplan-1-2570-A.ics");
  const ics = await (await import("node:fs/promises")).readFile(await file.path(), "utf8");
  expect(ics).toContain("STAT101");
  expect(ics).toMatch(/DTSTART;TZID=Asia\/Bangkok:202707/);
});

test("workspace survives a reload", async ({ page }) => {
  await loadDemo(page);
  await want(page, "STAT101");
  await page.reload();
  await expect(trayItem(page, "STAT101")).toBeVisible();
});

test("regulations drawer opens from the planner and closes with Escape", async ({ page }) => {
  await loadDemo(page);
  await page.getByRole("button", { name: "ถามระเบียบ" }).click();
  const drawer = page.getByRole("dialog", { name: "ถามเรื่องระเบียบการศึกษา" });
  await expect(drawer).toBeVisible();
  // No university is assumed: the drawer asks for one first.
  await expect(drawer.getByLabel("มหาวิทยาลัยของคุณ")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
});
