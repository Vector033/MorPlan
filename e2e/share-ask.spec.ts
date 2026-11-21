import { expect, test } from "@playwright/test";

test("share link opens read-only and can be copied into my plans", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "ลองด้วยข้อมูลตัวอย่าง" }).click();
  await page.getByLabel("ค้นหาด้วยรหัสหรือชื่อวิชา", { exact: false }).fill("STAT101");
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
  await expect(view.getByText("STAT101").first()).toBeVisible();
  await expect(view.locator('[aria-roledescription="วิชาที่ลากได้"]')).toHaveCount(0);
  await view.getByRole("button", { name: "คัดลอกเป็นแผนของฉัน" }).click();
  await expect(view).toHaveURL(/\/$/);
  await expect(view.getByLabel("สรุปแผนนี้")).toContainText(/วิชา\s*1\s*หน่วยกิต\s*3/);
  await friend.close();
});

test("unknown share ids show not found", async ({ page }) => {
  const res = await page.goto("/s/xxxxxxxxxx");
  expect(res?.status()).toBe(404);
});

async function chooseUniversity(page: import("@playwright/test").Page, name: string) {
  await page.goto("/ask");
  await page.waitForLoadState("networkidle"); // the dev server may reload a page it has just compiled
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel("มหาวิทยาลัยของคุณ").fill(name);
  await page.getByRole("button", { name: "ใช้มหาวิทยาลัยนี้" }).click();
}

test("ask answers with a citation and the official-notice line", async ({ page }) => {
  test.setTimeout(120_000);
  await chooseUniversity(page, "มช");
  await expect(page.getByText("มหาวิทยาลัยเชียงใหม่", { exact: true })).toBeVisible();
  await page.getByLabel("คำถาม").fill("ลงทะเบียนได้มากที่สุดเทอมละกี่หน่วยกิต");
  await page.getByRole("button", { name: "ถาม", exact: true }).click();
  // Scope to the answer card: the footer carries the same notice.
  const card = page.locator("ol li").first();
  await expect(card.getByText("ตรวจสอบกับประกาศทางการอีกครั้ง")).toBeVisible({ timeout: 90_000 });
  // Citation chips show document + page; opening one reveals the passage and the source link.
  const chip = card.getByText(/^หน้า \d+$/).first();
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(card.getByRole("link", { name: "เปิดหน้าเอกสารต้นฉบับ" }).first()).toBeVisible();
});

test("ask says ไม่พบ for something the documents never cover", async ({ page }) => {
  test.setTimeout(120_000);
  await chooseUniversity(page, "มหาวิทยาลัยเชียงใหม่");
  await page.getByLabel("คำถาม").fill("ค่าที่จอดรถมอเตอร์ไซค์ในหอพักเดือนละเท่าไหร่");
  await page.getByRole("button", { name: "ถาม", exact: true }).click();
  const card = page.locator("ol li").first();
  await expect(card.getByText("ในเอกสารที่ใช้ตอบ")).toBeVisible({ timeout: 90_000 });
  await expect(card.getByText("ตรวจสอบกับประกาศทางการอีกครั้ง")).toBeVisible();
  await expect(card.getByRole("link")).toHaveCount(0);
});

