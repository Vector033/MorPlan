import { expect, test, type Page } from "@playwright/test";
import { COOP } from "../src/lib/core/__fixtures__/coop-plan";

// Every curriculum API is mocked: this covers the page flow, the routes have their own tests.
const curriculum = {
  title: "วิทยาการคอมพิวเตอร์ (64)",
  university: "มหาวิทยาลัยเชียงใหม่",
  faculty: "วิทยาศาสตร์",
  major: "วิทยาการคอมพิวเตอร์",
  cohortFrom: 64,
  plans: [{ ...COOP, id: "normal", name: "แผนปกติ" }, COOP],
  electives: {},
};
const meta = (id: string, cohortFrom: number, cohortTo?: number) => ({
  id,
  kind: "curriculum",
  title: "วิทยาการคอมพิวเตอร์",
  university: "มหาวิทยาลัยเชียงใหม่",
  faculty: "วิทยาศาสตร์",
  major: "วิทยาการคอมพิวเตอร์",
  cohortFrom,
  ...(cohortTo ? { cohortTo } : {}),
  sourceUrl: "https://science.cmu.ac.th/cs-" + cohortFrom + ".pdf",
  sourceTitle: "หลักสูตรวิทยาการคอมพิวเตอร์ " + cohortFrom,
  provenance: "link",
  readAt: "2026-11-10",
});

test.beforeEach(async ({ page }) => {
  await page.route("**/api/curriculum**", async (r) => {
    const { pathname } = new URL(r.request().url());
    if (pathname.endsWith("/options")) {
      const faculty = new URL(r.request().url()).searchParams.get("faculty");
      return r.fulfill({ json: { options: [faculty ? "วิทยาการคอมพิวเตอร์" : "วิทยาศาสตร์"] } });
    }
    if (pathname === "/api/curriculum") return r.fulfill({ json: { candidates: [meta("abcdefghi1", 64), meta("abcdefghi2", 59, 62)] } });
    if (pathname === "/api/curriculum/minors")
      return r.fulfill({
        json: {
          catalogs: [
            {
              meta: { ...meta("minors0001", 64), kind: "minors", title: "วิชาโท" },
              minors: [{ name: "ภาษาญี่ปุ่น", rules: "เรียนวิชาในกลุ่มรวม 15 หน่วยกิต", groups: [{ label: "กลุ่มบังคับ", minCredits: 9, courseNos: ["018131", "018132"] }] }],
            },
          ],
        },
      });
    if (pathname === "/api/curriculum/abcdefghi1") return r.fulfill({ json: { meta: meta("abcdefghi1", 64), curriculum } });
    return r.fulfill({ status: 404, json: { error: "ไม่พบ" } });
  });
});

