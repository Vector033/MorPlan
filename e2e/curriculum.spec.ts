import { expect, test } from "@playwright/test";
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
  await page.getByRole("button", { name: "ใช้หลักสูตรนี้" }).click();
  await page.getByLabel("แผนสหกิจศึกษา").check();
  await page.getByRole("button", { name: "ยืนยันแผนการเรียน" }).click();
  await expect(page.getByRole("heading", { name: /เทอมนี้ตามแผน/ })).toBeVisible();
  await expect(page.getByText("อ่านโดย AI ตรวจสอบกับเอกสารของคณะอีกครั้ง")).toBeVisible();
});