test("another university answers only from its own documents; a pasted one stays with the student", async ({ page, request }) => {
  // With no document for this university the API says so instead of answering from another university.
  const none = await request.post("/api/ask", { data: { question: "ภาคฤดูร้อนลงทะเบียนได้กี่หน่วยกิต", university: "มหาวิทยาลัยทดสอบระบบ" } });
  expect(await none.json()).toEqual({ status: "no_docs" });

  await chooseUniversity(page, "มหาวิทยาลัยทดสอบระบบ");
  const adder = page.getByRole("region", { name: "เพิ่มเอกสารระเบียบ" });
  await expect(adder).toBeVisible();
  await adder.getByText("วางข้อความ", { exact: true }).click();
  const rules = [
    "ข้อบังคับมหาวิทยาลัยทดสอบระบบ ว่าด้วยการศึกษาระดับปริญญาตรี",
    "ข้อ 15 การลงทะเบียนในภาคฤดูร้อน ให้นักศึกษาลงทะเบียนเรียนได้ไม่เกิน 9 หน่วยกิต",
    "ข้อ 16 นักศึกษาต้องมีเวลาเรียนไม่น้อยกว่าร้อยละ 80 ของเวลาเรียนทั้งหมดจึงจะมีสิทธิ์สอบ",
    "ข้อ 17 การถอนกระบวนวิชาโดยได้รับอักษร W ให้กระทำภายในสัปดาห์ที่ 12 ของภาคการศึกษา",
  ].join("\n\n");
  await adder.getByLabel("ข้อความจากระเบียบหรือประกาศ").fill(rules);
  await adder.getByRole("button", { name: "อ่านเอกสาร" }).click();
  await expect(page.getByRole("list", { name: "เอกสารเฉพาะคุณ" })).toContainText("ข้อความที่วาง");

  await page.getByLabel("คำถาม").fill("ภาคฤดูร้อนลงทะเบียนได้กี่หน่วยกิต");
  await page.getByRole("button", { name: "ถาม", exact: true }).click();
  const card = page.locator("ol li").first();
  await expect(card.getByText("ข้อความที่วาง").first()).toBeVisible();
  await card.getByText(/^หน้า \d+$/).first().click();
  await expect(card.getByText("จากเอกสารที่คุณเพิ่มเอง")).toBeVisible();
  await expect(card.getByRole("link", { name: "เปิดหน้าเอกสารต้นฉบับ" })).toHaveCount(0);

  // Something only Chiang Mai University's bundled documents cover is not found here.
  await page.getByLabel("คำถาม").fill("ค่าธรรมเนียมการศึกษาแบบเหมาจ่ายของคณะวิศวกรรมศาสตร์");
  await page.getByRole("button", { name: "ถาม", exact: true }).click();
  await expect(page.locator("ol li").first().getByText("ในเอกสารที่ใช้ตอบ")).toBeVisible();
});

test("a link read for a university is shared only after the student confirms it", async ({ page }) => {
  let confirmed = false;
  const doc = { id: "abcdefghij", title: "ระเบียบการศึกษา 2568", kind: "regulation", sourceUrl: "https://reg.test.ac.th/rules.pdf", readAt: "2026-11-21" };
  await page.route("**/api/regulations?*", (r) => r.fulfill({ json: { docs: confirmed ? [doc] : [] } }));
  await page.route("**/api/regulations/read", (r) => {
    expect(r.request().postDataJSON()).toMatchObject({ university: "มหาวิทยาลัยทดสอบลิงก์", source: { url: doc.sourceUrl } });
    return r.fulfill({ json: { pendingId: doc.id, preview: { title: doc.title, pageCount: 12, sample: "ข้อ 1 ข้อบังคับนี้" } } });
  });
  await page.route("**/api/regulations/confirm", (r) => {
    confirmed = true;
    return r.fulfill({ json: { ok: true } });
  });
  await chooseUniversity(page, "มหาวิทยาลัยทดสอบลิงก์");
  const adder = page.getByRole("region", { name: "เพิ่มเอกสารระเบียบ" });
  await adder.getByLabel("ลิงก์เอกสารระเบียบ (เว็บมหาวิทยาลัย)").fill(doc.sourceUrl);
  await adder.getByRole("button", { name: "อ่านเอกสาร" }).click();
  await expect(adder.getByText("อ่านได้ 12 หน้า", { exact: false })).toBeVisible();
  expect(confirmed).toBe(false);
  await adder.getByRole("button", { name: "ใช้เอกสารนี้ และแชร์ให้เพื่อนมหาวิทยาลัยเดียวกัน" }).click();
  await expect(page.getByText("ตอบจากเอกสาร", { exact: false })).toContainText("1");
  await expect(adder).toHaveCount(0);
});