test("set up a curriculum from a shared record", async ({ page }) => {
  await page.goto("/curriculum");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel("มหาวิทยาลัย").fill("มหาวิทยาลัยเชียงใหม่");
  await page.getByLabel("คณะ").fill("วิทยาศาสตร์");
  await page.getByLabel("สาขา").fill("วิทยาการคอมพิวเตอร์");
  await page.getByLabel("รหัสปีที่เข้า").selectOption("67");
  await page.getByRole("button", { name: "ค้นหาหลักสูตร" }).click();
  // Two versions of one program: the one covering cohort 67 is preselected, the other stays selectable.
  await expect(page.getByRole("radio", { name: /ใช้กับรหัส 64 เป็นต้นไป/ })).toBeChecked();
  await expect(page.getByRole("radio", { name: /รหัส 59–62/ })).not.toBeChecked();
  await expect(page.getByText("อ่านโดย AI ตรวจสอบกับเอกสารของคณะอีกครั้ง")).toBeVisible();
  await page.getByRole("button", { name: "ใช้หลักสูตรนี้" }).click();
  await page.getByLabel("แผนสหกิจศึกษา").check();
  await page.getByRole("button", { name: "ยืนยันแผนการเรียน" }).click();
  await expect(page.getByRole("heading", { name: /เทอมนี้ตามแผน/ })).toBeVisible();
  await expect(page.getByText("อ่านโดย AI ตรวจสอบกับเอกสารของคณะอีกครั้ง")).toBeVisible();
  // Term view: cohort 67 in the current term (2/2569) is year 3 semester 2.
  await expect(page.getByText("204306").first()).toBeVisible();
  await expect(page.getByText("เอกเลือก 3 นก.").first()).toBeVisible();
  await expect(page.getByText("วิชาโท 6 นก.").first()).toBeVisible();
  await page.getByRole("button", { name: "ติ๊กทั้งเทอม" }).first().click();
  await expect(page.getByText(/วิชาบังคับ \d+\/\d+ นก\./)).toBeVisible();
  await page.getByRole("button", { name: "เพิ่มทั้งหมดลงรายการ" }).click();
  await expect(page.getByRole("status")).toContainText("ลงรายการแล้ว");
  await page.getByLabel("เลือกวิชาโท").fill("ภาษาญี่ปุ่น");
  await expect(page.getByText("018131").first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("204306").first()).toBeVisible(); // state survives a reload
  // Wanted courses without sections point to the import page, the planner shows this term's plan.
  await page.goto("/");
  await expect(page.getByRole("link", { name: "ยังไม่มีตอนเรียน" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "ดูหลักสูตร" })).toBeVisible();
  // Plan codes always come with their source, read date and the AI disclaimer.
  const termCard = page.getByRole("region", { name: /เทอมนี้ตามแผน/ });
  await expect(termCard.getByRole("link", { name: "หลักสูตรวิทยาการคอมพิวเตอร์ 64" })).toBeVisible();
  await expect(termCard.getByText(/อ่านเมื่อ .*อ่านโดย AI ตรวจสอบกับเอกสารของคณะอีกครั้ง/)).toBeVisible();
  await page.goto("/import");
  await expect(page.getByText("ค้นรหัสเหล่านี้ในเว็บลงทะเบียน:")).toBeVisible();
  await expect(page.getByRole("link", { name: "หลักสูตรวิทยาการคอมพิวเตอร์ 64" })).toBeVisible();
  await expect(page.getByText(/อ่านเมื่อ .*อ่านโดย AI ตรวจสอบกับเอกสารของคณะอีกครั้ง/)).toBeVisible();
});

test("without a curriculum the planner and import pages show no curriculum prompts", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  for (const path of ["/", "/import"]) {
    await page.goto(path);
    await expect(page.getByText("ยังไม่มีตอนเรียน")).toHaveCount(0);
    await expect(page.getByText("ดูหลักสูตร")).toHaveCount(0);
    await expect(page.getByText("ค้นรหัสเหล่านี้ในเว็บลงทะเบียน:")).toHaveCount(0);
  }
});

