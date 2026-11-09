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

test("another university: look up, read a paste with AI, import without CMU-only extras", async ({ page }) => {
  await page.route("**/api/university", (r) =>
    r.fulfill({
      json: {
        officialName: "มหาวิทยาลัยมหิดล",
        courseSearchUrl: "https://op.mahidol.ac.th/ra/courses",
        sources: [{ title: "mahidol.ac.th", uri: "https://example.com/redirect" }],
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

  await page.getByText("มหาวิทยาลัยอื่น", { exact: true }).click();
  await page.getByLabel("ชื่อมหาวิทยาลัย").fill("มหิดล");
  await page.getByRole("button", { name: "ค้นหาหน้าลงทะเบียน" }).click();
  await expect(page.getByRole("link", { name: "หน้าค้นหารายวิชา" })).toHaveAttribute("href", "https://op.mahidol.ac.th/ra/courses");
  await expect(page.getByLabel("ชื่อมหาวิทยาลัย")).toHaveValue("มหาวิทยาลัยมหิดล");

  await page.getByLabel("ข้อมูลที่คัดลอกจากเว็บลงทะเบียน").fill("ITCS 125 Discrete Mathematics 3 1 อังคาร 09:00-12:00 ...");
  await page.getByRole("button", { name: "อ่านข้อมูล" }).click();
  await expect(page.getByText("พบ 2 ตอนเรียน", { exact: false })).toBeVisible();
  await expect(page.getByText("ไม่นำเข้า 1 รายการ")).toBeVisible();
  await page.getByRole("button", { name: "นำเข้า 2 ตอน" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByText("ITCS125").first()).toBeVisible();
  await expect(page.getByText("ยังไม่มีวันสอบของมหาวิทยาลัยมหิดล")).toBeVisible();
  // The regulations drawer answers from CMU documents only.
  await expect(page.getByRole("main").getByRole("button", { name: "ถามระเบียบ" })).toHaveCount(0);

  // The picker remembers the university on the next visit.
  await page.goto("/import");
  await expect(page.getByLabel("ชื่อมหาวิทยาลัย")).toHaveValue("มหาวิทยาลัยมหิดล");
});

test("other university with an empty name asks for the name instead of using the CMU parser", async ({ page }) => {
  await page.goto("/import");
  await page.getByText("มหาวิทยาลัยอื่น", { exact: true }).click();
  await page.getByLabel("ข้อมูลที่คัดลอกจากเว็บลงทะเบียน").fill("ITCS 125 Discrete Mathematics");
  await page.getByRole("button", { name: "อ่านข้อมูล" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("พิมพ์ชื่อมหาวิทยาลัยก่อน");
});
