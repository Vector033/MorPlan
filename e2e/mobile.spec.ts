import { expect, test } from "@playwright/test";

test("phone: day tabs and tap-to-place work without dragging", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "ลองด้วยข้อมูลตัวอย่าง" }).click();
  await page.getByLabel("ค้นหาด้วยรหัสหรือชื่อวิชา", { exact: false }).fill("CS101");
  await page.getByRole("button", { name: "เพิ่ม", exact: true }).first().click();
  await page.getByRole("button", { name: "เลือกตอน" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "วาง" }).first().click();

  // Section 001 is TuF: on Tuesday's tab the class is listed, on Wednesday's it isn't.
  await page.getByRole("tab", { name: "อ." }).click();
  await expect(page.getByRole("group", { name: "ตารางเรียนรายสัปดาห์" }).getByText("CS101")).toBeVisible();
  await page.getByRole("tab", { name: "พ.", exact: true }).click();
  await expect(page.getByText("ไม่มีเรียนวันนี้")).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