test("a pasted document stays private, is never confirmed on the server, and a double click saves once", async ({ page }) => {
  let confirmCalls = 0;
  let readBody: unknown;
  await page.route("**/api/curriculum**", async (r) => {
    const { pathname } = new URL(r.request().url());
    if (pathname === "/api/curriculum") return r.fulfill({ json: { candidates: [] } });
    if (pathname.endsWith("/find")) return r.fulfill({ json: { links: [] } });
    if (pathname.endsWith("/confirm")) {
      confirmCalls++;
      return r.fulfill({ json: { ok: true } });
    }
    if (pathname.endsWith("/read")) {
      readBody = r.request().postDataJSON();
      return r.fulfill({ json: { preview: { kind: "curriculum", data: { ...curriculum, plans: [COOP] }, dropped: ["999999", "888888"] }, sourceTitle: "เอกสารที่วางเอง" } });
    }
    return r.fulfill({ json: { options: [] } });
  });
  await page.goto("/curriculum");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel("คณะ").fill("วิทยาศาสตร์");
  await page.getByLabel("สาขา").fill("วิทยาการคอมพิวเตอร์");
  await page.getByLabel("รหัสปีที่เข้า").selectOption("67");
  await page.getByRole("button", { name: "ค้นหาหลักสูตร" }).click();
  await expect(page.getByText("ยังไม่เจอหน้าหลักสูตร")).toBeVisible();
  await page.getByText("วางข้อความ", { exact: true }).click();
  await page.getByLabel("ข้อความจากเอกสารหลักสูตร").fill("แผนการศึกษา 204321 Database Systems");
  await page.getByRole("button", { name: "อ่านหลักสูตร", exact: true }).click();
  await expect(page.getByText("ตัดออก 2 รายการที่ไม่พบในเอกสาร")).toBeVisible();
  await expect(page.getByText("อ่านโดย AI ตรวจสอบกับเอกสารของคณะอีกครั้ง")).toBeVisible();
  expect(readBody).toMatchObject({ kind: "curriculum", cohort: 67, source: { text: "แผนการศึกษา 204321 Database Systems" } });
  await page.getByRole("button", { name: "ใช่ หลักสูตรนี้" }).dblclick();
  await expect(page.getByRole("heading", { name: /เทอมนี้ตามแผน/ })).toHaveCount(1);
  expect(confirmCalls).toBe(0);
});

