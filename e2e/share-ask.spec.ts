import { expect, test } from "@playwright/test";

test("share link opens read-only and can be copied into my plans", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "ลองด้วยข้อมูลตัวอย่าง" }).click();
  await page.getByLabel("ค้นหาด้วยรหัสหรือชื่อวิชา", { exact: false }).fill("208101");
  await page.getByRole("button", { name: "เพิ่ม", exact: true }).first().click();
  await page.getByRole("button", { name: "เลือกตอน" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "วาง" }).first().click();

  await page.getByRole("button", { name: "แชร์ลิงก์" }).click();
  const link = page.getByRole("status").getByRole("link");
  await expect(link).toBeVisible();
  const url = await link.getAttribute("href");
  expect(url).toMatch(/\/s\/[\w-]{10}$/);

  // A friend with an empty browser sees the plan but cannot drag anything.
  const friend = await context.browser()!.newContext();
  const view = await friend.newPage();
  await view.goto(url!);
  await expect(view.getByText("ตารางที่แชร์ · อ่านอย่างเดียว")).toBeVisible();
  await expect(view.getByText("208101").first()).toBeVisible();
  await expect(view.locator('[aria-roledescription="วิชาที่ลากได้"]')).toHaveCount(0);
  await view.getByRole("button", { name: "คัดลอกเป็นแผนของฉัน" }).click();
  await expect(view).toHaveURL(/\/$/);
  await expect(view.getByText("1 วิชา · 3 หน่วยกิต")).toBeVisible();
  await friend.close();
});

test("unknown share ids show not found", async ({ page }) => {
  const res = await page.goto("/s/xxxxxxxxxx");
  expect(res?.status()).toBe(404);
});

test("ask answers with a citation and the official-notice line", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/ask");
  await page.getByLabel("คำถาม").fill("ลงทะเบียนได้มากที่สุดเทอมละกี่หน่วยกิต");
  await page.getByRole("button", { name: "ถาม", exact: true }).click();
  // Scope to the answer card: the footer carries the same notice.
  const card = page.locator("ol li").first();
  await expect(card.getByText("ตรวจสอบกับประกาศทางการอีกครั้ง")).toBeVisible({ timeout: 90_000 });
  await expect(card.getByRole("link", { name: /หน้า \d+/ }).first()).toBeVisible();
});

test("ask says ไม่พบ for something the documents never cover", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/ask");
  await page.getByLabel("คำถาม").fill("ค่าที่จอดรถมอเตอร์ไซค์ในหอพักเดือนละเท่าไหร่");
  await page.getByRole("button", { name: "ถาม", exact: true }).click();
  const card = page.locator("ol li").first();
  await expect(card.getByText("ในเอกสารที่ MorPlan มี")).toBeVisible({ timeout: 90_000 });
  await expect(card.getByText("ตรวจสอบกับประกาศทางการอีกครั้ง")).toBeVisible();
  await expect(card.getByRole("link")).toHaveCount(0);
});
