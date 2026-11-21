import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";

// Creates and deletes a throwaway user through the local Supabase admin API,
// so it never runs against a deployment.
test.skip(!!process.env.E2E_BASE_URL, "local only: needs the local Supabase secret key");

try {
  process.loadEnvFile(".env.local");
} catch {
  // CI provides the variables directly.
}

async function createUser(email: string, password: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SECRET_KEY!;
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  expect(res.ok, await res.text()).toBe(true);
}

test("account: show password, edit profile, change password, delete account", async ({ page }) => {
  const email = `e2e-${Date.now()}@morplan.test`;
  const password = `pw-${randomBytes(9).toString("base64url")}`;
  const newPassword = `pw-${randomBytes(9).toString("base64url")}`;
  await createUser(email, password);

  // Signed out, the account page sends you to sign in and back.
  await page.goto("/account?tab=security");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount%3Ftab%3Dsecurity/);

  await page.getByLabel("อีเมล").fill(email);
  const pw = page.getByLabel("รหัสผ่านของ MorPlan", { exact: true });
  await pw.fill(password);
  await expect(pw).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "แสดงรหัสผ่านของ MorPlan" }).click();
  await expect(pw).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "ซ่อนรหัสผ่านของ MorPlan" }).click();
  await expect(pw).toHaveAttribute("type", "password");
  await page.locator("form").getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).last().click();

  await expect(page).toHaveURL(/\/account\?tab=security$/);
  await expect(page.getByRole("heading", { name: "ตั้งค่าบัญชี" })).toBeVisible();

  // Wrong current password is refused; the right one changes it.
  await page.getByLabel("รหัสผ่านปัจจุบัน", { exact: true }).fill("not-the-password");
  await page.getByLabel("รหัสผ่านใหม่", { exact: true }).fill(newPassword);
  await page.getByLabel("ยืนยันรหัสผ่านใหม่", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "เปลี่ยนรหัสผ่าน" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("รหัสผ่านปัจจุบันไม่ถูกต้อง");
  await page.getByLabel("รหัสผ่านปัจจุบัน", { exact: true }).fill(password);
  await page.getByRole("button", { name: "เปลี่ยนรหัสผ่าน" }).click();
  await expect(page.getByRole("status").filter({ hasText: "เปลี่ยนรหัสผ่านแล้ว" })).toBeVisible();
  await expect(page.getByLabel("รหัสผ่านใหม่", { exact: true })).toHaveValue("");

  // Profile name shows up in the header.
  await page.getByRole("link", { name: "โปรไฟล์" }).click();
  await page.getByLabel("ชื่อที่แสดง").fill("ทดสอบ");
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "บันทึกชื่อแล้ว" })).toBeVisible();
  await expect(page.getByRole("link", { name: /ตั้งค่าบัญชี/ })).toContainText("ทดสอบ");

  // Deleting needs the email typed back.
  await page.getByRole("link", { name: "ข้อมูลของฉัน" }).click();
  await page.getByLabel(/พิมพ์ .* เพื่อยืนยัน/).fill("someone-else@morplan.test");
  await page.getByRole("button", { name: "ลบบัญชีถาวร" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("พิมพ์อีเมลของบัญชีให้ตรงก่อนลบ");
  await page.getByLabel(/พิมพ์ .* เพื่อยืนยัน/).fill(email);
  await page.getByRole("button", { name: "ลบบัญชีถาวร" }).click();
  await expect(page).toHaveURL(/\/\?account=deleted$/);
  await expect(page.getByRole("link", { name: "เข้าสู่ระบบ" })).toBeVisible();

  // The account is gone: the new password no longer works.
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่านของ MorPlan", { exact: true }).fill(newPassword);
  await page.locator("form").getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).last().click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
});

test("accounts never see each other's workspace; guest work can be carried into a new account", async ({ page }) => {
  const password = `pw-${randomBytes(9).toString("base64url")}`;
  const [a, b, c] = ["a", "b", "c"].map((x) => `e2e-${x}-${Date.now()}@morplan.test`);
  for (const email of [a, b, c]) await createUser(email, password);
  const demo = page.getByRole("button", { name: "ลองด้วยข้อมูลตัวอย่าง" });
  const banner = page.getByRole("region", { name: "นำเข้าข้อมูลก่อนเข้าสู่ระบบ" });

  async function signIn(email: string) {
    await page.goto("/login");
    await page.getByLabel("อีเมล").fill(email);
    await page.getByLabel("รหัสผ่านของ MorPlan", { exact: true }).fill(password);
    await page.locator("form").getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).last().click();
    await expect(page.getByRole("link", { name: /ตั้งค่าบัญชี/ })).toBeVisible();
  }
  async function signOut() {
    await page.goto("/account?tab=security");
    await page.getByRole("button", { name: "ออกจากระบบเครื่องนี้" }).click();
    await expect(page.getByRole("link", { name: "เข้าสู่ระบบ" })).toBeVisible();
  }

  // A fills a workspace and it is saved to A's account only.
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await signIn(a);
  await page.goto("/");
  await demo.click();
  await expect(page.getByText("บันทึกในบัญชีแล้ว")).toBeVisible();
  await expect(demo).toHaveCount(0);
  // Nothing of the account is kept in the browser: at most an empty guest workspace.
  const stored = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith("morplan:workspace")));
  expect(stored.map(([k]) => k).filter((k) => k !== "morplan:workspace:guest:v1")).toEqual([]);
  for (const [, v] of stored) expect(JSON.parse(v).pool).toEqual([]);

  // Signed out, and then as a brand-new account B, nothing of A shows and nothing is offered.
  await signOut();
  await page.goto("/");
  await expect(demo).toBeVisible();
  await signIn(b);
  await page.goto("/");
  await expect(demo).toBeVisible();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(demo).toBeVisible();

  // Work done as a guest is offered to a new account C, and goes in only when accepted.
  await signOut();
  await page.goto("/");
  await demo.click();
  await signIn(c);
  await page.goto("/");
  await expect(banner).toBeVisible();
  await expect(demo).toBeVisible();
  await banner.getByRole("button", { name: "นำเข้าบัญชีนี้" }).click();
  await expect(demo).toHaveCount(0);
  await expect(page.getByText("บันทึกในบัญชีแล้ว")).toBeVisible();

  // C can wipe the account's workspace from the account page.
  await page.goto("/account?tab=data");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "ล้างข้อมูลพื้นที่ทำงาน" }).click();
  await expect(page.getByRole("status").filter({ hasText: "ล้างแล้ว" })).toBeVisible();
  await page.goto("/");
  await expect(demo).toBeVisible();
});