test("cancelling during a slow confirm saves nothing", async ({ page }) => {
  await page.route("**/api/curriculum**", async (r) => {
    const { pathname } = new URL(r.request().url());
    if (pathname === "/api/curriculum") return r.fulfill({ json: { candidates: [] } });
    if (pathname.endsWith("/find")) return r.fulfill({ json: { links: [] } });
    if (pathname.endsWith("/read"))
      return r.fulfill({ json: { preview: { kind: "curriculum", data: { ...curriculum, plans: [COOP] }, dropped: [] }, sourceTitle: "ลิงก์ทดสอบ", pendingId: "abcdefghi1" } });
    if (pathname.endsWith("/confirm")) {
      await new Promise((res) => setTimeout(res, 1000));
      return r.fulfill({ json: { ok: true } });
    }
    if (pathname === "/api/curriculum/abcdefghi1") return r.fulfill({ json: { meta: meta("abcdefghi1", 64), curriculum: { ...curriculum, plans: [COOP] } } });
    return r.fulfill({ json: { options: [] } });
  });
  await page.goto("/curriculum");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel("คณะ").fill("วิทยาศาสตร์");
  await page.getByLabel("สาขา").fill("วิทยาการคอมพิวเตอร์");
  await page.getByLabel("รหัสปีที่เข้า").selectOption("67");
  await page.getByRole("button", { name: "ค้นหาหลักสูตร" }).click();
  await page.getByLabel("ลิงก์หลักสูตร").fill("https://science.cmu.ac.th/cs.pdf");
  await page.getByRole("button", { name: "อ่านหลักสูตร", exact: true }).click();
  await page.getByRole("button", { name: "ใช่ หลักสูตรนี้" }).click();
  await page.getByRole("button", { name: "ยกเลิก" }).click();
  await page.waitForTimeout(1600);
  await expect(page.getByRole("heading", { name: /เทอมนี้ตามแผน/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ค้นหาหลักสูตร" })).toBeVisible();
});

async function setUp(page: Page, cohort = "67") {
  await page.goto("/curriculum");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel("คณะ").fill("วิทยาศาสตร์");
  await page.getByLabel("สาขา").fill("วิทยาการคอมพิวเตอร์");
  await page.getByLabel("รหัสปีที่เข้า").selectOption(cohort);
  await page.getByRole("button", { name: "ค้นหาหลักสูตร" }).click();
  await page.getByRole("button", { name: "ใช้หลักสูตรนี้" }).click();
  await page.getByLabel("แผนสหกิจศึกษา").check();
  await page.getByRole("button", { name: "ยืนยันแผนการเรียน" }).click();
  await expect(page.getByRole("heading", { name: /เทอมนี้ตามแผน/ })).toBeVisible();
}

test("a pasted electives list is kept for this student and never confirmed on the server", async ({ page }) => {
  let confirmCalls = 0;
  await page.route("**/api/curriculum/**", async (r) => {
    const { pathname } = new URL(r.request().url());
    if (pathname.endsWith("/confirm")) {
      confirmCalls++;
      return r.fulfill({ json: { ok: true } });
    }
    if (pathname.endsWith("/read"))
      return r.fulfill({
        json: { preview: { kind: "electives", data: [{ courseNo: "204311", title: "Elective A" }, { courseNo: "204333", title: "Elective B" }], dropped: ["999999"] }, sourceTitle: "รายชื่อที่วางเอง" },
      });
    return r.fallback();
  });
  await setUp(page);
  const slot = page.getByRole("group", { name: "เอกเลือก 3 นก." });
  await slot.getByRole("button", { name: /ระบุวิชา/ }).click();
  await expect(slot.getByText("ยังไม่มีรายการวิชาของช่องนี้")).toBeVisible();
  await slot.getByRole("button", { name: "เพิ่มเอกสาร" }).click();
  await slot.getByText("วางข้อความ", { exact: true }).click();
  await slot.getByLabel("ข้อความจากเอกสาร").fill("204311 Elective A\n204333 Elective B");
  await slot.getByRole("button", { name: "อ่านเอกสาร" }).click();
  await expect(slot.getByText("เจอ 2 วิชา")).toBeVisible();
  await expect(slot.getByText("จากเอกสารที่คุณเพิ่มเอง")).toBeVisible();
  await expect(slot.getByText("ตัดออก 1 รายการที่ไม่พบในเอกสาร")).toBeVisible();
  await slot.getByRole("button", { name: "ใช้รายการนี้" }).click();
  await expect(slot.getByText("204311")).toBeVisible();
  await expect(slot.getByText("204333")).toBeVisible();
  expect(confirmCalls).toBe(0);
});

test("re-reading from the source says whether the data was replaced", async ({ page }) => {
  let replaced: boolean | null = true;
  await page.route("**/api/curriculum/refresh", (r) =>
    replaced === null ? r.fulfill({ status: 502, json: { error: "อ่านเอกสารต้นทางไม่สำเร็จ ลองใหม่ภายหลัง" } }) : r.fulfill({ json: { replaced } }),
  );
  await setUp(page);
  await page.getByRole("button", { name: "อ่านใหม่จากต้นทาง" }).click();
  await expect(page.getByRole("status")).toHaveText("อัปเดตแล้ว");
  replaced = false;
  await page.getByRole("button", { name: "อ่านใหม่จากต้นทาง" }).click();
  await expect(page.getByRole("status")).toHaveText("ยังใช้ฉบับเดิม (อ่านใหม่ได้ข้อมูลไม่ครบ)");
  replaced = null;
  await page.getByRole("button", { name: "อ่านใหม่จากต้นทาง" }).click();
  await expect(page.getByRole("region", { name: "หลักสูตรของฉัน" }).getByRole("alert")).toHaveText("อ่านเอกสารต้นทางไม่สำเร็จ ลองใหม่ภายหลัง");
});

test("a refreshed curriculum without the chosen plan's name falls back and says so", async ({ page }) => {
  await setUp(page);
  await page.route("**/api/curriculum/refresh", (r) => r.fulfill({ json: { replaced: true } }));
  await page.route("**/api/curriculum/abcdefghi1", (r) =>
    r.fulfill({ json: { meta: meta("abcdefghi1", 64), curriculum: { ...curriculum, plans: [{ ...COOP, id: "p1", name: "แผนใหม่" }] } } }),
  );
  await page.getByRole("button", { name: "อ่านใหม่จากต้นทาง" }).click();
  await expect(page.getByRole("status")).toHaveText("แผนการเรียนในเอกสารเปลี่ยนไป เลือกแผนอีกครั้งถ้าไม่ใช่แผนนี้");
  await expect(page.getByText(/หลักสูตรของฉัน: .* · แผนใหม่/)).toBeVisible();
});

test("a typed course code is normalised; one storage would refuse is explained", async ({ page }) => {
  await setUp(page);
  const slot = page.getByRole("group", { name: "เอกเลือก 3 นก." });
  await slot.getByRole("button", { name: /ระบุวิชา/ }).click();
  await slot.getByLabel("รหัสวิชา").fill("ก");
  await expect(slot.getByText("รหัสวิชาใช้ตัวอักษรอังกฤษและตัวเลข 2–12 ตัว")).toBeVisible();
  await expect(slot.getByRole("button", { name: "บันทึกวิชา" })).toBeDisabled();
  await slot.getByLabel("รหัสวิชา").fill("cs-101");
  await slot.getByRole("button", { name: "บันทึกวิชา" }).click();
  await expect(slot.getByText("CS101")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: /เทอมนี้ตามแผน/ })).toBeVisible(); // the workspace survived the save
});

test("a term outside the plan says so and offers the plan's terms", async ({ page }) => {
  await setUp(page, "69"); // entered 2569: 2/2569 is year 1, the plan starts in year 3
  await expect(page.getByRole("heading", { name: "เทอมนี้ตามแผน (ปี 1 เทอม 2)" })).toBeVisible();
  await expect(page.getByText("เทอมนี้ไม่อยู่ในแผนการเรียน เลือกเทอมที่ต้องการดูจากรายการด้านบน")).toBeVisible();
  await page.getByLabel("ดูเทอม").selectOption("3-1");
  await expect(page.getByRole("heading", { name: /ปี 3 เทอม 1 · 18 หน่วยกิต/ })).toBeVisible();
  await expect(page.getByText("เทอมนี้ไม่อยู่ในแผนการเรียน")).toHaveCount(0);
});

test("the page never claims a plan or minor is complete", async ({ page }) => {
  await setUp(page);
  await page.getByLabel("เลือกวิชาโท").fill("ภาษาญี่ปุ่น");
  const minor = page.getByRole("region", { name: "วิชาโท", exact: true });
  await expect(minor.getByText("ผ่านแล้ว 0 วิชา")).toBeVisible();
  await expect(minor.getByText("จากเอกสารที่คุณเพิ่มเอง")).toHaveCount(0);
  await expect(minor.getByText(/หลักสูตรวิทยาการคอมพิวเตอร์ 64/)).toBeVisible(); // source of the chosen minor
  for (const b of await page.getByRole("button", { name: "ติ๊กทั้งเทอม" }).all()) await b.click();
  await expect(page.locator("body")).not.toContainText("ครบแล้ว");
});

test("overdue courses can be added even when the term has no required courses", async ({ page }) => {
  await setUp(page, "66"); // 2/2569 is year 4 semester 2: nothing planned, everything earlier is overdue
  await expect(page.getByText("ค้างจากเทอมก่อน")).toBeVisible();
  await page.getByRole("button", { name: "เพิ่มทั้งหมดลงรายการ" }).click();
  await expect(page.getByRole("status")).toHaveText("เพิ่ม 9 วิชาลงรายการแล้ว");
});

test("a failed minor catalog shows the error and not the 'no catalog' line", async ({ page }) => {
  await page.route("**/api/curriculum/minors**", (r) => r.fulfill({ status: 500, json: { error: "โหลดไม่ได้" } }));
  await setUp(page);
  const minor = page.getByRole("region", { name: "วิชาโท", exact: true });
  await expect(minor.getByRole("alert")).toHaveText("โหลดไม่ได้");
  await expect(minor.getByText("ยังไม่มีบัญชีวิชาโทของมหาวิทยาลัยนี้")).toHaveCount(0);
});
