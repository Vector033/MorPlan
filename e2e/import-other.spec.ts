import { expect, test } from "@playwright/test";

// The model calls are mocked: this covers the page flow, the extraction checks have unit tests.
const extracted = {
  sections: [
    {
      id: "ITCS125-1-000",
      courseNo: "ITCS125",
      title: "Discrete Mathematics",
      credits: 3,
      lec: "1",
      lab: "000",
      meetings: [{ days: ["Tu"], start: 540, end: 720, room: "IT 105" }],
      instructors: ["อ.สมชาย"],
    },
    {
      id: "ITCS125-2-000",
      courseNo: "ITCS125",
      title: "Discrete Mathematics",
      credits: 3,
      lec: "2",
      lab: "000",
      meetings: [{ days: ["Th"], start: 780, end: 960 }],
      instructors: [],
    },
  ],
  warnings: ["HACK999: ไม่พบรหัสวิชานี้ในข้อความที่วาง จึงไม่นำเข้า"],
};

test("a university: look up, read a paste with AI, import, and keep the university", async ({ page }) => {
  await page.route("**/api/university", (r) =>
    r.fulfill({
      json: {
        officialName: "มหาวิทยาลัยมหิดล",
        courseSearchUrl: "https://op.mahidol.ac.th/ra/courses",
      },
    }),
  );
  await page.route("**/api/extract", async (r) => {
    expect(r.request().postDataJSON()).toMatchObject({ university: "มหาวิทยาลัยมหิดล" });
    await r.fulfill({ json: extracted });
  });

  await page.goto("/import");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // No university is assumed: the picker starts empty, with no "default" choice.
  await expect(page.getByLabel("ชื่อมหาวิทยาลัย")).toHaveValue("");
  await page.getByLabel("ชื่อมหาวิทยาลัย").fill("มหิดล");
  await page.getByRole("button", { name: "ค้นหาหน้าลงทะเบียน" }).click();
  await expect(page.getByRole("link", { name: "หน้าค้นหารายวิชา" })).toHaveAttribute("href", "https://op.mahidol.ac.th/ra/courses");
  const uni = page.getByRole("region", { name: "มหาวิทยาลัยของคุณ" });
  await expect(uni.getByText("มหาวิทยาลัยมหิดล").first()).toBeVisible();
  await expect(uni.getByRole("button", { name: "เปลี่ยน" })).toBeVisible();

  await page.getByLabel("ข้อมูลที่คัดลอกจากเว็บลงทะเบียน").fill("ITCS 125 Discrete Mathematics 3 1 อังคาร 09:00-12:00 ...");
  await page.getByRole("button", { name: "อ่านข้อมูล" }).click();
  await expect(page.getByText("พบ 2 ตอนเรียน", { exact: false })).toBeVisible();
  await expect(page.getByText("ไม่นำเข้า 1 รายการ")).toBeVisible();
  await page.getByRole("button", { name: "นำเข้า 2 ตอน" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByText("ITCS125").first()).toBeVisible();

  // Every page remembers the university on the next visit.
  await page.goto("/import");
  await expect(uni.getByText("มหาวิทยาลัยมหิดล")).toBeVisible();
});

test("an unreadable paste without a university asks for the university", async ({ page }) => {
  await page.goto("/import");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel("ข้อมูลที่คัดลอกจากเว็บลงทะเบียน").fill("ITCS 125 Discrete Mathematics");
  await page.getByRole("button", { name: "อ่านข้อมูล" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("เลือกมหาวิทยาลัยด้านบนก่อน แล้วกดอ่านข้อมูลอีกครั้ง");
});

test("the sample text is read in the browser for anyone, and a course can be added by hand", async ({ page }) => {
  await page.route("**/api/extract", (r) => r.abort()); // the table reader must not need AI
  await page.goto("/import");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "ใส่ตัวอย่างข้อความ" }).click();
  await expect(page.getByText("พบ 6 ตอนเรียน", { exact: false })).toBeVisible();
  await expect(page.getByText("อ่านโดย AI")).toHaveCount(0);

  await page.getByRole("button", { name: "+ เพิ่มวิชาเอง" }).click();
  await page.getByLabel("รหัสวิชา").fill("cs 299");
  await page.getByRole("group", { name: "วันเรียน ช่วงที่ 1" }).getByRole("button", { name: "อ", exact: true }).click();
  await page.getByLabel("เริ่ม").first().fill("09:00");
  await page.getByLabel("เลิก").first().fill("08:00");
  await page.getByRole("button", { name: "เพิ่มวิชา", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("เวลาเลิกต้องหลังเวลาเริ่ม");
  await page.getByLabel("เลิก").first().fill("12:00");
  await page.getByRole("button", { name: "+ เพิ่มช่วงเวลาเรียน" }).click();
  await page.getByRole("group", { name: "วันเรียน ช่วงที่ 2" }).getByRole("button", { name: "พฤ", exact: true }).click();
  await page.getByLabel("เริ่ม").nth(1).fill("13:00");
  await page.getByLabel("เลิก").nth(1).fill("16:00");
  await page.getByRole("button", { name: "เพิ่มวิชา", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "เพิ่ม CS299 ตอน 001/000 แล้ว" })).toBeVisible();

  await page.goto("/");
  await page.getByLabel("ค้นหาด้วยรหัสหรือชื่อวิชา", { exact: false }).fill("299");
  await expect(page.getByText("CS299").first()).toBeVisible();
});
